const pool = require("../config/db");
const { evaluateCheckinWindow } = require("../utils/checkinWindow");

const ROLE_LE_TAN = "Lễ tân";
const ST_DA_DAT = "DA_DAT";
const ST_DA_CHECK_IN = "DA_CHECK_IN";

const STATE_MESSAGES = {
  DA_CHECK_IN: "Lịch hẹn đã được check-in trước đó",
  QUA_HAN_CHECK_IN: "Lịch hẹn đã quá hạn check-in",
  DA_HUY: "Lịch hẹn đã bị hủy",
  HOAN_THANH: "Lịch hẹn đã hoàn thành",
};

// POST /api/checkin/online   body: { ma_dat_lich } hoặc { qr_code }
const checkinOnline = async (req, res) => {
  // 1. Chỉ Lễ tân được check-in
  if (!req.user || req.user.role !== ROLE_LE_TAN) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ Lễ tân mới được check-in" });
  }

  // 2. Validate input
  const body = req.body || {};
  const raw = body.ma_dat_lich !== undefined ? body.ma_dat_lich : body.qr_code;
  if (typeof raw !== "string" || raw.trim() === "" || raw.trim().length > 100) {
    return res
      .status(400)
      .json({ success: false, message: "ma_dat_lich không hợp lệ" });
  }
  const code = raw.trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fail = async (status, message, errCode) => {
      await client.query("ROLLBACK");
      return res
        .status(status)
        .json({ success: false, message, ...(errCode ? { code: errCode } : {}) });
    };

    // 3. Đọc cấu hình 60/10 phút từ DB (bảng CauHinhHeThong chỉ có 1 dòng)
    const cfg = await client.query(
      `SELECT checkin_som_nhat_phut, checkin_toi_thieu_phut
       FROM "CauHinhHeThong" ORDER BY id LIMIT 1`
    );
    const earliest = cfg.rows[0] ? Number(cfg.rows[0].checkin_som_nhat_phut) : NaN;
    const latest = cfg.rows[0] ? Number(cfg.rows[0].checkin_toi_thieu_phut) : NaN;
    if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
      return fail(500, "Thiếu cấu hình thời gian check-in");
    }

    // 4. Tìm lịch hẹn theo mã (hoặc nội dung QR) và khóa dòng
    //    -> hai lễ tân quét cùng lúc chỉ một người thành công
    const found = await client.query(
      `SELECT d.id, d.ma_dat_lich, d.trang_thai, d.trieu_chung,
              to_char(d.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
              to_char(d.gio_kham, 'HH24:MI:SS') AS gio_kham,
              EXTRACT(EPOCH FROM ((d.ngay_kham + d.gio_kham)
                - (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))) AS giay_con_lai
       FROM "DatLichKham" d
       WHERE UPPER(d.ma_dat_lich) = UPPER($1) OR d.qr_code = $1
       ORDER BY (UPPER(d.ma_dat_lich) = UPPER($1)) DESC
       LIMIT 1
       FOR UPDATE OF d`,
      [code]
    );
    if (found.rowCount === 0) {
      return fail(404, "Không tìm thấy lịch hẹn với mã này");
    }
    const appt = found.rows[0];

    // 5. Kiểm tra trạng thái TRƯỚC, rồi mới kiểm tra thời gian
    if (appt.trang_thai !== ST_DA_DAT) {
      return fail(
        409,
        STATE_MESSAGES[appt.trang_thai] || "Lịch hẹn không ở trạng thái có thể check-in",
        "INVALID_STATE"
      );
    }
    if (appt.giay_con_lai === null) {
      return fail(409, "Lịch hẹn chưa có giờ khám", "NO_TIME");
    }

    // 6. Rule 60/10 phút do Backend quyết định
    const verdict = evaluateCheckinWindow(Number(appt.giay_con_lai), earliest, latest);
    if (verdict === "TOO_EARLY") {
      return fail(
        400,
        `Chưa đến giờ check-in (chỉ check-in từ ${earliest} phút trước giờ hẹn)`,
        "TOO_EARLY"
      );
    }
    if (verdict === "TOO_LATE") {
      return fail(
        400,
        `Đã quá hạn check-in (phải check-in trước giờ hẹn tối thiểu ${latest} phút)`,
        "TOO_LATE"
      );
    }

    // 7. DA_DAT -> DA_CHECK_IN. KHÔNG tạo HangDoi ở đây (thuộc C3-03)
    const upd = await client.query(
      `UPDATE "DatLichKham" SET trang_thai = $2 WHERE id = $1 AND trang_thai = $3 RETURNING id`,
      [appt.id, ST_DA_CHECK_IN, ST_DA_DAT]
    );
    if (upd.rowCount === 0) {
      return fail(409, STATE_MESSAGES.DA_CHECK_IN, "INVALID_STATE");
    }

    // 8. Dữ liệu cho màn hình LT-02
    const info = await client.query(
      `SELECT bn.id AS bn_id, bn.ho_ten AS bn_ho_ten,
              to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS bn_ngay_sinh,
              bn.gioi_tinh, bn.ma_bhyt, tk.so_dien_thoai,
              bs.id AS bs_id, bs.ho_ten AS bs_ho_ten, bs.cap_bac,
              ck.id AS ck_id, ck.ten_chuyen_khoa,
              pk.id AS pk_id, pk.ten_phong
       FROM "DatLichKham" d
       JOIN "BenhNhan" bn ON bn.id = d.benh_nhan_id
       LEFT JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id
       LEFT JOIN "BacSi" bs ON bs.id = d.bac_si_id
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = d.chuyen_khoa_id
       LEFT JOIN "PhongKham" pk ON pk.id = d.phong_kham_id
       WHERE d.id = $1`,
      [appt.id]
    );
    const i = info.rows[0];

    await client.query("COMMIT");
    return res.json({
      success: true,
      data: {
        appointment: {
          id: appt.id,
          ma_dat_lich: appt.ma_dat_lich,
          trang_thai: ST_DA_CHECK_IN,
          ngay_kham: appt.ngay_kham,
          gio_kham: appt.gio_kham,
          trieu_chung: appt.trieu_chung,
        },
        patient: {
          id: i.bn_id,
          ho_ten: i.bn_ho_ten,
          ngay_sinh: i.bn_ngay_sinh,
          gioi_tinh: i.gioi_tinh,
          ma_bhyt: i.ma_bhyt,
          so_dien_thoai: i.so_dien_thoai,
        },
        doctor: { id: i.bs_id, ho_ten: i.bs_ho_ten, cap_bac: i.cap_bac },
        specialty: { id: i.ck_id, ten_chuyen_khoa: i.ten_chuyen_khoa },
        room: { id: i.pk_id, ten_phong: i.ten_phong },
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

module.exports = { checkinOnline };
