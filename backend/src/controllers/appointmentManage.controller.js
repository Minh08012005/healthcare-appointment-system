const pool = require("../config/db");

const TRANG_THAI = { DA_DAT: "Đã đặt", DA_HUY: "Đã hủy" };
const GIO_TOI_THIEU_DE_HUY = 2;
// UC-010/UC-011: QR mất hiệu lực khi còn dưới 10 phút tới giờ hẹn.
const CON_HAN_QR_SQL = `((d.ngay_kham + d.gio_kham)
  - (now() AT TIME ZONE 'Asia/Ho_Chi_Minh') >= interval '10 minutes')`;

// Còn >= 2 giờ tới giờ khám (múi giờ VN) thì mới được hủy
const DU_GIO_HUY_SQL = `((d.ngay_kham + d.gio_kham)
  - (now() AT TIME ZONE 'Asia/Ho_Chi_Minh') >= interval '${GIO_TOI_THIEU_DE_HUY} hours')`;

const SELECT_LICH = `
  SELECT d.id, d.ma_dat_lich, d.trang_thai,
         to_char(d.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
         d.gio_kham::text AS gio_kham,
         d.phi_kham, d.trieu_chung, d.qr_code,
         bs.id AS bac_si_id, bs.ho_ten AS bac_si_ten, bs.cap_bac,
         ck.id AS chuyen_khoa_id, ck.ten_chuyen_khoa,
         pk.id AS phong_kham_id, pk.ten_phong,
         ${DU_GIO_HUY_SQL} AS du_gio_huy,
         ${CON_HAN_QR_SQL} AS con_han_qr
  FROM "DatLichKham" d
  LEFT JOIN "BacSi" bs ON bs.id = d.bac_si_id
  LEFT JOIN "ChuyenKhoa" ck ON ck.id = d.chuyen_khoa_id
  LEFT JOIN "PhongKham" pk ON pk.id = d.phong_kham_id
  WHERE d.benh_nhan_id = $1`;

// QR chỉ trả khi lịch còn hiệu lực; co_the_huy cho frontend bật/tắt nút Hủy
const toDto = ({ qr_code, du_gio_huy, con_han_qr, ...r }) => {
  const conHieuLuc =
    r.trang_thai === TRANG_THAI.DA_DAT && con_han_qr === true;
  return {
    ...r,
    qr_code: conHieuLuc ? qr_code : null,
    co_the_huy: conHieuLuc && du_gio_huy === true,
  };
};

const parseId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const layBenhNhanId = async (db, taiKhoanId) => {
  const r = await db.query(`SELECT id FROM "BenhNhan" WHERE tai_khoan_id = $1;`, [
    taiKhoanId,
  ]);
  return r.rowCount > 0 ? r.rows[0].id : null;
};

const chiBenhNhan = (res) =>
  res
    .status(403)
    .json({ success: false, message: "Chỉ bệnh nhân mới được xem lịch hẹn" });

const loi500 = (res, ten, error) => {
  console.error(`Lỗi ${ten}:`, error.message);
  res.status(500).json({ success: false, message: "Lỗi server" });
};

// GET /api/appointments
const getDanhSach = async (req, res) => {
  try {
    const benhNhanId = await layBenhNhanId(pool, req.user.id);
    if (!benhNhanId) return chiBenhNhan(res);

    const r = await pool.query(
      `${SELECT_LICH} ORDER BY d.ngay_kham DESC, d.gio_kham DESC, d.id DESC;`,
      [benhNhanId]
    );
    res.json({ success: true, data: r.rows.map(toDto) });
  } catch (error) {
    loi500(res, "danh sách lịch hẹn", error);
  }
};

// GET /api/appointments/:id
const getChiTiet = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "id không hợp lệ" });
  }
  try {
    const benhNhanId = await layBenhNhanId(pool, req.user.id);
    if (!benhNhanId) return chiBenhNhan(res);

    const r = await pool.query(`${SELECT_LICH} AND d.id = $2;`, [benhNhanId, id]);
    if (r.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch hẹn" });
    }
    res.json({ success: true, data: toDto(r.rows[0]) });
  } catch (error) {
    loi500(res, "chi tiết lịch hẹn", error);
  }
};

// PATCH /api/appointments/:id/cancel  (UC-009)
const huyLich = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "id không hợp lệ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const benhNhanId = await layBenhNhanId(client, req.user.id);
    if (!benhNhanId) {
      await client.query("ROLLBACK");
      return chiBenhNhan(res);
    }

    // Khóa dòng lịch hẹn: hủy hai lần cùng lúc không trừ slot hai lần
    const found = await client.query(
      `SELECT d.id, d.ma_dat_lich, d.trang_thai, d.bac_si_id,
              d.ngay_kham::text AS ngay_kham, d.gio_kham::text AS gio_kham,
              ${DU_GIO_HUY_SQL} AS du_gio_huy
       FROM "DatLichKham" d
       WHERE d.id = $1 AND d.benh_nhan_id = $2
       FOR UPDATE;`,
      [id, benhNhanId]
    );

    // Lịch của người khác cũng trả 404 để không lộ sự tồn tại
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch hẹn" });
    }

    const lich = found.rows[0];
    if (lich.trang_thai === TRANG_THAI.DA_HUY) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Lịch hẹn đã được hủy trước đó" });
    }
    if (lich.trang_thai !== TRANG_THAI.DA_DAT) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ success: false, message: "Lịch hẹn ở trạng thái hiện tại không thể hủy" });
    }
    if (lich.du_gio_huy !== true) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Chỉ được hủy lịch trước giờ khám ít nhất ${GIO_TOI_THIEU_DE_HUY} giờ`,
      });
    }

    await client.query(`UPDATE "DatLichKham" SET trang_thai = $1 WHERE id = $2;`, [
      TRANG_THAI.DA_HUY,
      id,
    ]);

    // Trả lại đúng 1 slot, không để âm
    const slotUpdated = await client.query(
      `UPDATE "LichKhamBacSi"
       SET so_slot_da_dat = GREATEST(COALESCE(so_slot_da_dat, 0) - 1, 0)
       WHERE bac_si_id = $1 AND ngay = $2 AND gio_bat_dau = $3;`,
      [lich.bac_si_id, lich.ngay_kham, lich.gio_kham]
    );
    if (slotUpdated.rowCount !== 1) {
      throw new Error(`Trả slot thất bại: cập nhật ${slotUpdated.rowCount} dòng`);
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      data: { id: lich.id, ma_dat_lich: lich.ma_dat_lich, trang_thai: TRANG_THAI.DA_HUY },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    loi500(res, "hủy lịch hẹn", error);
  } finally {
    client.release();
  }
};

module.exports = { getDanhSach, getChiTiet, huyLich };
