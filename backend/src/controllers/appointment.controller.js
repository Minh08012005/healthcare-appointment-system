const crypto = require("crypto");
const pool = require("../config/db");

const STATUS_DA_DAT = "Đã đặt";
const LICH_ACTIVE = "HoatDong"; // KIỂM TRA: đúng giá trị trang_thai của lịch hoạt động trong DB
const MIN_SECONDS_BEFORE = 10 * 60; // phải còn >= 10 phút
const INT_MAX = 2147483647;

const parseId = (v) => {
  let n = null;
  if (typeof v === "number" && Number.isInteger(v)) n = v;
  else if (typeof v === "string" && /^[1-9]\d{0,9}$/.test(v.trim())) n = Number(v.trim());
  return n !== null && n > 0 && n <= INT_MAX ? n : null;
};

const createAppointment = async (req, res) => {
  const { lich_kham_id, trieu_chung } = req.body || {};

  // 1. Validate input
  const lichId = parseId(lich_kham_id);
  if (!lichId) {
    return res
      .status(400)
      .json({ success: false, message: "lich_kham_id không hợp lệ" });
  }
  if (trieu_chung !== undefined && trieu_chung !== null && typeof trieu_chung !== "string") {
    return res.status(400).json({ success: false, message: "trieu_chung phải là chuỗi" });
  }
  const trieuChung =
    typeof trieu_chung === "string" && trieu_chung.trim() !== "" ? trieu_chung.trim() : null;
  if (trieuChung && trieuChung.length > 1000) {
    return res.status(400).json({ success: false, message: "Triệu chứng tối đa 1000 ký tự" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2. Xác định bệnh nhân từ tài khoản đang đăng nhập (không tin id từ frontend)
    const bn = await client.query(
      `SELECT id FROM "BenhNhan" WHERE tai_khoan_id = $1`,
      [req.user.id]
    );
    if (bn.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(403)
        .json({ success: false, message: "Chỉ bệnh nhân mới được đặt lịch" });
    }
    const benhNhanId = bn.rows[0].id;

    // 3. KHÓA dòng lịch (FOR UPDATE) -> request khác phải chờ, không đặt chen được
    const lichRes = await client.query(
      `SELECT l.id, l.bac_si_id, l.phong_kham_id, l.trang_thai,
              COALESCE(l.so_slot_online, 0) AS so_slot_online,
              COALESCE(l.so_slot_da_dat, 0) AS so_slot_da_dat,
              to_char(l.ngay, 'YYYY-MM-DD') AS ngay,
              to_char(l.gio_bat_dau, 'HH24:MI:SS') AS gio_bat_dau,
              EXTRACT(EPOCH FROM ((l.ngay + l.gio_bat_dau)
                - (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))) AS giay_con_lai,
              bs.ho_ten AS bac_si_ten, bs.cap_bac, bs.muc_phi, bs.chuyen_khoa_id,
              ck.ten_chuyen_khoa, pk.ten_phong
       FROM "LichKhamBacSi" l
       JOIN "BacSi" bs ON bs.id = l.bac_si_id
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = bs.chuyen_khoa_id
       LEFT JOIN "PhongKham" pk ON pk.id = l.phong_kham_id
       WHERE l.id = $1
       FOR UPDATE OF l`,
      [lichId]
    );

    // 4. Kiểm tra nghiệp vụ (đang giữ khóa nên số liệu là mới nhất)
    if (lichRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch khám" });
    }
    const lich = lichRes.rows[0];

    if (lich.trang_thai !== LICH_ACTIVE) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ success: false, message: "Lịch khám không còn hoạt động" });
    }
    if (Number(lich.so_slot_da_dat) >= Number(lich.so_slot_online)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Lịch khám đã hết chỗ đặt online" });
    }
    const giay = Number(lich.giay_con_lai);
    if (giay < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Lịch khám đã qua" });
    }
    if (giay < MIN_SECONDS_BEFORE) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ success: false, message: "Chỉ được đặt lịch khi còn ít nhất 10 phút" });
    }

    // 5. Tạo lịch hẹn
    const maDatLich = `DL${lich.ngay.replace(/-/g, "")}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const ins = await client.query(
      `INSERT INTO "DatLichKham"
         (ma_dat_lich, benh_nhan_id, bac_si_id, phong_kham_id, chuyen_khoa_id,
          ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai, qr_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        maDatLich,
        benhNhanId,
        lich.bac_si_id,
        lich.phong_kham_id,
        lich.chuyen_khoa_id,
        lich.ngay,
        lich.gio_bat_dau,
        trieuChung,
        lich.muc_phi,
        STATUS_DA_DAT,
        maDatLich, // nội dung để Frontend C2-07 vẽ QR
      ]
    );

    // 6. Tăng counter đúng 1, cùng transaction
    await client.query(
      `UPDATE "LichKhamBacSi"
       SET so_slot_da_dat = COALESCE(so_slot_da_dat, 0) + 1
       WHERE id = $1`,
      [lichId]
    );

    await client.query("COMMIT");

    // 7. Dữ liệu bàn giao cho C2-07
    return res.status(201).json({
      success: true,
      data: {
        appointment: {
          id: ins.rows[0].id,
          ma_dat_lich: maDatLich,
          trang_thai: STATUS_DA_DAT,
          ngay_kham: lich.ngay,
          gio_kham: lich.gio_bat_dau,
          phi_kham: lich.muc_phi,
          trieu_chung: trieuChung,
          qr_code: maDatLich,
        },
        doctor: { id: lich.bac_si_id, ho_ten: lich.bac_si_ten, cap_bac: lich.cap_bac },
        specialty: { id: lich.chuyen_khoa_id, ten_chuyen_khoa: lich.ten_chuyen_khoa },
        room: { id: lich.phong_kham_id, ten_phong: lich.ten_phong },
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

module.exports = { createAppointment };