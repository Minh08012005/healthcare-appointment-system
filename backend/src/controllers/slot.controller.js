const pool = require("../config/db");

const isValidDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// GET /api/slots?bac_si_id=<id>&ngay=YYYY-MM-DD
// UC-007: chỉ ĐỌC. Không tạo DatLichKham, không đổi so_slot_da_dat (C2-06 lo).
const getSlotKhaDung = async (req, res) => {
  const { bac_si_id, ngay } = req.query;

  const bacSiId = Number(bac_si_id);
  if (!Number.isInteger(bacSiId) || bacSiId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "bac_si_id không hợp lệ" });
  }
  if (!isValidDate(ngay)) {
    return res.status(400).json({
      success: false,
      message: "ngay không hợp lệ (định dạng YYYY-MM-DD)",
    });
  }

  try {
    const bacSi = await pool.query(`SELECT id FROM "BacSi" WHERE id = $1;`, [
      bacSiId,
    ]);
    if (bacSi.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bác sĩ" });
    }

    // 'DaHuy' bị bỏ qua; 'HetCho' vẫn tính là "có lịch" để phân biệt DA_DAY với KHONG_CO_LICH
    const result = await pool.query(
      `SELECT l.id AS lich_kham_id,
              l.phong_kham_id,
              p.ten_phong,
              to_char(l.gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
              to_char(l.gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
              l.trang_thai,
              GREATEST(COALESCE(l.so_slot_online, 0) - COALESCE(l.so_slot_da_dat, 0), 0)
                AS slot_con_lai,
              ((l.ngay + l.gio_bat_dau) >
                (now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '10 minutes')
                AS con_kip_dat
       FROM "LichKhamBacSi" l
       LEFT JOIN "PhongKham" p ON p.id = l.phong_kham_id
       WHERE l.bac_si_id = $1
         AND l.ngay = $2
         AND l.trang_thai IN ('HoatDong', 'HetCho')
       ORDER BY l.gio_bat_dau;`,
      [bacSiId, ngay]
    );

    const lich = result.rows;
    const slots = lich
      .filter(
        (r) => r.trang_thai === "HoatDong" && r.slot_con_lai > 0 && r.con_kip_dat
      )
      .map(({ trang_thai, con_kip_dat, ...slot }) => slot);

    let trangThai = "CON_SLOT";
    let message = null;
    if (lich.length === 0) {
      trangThai = "KHONG_CO_LICH";
      message =
        "Bác sĩ không có lịch làm việc trong ngày đã chọn. Vui lòng chọn ngày khác.";
    } else if (slots.length === 0) {
      trangThai = "DA_DAY";
      message = "Không còn khung giờ trống trong ngày đã chọn.";
    }

    res.json({
      success: true,
      data: { bac_si_id: bacSiId, ngay, trang_thai: trangThai, message, slots },
    });
  } catch (error) {
    console.error("Lỗi truy vấn slot khả dụng:", error.message);
    res.status(500).json({
      success: false,
      message: "Không truy vấn được database",
    });
  }
};

module.exports = { getSlotKhaDung };