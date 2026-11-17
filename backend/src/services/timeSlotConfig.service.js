const pool = require("../config/db");

// C6-06: đọc template khung giờ + capacity (bảng CauHinhKhungGio).
// C6-07 dùng hàm này khi tạo lịch trực mới, KHÔNG hard-code khung giờ/slot.
// Truyền `db` là client của transaction đang mở nếu muốn đọc trong cùng transaction.
const TIME_FORMAT = "HH:mm";

const SELECT_TEMPLATE = `
  SELECT id, ca,
         to_char(gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
         to_char(gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
         so_slot_toi_da, so_slot_online
  FROM "CauHinhKhungGio"`;

const toItem = (r) => ({
  id: r.id,
  ca: r.ca, // "SANG" | "CHIEU"
  gio_bat_dau: r.gio_bat_dau, // "HH:mm"
  gio_ket_thuc: r.gio_ket_thuc,
  so_slot_toi_da: r.so_slot_toi_da,
  so_slot_online: r.so_slot_online,
  so_slot_offline: r.so_slot_toi_da - r.so_slot_online,
});

// -> [{ id, ca, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_offline }] theo giờ tăng dần
const getTimeSlotTemplate = async (db = pool) =>
  (await db.query(`${SELECT_TEMPLATE} ORDER BY gio_bat_dau`)).rows.map(toItem);

const getTimeSlotById = async (db, id) => {
  const r = await db.query(`${SELECT_TEMPLATE} WHERE id = $1`, [id]);
  return r.rowCount ? toItem(r.rows[0]) : null;
};

module.exports = { TIME_FORMAT, getTimeSlotTemplate, getTimeSlotById };