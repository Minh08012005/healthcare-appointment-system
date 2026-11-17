const pool = require("../config/db");
const { TIME_FORMAT, getTimeSlotTemplate, getTimeSlotById } = require("../services/timeSlotConfig.service");

// C6-06 (UC-031): Admin xem / sửa capacity của 8 khung giờ chuẩn.
// Chỉ sửa so_slot_toi_da + so_slot_online; không thêm/xóa khung, không sửa giờ (theo issue).
// Không ghi đè LichKhamBacSi đã có: cấu hình chỉ là template cho lịch trực mới (C6-07).
const INT_MAX = 2147483647;

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

const parseId = (v) => (typeof v === "string" && /^[1-9]\d{0,9}$/.test(v) && Number(v) <= INT_MAX ? Number(v) : null);
// Chỉ nhận số nguyên kiểu number (không nhận "5", 5.5, null, true)
const isInt = (v) => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= INT_MAX;

// GET /api/admin/time-slots
const listTimeSlots = async (req, res) => {
  try {
    const items = await getTimeSlotTemplate();
    return res.json({ success: true, data: { time_format: TIME_FORMAT, items } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// PUT /api/admin/time-slots/:id { so_slot_toi_da, so_slot_online }
const updateTimeSlot = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id khung giờ không hợp lệ");

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(res, 400, "Body phải là JSON object");
  const { so_slot_toi_da: total, so_slot_online: online } = body;

  if (!isInt(total)) return fail(res, 400, "so_slot_toi_da phải là số nguyên", "INVALID_TOTAL");
  if (!isInt(online)) return fail(res, 400, "so_slot_online phải là số nguyên", "INVALID_ONLINE");
  if (total <= 0) return fail(res, 400, "Số slot tối đa phải lớn hơn 0", "INVALID_TOTAL");
  if (online < 0) return fail(res, 400, "Số slot online không được âm", "INVALID_ONLINE");
  if (online > total) {
    return fail(res, 400, "Số slot online không được lớn hơn số slot tối đa", "ONLINE_EXCEEDS_TOTAL");
  }

  try {
    const r = await pool.query(
      `UPDATE "CauHinhKhungGio"
       SET so_slot_toi_da = $1, so_slot_online = $2, ngay_cap_nhat = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [total, online, id]
    );
    if (!r.rowCount) return fail(res, 404, "Không tìm thấy khung giờ");
    return res.json({ success: true, data: await getTimeSlotById(pool, id) });
  } catch (err) {
    if (err.code === "23514") return fail(res, 400, "Cấu hình slot không hợp lệ", "INVALID_CAPACITY");
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listTimeSlots, updateTimeSlot };