const pool = require("../config/db");

// C6-07: Phân công Lịch trực & Tổng quan Lịch (UC-030, UC-033)
const ROLE_ADMIN = "Quản trị viên";
const LOAI_KHAM = "Phòng khám";
const LOCK_KEY = 6007; // serialize ghi phân công lịch trực
const INT_MAX = 2147483647;

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });

const onlyAdmin = (req, res) => {
  if (!req.user || req.user.role !== ROLE_ADMIN) {
    fail(res, 403, "Chỉ quản trị viên mới được thực hiện thao tác này");
    return false;
  }
  return true;
};

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const parseBodyId = (v) => {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 && v <= INT_MAX ? v : null;
  return parseId(typeof v === "string" ? v.trim() : "");
};

const isValidDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
};

const getWeekRange = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
};

const getTodayVietnam = () => {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
};

const toScheduleDto = (r) => ({
  id: r.id,
  bac_si_id: r.bac_si_id,
  bac_si: {
    id: r.bac_si_id,
    ho_ten: r.bac_si_ten,
    cap_bac: r.bac_si_cap_bac,
  },
  chuyen_khoa: r.chuyen_khoa_id
    ? {
        id: r.chuyen_khoa_id,
        ten_chuyen_khoa: r.ten_chuyen_khoa,
      }
    : null,
  phong_kham_id: r.phong_kham_id,
  phong_kham: r.phong_kham_id
    ? {
        id: r.phong_kham_id,
        ten_phong: r.ten_phong,
        loai_phong: r.loai_phong,
      }
    : null,
  ngay: r.ngay,
  gio_bat_dau: r.gio_bat_dau,
  gio_ket_thuc: r.gio_ket_thuc,
  so_slot_toi_da: Number(r.so_slot_toi_da),
  so_slot_online: Number(r.so_slot_online),
  so_slot_da_dat: Number(r.so_slot_da_dat),
  trang_thai: r.trang_thai,
});

// GET /api/admin/schedules?start_date=&end_date=&date=&chuyen_khoa_id=&bac_si_id=&phong_kham_id=
const listSchedules = async (req, res) => {
  if (!onlyAdmin(req, res)) return;

  try {
    let startDate = null;
    let endDate = null;

    if (req.query.date !== undefined && req.query.date !== "") {
      if (!isValidDate(req.query.date)) {
        return fail(res, 400, "date không hợp lệ (định dạng YYYY-MM-DD)", "INVALID_DATE");
      }
      startDate = req.query.date;
      endDate = req.query.date;
    } else if (
      (req.query.start_date !== undefined && req.query.start_date !== "") ||
      (req.query.end_date !== undefined && req.query.end_date !== "")
    ) {
      if (req.query.start_date !== undefined && req.query.start_date !== "") {
        if (!isValidDate(req.query.start_date)) {
          return fail(res, 400, "start_date không hợp lệ (định dạng YYYY-MM-DD)", "INVALID_DATE");
        }
        startDate = req.query.start_date;
      }
      if (req.query.end_date !== undefined && req.query.end_date !== "") {
        if (!isValidDate(req.query.end_date)) {
          return fail(res, 400, "end_date không hợp lệ (định dạng YYYY-MM-DD)", "INVALID_DATE");
        }
        endDate = req.query.end_date;
      }
      if (startDate && !endDate) {
        endDate = addDays(startDate, 6);
      }
    } else if (req.query.all !== "true") {
      // Mặc định tuần hiện tại (Thứ 2 đến Chủ nhật theo giờ VN)
      const range = getWeekRange(getTodayVietnam());
      startDate = range.startDate;
      endDate = range.endDate;
    }

    let chuyenKhoaId = null;
    if (req.query.chuyen_khoa_id !== undefined && req.query.chuyen_khoa_id !== "") {
      chuyenKhoaId = parseId(req.query.chuyen_khoa_id);
      if (!chuyenKhoaId) return fail(res, 400, "chuyen_khoa_id không hợp lệ");
    }

    let bacSiId = null;
    if (req.query.bac_si_id !== undefined && req.query.bac_si_id !== "") {
      bacSiId = parseId(req.query.bac_si_id);
      if (!bacSiId) return fail(res, 400, "bac_si_id không hợp lệ");
    }

    let phongKhamId = null;
    if (req.query.phong_kham_id !== undefined && req.query.phong_kham_id !== "") {
      phongKhamId = parseId(req.query.phong_kham_id);
      if (!phongKhamId) return fail(res, 400, "phong_kham_id không hợp lệ");
    }

    const r = await pool.query(
      `SELECT
         l.id,
         l.bac_si_id,
         b.ho_ten AS bac_si_ten,
         b.cap_bac AS bac_si_cap_bac,
         b.chuyen_khoa_id,
         ck.ten_chuyen_khoa,
         l.phong_kham_id,
         pk.ten_phong,
         pk.loai_phong,
         to_char(l.ngay, 'YYYY-MM-DD') AS ngay,
         to_char(l.gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
         to_char(l.gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
         l.so_slot_toi_da,
         l.so_slot_online,
         COALESCE(l.so_slot_da_dat, 0) AS so_slot_da_dat,
         l.trang_thai
       FROM "LichKhamBacSi" l
       JOIN "BacSi" b ON b.id = l.bac_si_id
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       LEFT JOIN "PhongKham" pk ON pk.id = l.phong_kham_id
       WHERE ($1::date IS NULL OR l.ngay >= $1::date)
         AND ($2::date IS NULL OR l.ngay <= $2::date)
         AND ($3::int IS NULL OR b.chuyen_khoa_id = $3)
         AND ($4::int IS NULL OR l.bac_si_id = $4)
         AND ($5::int IS NULL OR l.phong_kham_id = $5)
       ORDER BY l.ngay ASC, l.gio_bat_dau ASC, b.ho_ten ASC, l.id ASC`,
      [startDate, endDate, chuyenKhoaId, bacSiId, phongKhamId]
    );

    return res.json({
      success: true,
      data: {
        start_date: startDate,
        end_date: endDate,
        items: r.rows.map(toScheduleDto),
        count: r.rows.length,
      },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// POST /api/admin/schedules
// Body: { bac_si_id, phong_kham_id, ngay, khung_gio_ids: [...] }
const createSchedules = async (req, res) => {
  if (!onlyAdmin(req, res)) return;

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(res, 400, "Body phải là JSON object");
  }

  const bacSiId = parseBodyId(body.bac_si_id);
  if (!bacSiId) {
    return fail(res, 400, "bac_si_id là bắt buộc và phải là số nguyên dương", "INVALID_DOCTOR");
  }

  const phongKhamId = parseBodyId(body.phong_kham_id);
  if (!phongKhamId) {
    return fail(res, 400, "phong_kham_id là bắt buộc và phải là số nguyên dương", "INVALID_ROOM");
  }

  if (!isValidDate(body.ngay)) {
    return fail(res, 400, "ngay là bắt buộc và phải có định dạng YYYY-MM-DD", "INVALID_DATE");
  }
  const ngay = body.ngay;

  const rawSlots = body.khung_gio_ids || body.time_slot_ids || body.time_slots;
  if (!rawSlots || !Array.isArray(rawSlots) || rawSlots.length === 0) {
    return fail(res, 400, "Vui lòng chọn ít nhất một khung giờ khám", "MISSING_TIME_SLOTS");
  }

  const parsedSlotIds = [];
  const parsedTimeStrs = [];
  for (const item of rawSlots) {
    const id = parseBodyId(item);
    if (id) {
      parsedSlotIds.push(id);
    } else if (typeof item === "string" && /^\d{2}:\d{2}/.test(item.trim())) {
      parsedTimeStrs.push(item.trim().slice(0, 5));
    } else if (item && typeof item === "object" && parseBodyId(item.id)) {
      parsedSlotIds.push(parseBodyId(item.id));
    } else {
      return fail(res, 400, "Khung giờ trong danh sách không hợp lệ", "INVALID_TIME_SLOT");
    }
  }

  const setIds = new Set(parsedSlotIds);
  const setTimes = new Set(parsedTimeStrs);
  if (setIds.size !== parsedSlotIds.length || setTimes.size !== parsedTimeStrs.length) {
    return fail(res, 400, "Danh sách khung giờ chứa khung giờ trùng lặp", "DUPLICATE_TIME_SLOT_IN_REQUEST");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize tạo lịch để chống race condition
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [LOCK_KEY]);

    // 1. Xác minh Bác sĩ tồn tại
    const bsRes = await client.query(
      `SELECT b.id, b.ho_ten, b.cap_bac, b.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "BacSi" b
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       WHERE b.id = $1`,
      [bacSiId]
    );
    if (bsRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Không tìm thấy bác sĩ", "DOCTOR_NOT_FOUND");
    }
    const doctor = bsRes.rows[0];

    // 2. Xác minh Phòng tồn tại
    const pkRes = await client.query(
      `SELECT pk.id, pk.ten_phong, pk.loai_phong, pk.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "PhongKham" pk
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
       WHERE pk.id = $1`,
      [phongKhamId]
    );
    if (pkRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Không tìm thấy phòng khám", "ROOM_NOT_FOUND");
    }
    const room = pkRes.rows[0];

    // 3. Xác minh Phòng phù hợp (phải là Phòng khám, không phải Phòng xét nghiệm; chuyên khoa phải khớp nếu phòng gắn chuyên khoa)
    if (room.loai_phong !== LOAI_KHAM) {
      await client.query("ROLLBACK");
      return fail(
        res,
        400,
        "Phòng được chọn không phải là phòng khám bệnh",
        "INVALID_ROOM_TYPE"
      );
    }
    if (room.chuyen_khoa_id && doctor.chuyen_khoa_id && room.chuyen_khoa_id !== doctor.chuyen_khoa_id) {
      await client.query("ROLLBACK");
      return fail(
        res,
        400,
        `Chuyên khoa của phòng khám (${room.ten_chuyen_khoa || room.chuyen_khoa_id}) không phù hợp với chuyên khoa của bác sĩ (${doctor.ten_chuyen_khoa || doctor.chuyen_khoa_id})`,
        "ROOM_SPECIALTY_MISMATCH"
      );
    }

    // 4 & 5. Xác minh Time Slot hợp lệ và lấy capacity từ config CauHinhKhungGio (C6-06)
    let slotTemplates = [];
    if (parsedSlotIds.length > 0) {
      const slotsRes = await client.query(
        `SELECT id, ca, to_char(gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
                to_char(gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
                so_slot_toi_da, so_slot_online
         FROM "CauHinhKhungGio"
         WHERE id = ANY($1::int[])
         ORDER BY gio_bat_dau`,
        [parsedSlotIds]
      );
      if (slotsRes.rowCount !== parsedSlotIds.length) {
        await client.query("ROLLBACK");
        return fail(
          res,
          400,
          "Một hoặc nhiều khung giờ không tồn tại trong cấu hình hệ thống",
          "INVALID_TIME_SLOT"
        );
      }
      slotTemplates = slotsRes.rows;
    } else {
      const slotsRes = await client.query(
        `SELECT id, ca, to_char(gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
                to_char(gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
                so_slot_toi_da, so_slot_online
         FROM "CauHinhKhungGio"
         WHERE to_char(gio_bat_dau, 'HH24:MI') = ANY($1::text[])
         ORDER BY gio_bat_dau`,
        [parsedTimeStrs]
      );
      if (slotsRes.rowCount !== parsedTimeStrs.length) {
        await client.query("ROLLBACK");
        return fail(
          res,
          400,
          "Một hoặc nhiều khung giờ không tồn tại trong cấu hình hệ thống",
          "INVALID_TIME_SLOT"
        );
      }
      slotTemplates = slotsRes.rows;
    }

    const startTimes = slotTemplates.map((s) => s.gio_bat_dau);

    // 6. Check Doctor Conflict: Bác sĩ không thể có 2 ca khám cùng ngày + cùng giờ
    const docConflictRes = await client.query(
      `SELECT id, to_char(gio_bat_dau, 'HH24:MI') AS gio_bat_dau
       FROM "LichKhamBacSi"
       WHERE bac_si_id = $1 AND ngay = $2 AND to_char(gio_bat_dau, 'HH24:MI') = ANY($3::text[])
         AND trang_thai <> 'DaHuy'`,
      [bacSiId, ngay, startTimes]
    );
    if (docConflictRes.rowCount > 0) {
      await client.query("ROLLBACK");
      const conflicted = docConflictRes.rows.map((r) => r.gio_bat_dau).join(", ");
      return fail(
        res,
        409,
        `Bác sĩ đã có lịch trực trong khung giờ này (${conflicted}).`,
        "DOCTOR_CONFLICT",
        { conflicted_slots: docConflictRes.rows.map((r) => r.gio_bat_dau) }
      );
    }

    // 7. Check Room Conflict: Phòng không thể có 2 bác sĩ cùng sử dụng: cùng ngày + cùng giờ
    const roomConflictRes = await client.query(
      `SELECT l.id, to_char(l.gio_bat_dau, 'HH24:MI') AS gio_bat_dau, l.bac_si_id, bs.ho_ten AS bac_si_ten
       FROM "LichKhamBacSi" l
       JOIN "BacSi" bs ON bs.id = l.bac_si_id
       WHERE l.phong_kham_id = $1 AND l.ngay = $2 AND to_char(l.gio_bat_dau, 'HH24:MI') = ANY($3::text[])
         AND l.trang_thai <> 'DaHuy'`,
      [phongKhamId, ngay, startTimes]
    );
    if (roomConflictRes.rowCount > 0) {
      await client.query("ROLLBACK");
      const conflicted = roomConflictRes.rows.map((r) => `${r.gio_bat_dau} (${r.bac_si_ten})`).join(", ");
      return fail(
        res,
        409,
        `Phòng khám đã được phân công cho bác sĩ khác trong khung giờ này (${conflicted}).`,
        "ROOM_CONFLICT",
        { conflicted_slots: roomConflictRes.rows.map((r) => r.gio_bat_dau) }
      );
    }

    // 8. Tạo lịch trực theo capacity của C6-06 tại thời điểm tạo
    const createdItems = [];
    for (const slot of slotTemplates) {
      const insRes = await client.query(
        `INSERT INTO "LichKhamBacSi"
           (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'HoatDong')
         RETURNING id, bac_si_id, phong_kham_id,
                   to_char(ngay, 'YYYY-MM-DD') AS ngay,
                   to_char(gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
                   to_char(gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
                   so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai`,
        [
          bacSiId,
          phongKhamId,
          ngay,
          slot.gio_bat_dau,
          slot.gio_ket_thuc,
          slot.so_slot_toi_da,
          slot.so_slot_online,
        ]
      );
      const row = insRes.rows[0];
      createdItems.push({
        id: row.id,
        bac_si_id: row.bac_si_id,
        bac_si: {
          id: doctor.id,
          ho_ten: doctor.ho_ten,
          cap_bac: doctor.cap_bac,
        },
        chuyen_khoa: doctor.chuyen_khoa_id
          ? { id: doctor.chuyen_khoa_id, ten_chuyen_khoa: doctor.ten_chuyen_khoa }
          : null,
        phong_kham_id: row.phong_kham_id,
        phong_kham: {
          id: room.id,
          ten_phong: room.ten_phong,
          loai_phong: room.loai_phong,
        },
        ngay: row.ngay,
        gio_bat_dau: row.gio_bat_dau,
        gio_ket_thuc: row.gio_ket_thuc,
        so_slot_toi_da: Number(row.so_slot_toi_da),
        so_slot_online: Number(row.so_slot_online),
        so_slot_da_dat: Number(row.so_slot_da_dat),
        trang_thai: row.trang_thai,
      });
    }

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: `Đã phân công ${createdItems.length} ca trực thành công.`,
      data: { items: createdItems, count: createdItems.length },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return fail(res, 409, "Bác sĩ đã có lịch trực trong khung giờ này.", "DOCTOR_CONFLICT");
    }
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

// DELETE /api/admin/schedules/:id
const deleteSchedule = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id lịch trực không hợp lệ");

  try {
    const r = await pool.query(
      `SELECT id, so_slot_da_dat, trang_thai FROM "LichKhamBacSi" WHERE id = $1`,
      [id]
    );
    if (r.rowCount === 0) {
      return fail(res, 404, "Không tìm thấy lịch trực", "SCHEDULE_NOT_FOUND");
    }
    const schedule = r.rows[0];
    if (Number(schedule.so_slot_da_dat) > 0) {
      return fail(
        res,
        409,
        "Lịch trực đã có bệnh nhân đặt hẹn, không thể xóa.",
        "SCHEDULE_HAS_BOOKINGS"
      );
    }
    await pool.query(`DELETE FROM "LichKhamBacSi" WHERE id = $1`, [id]);
    return res.json({ success: true, message: "Đã xóa lịch trực thành công." });
  } catch (err) {
    if (err.code === "23503") {
      return fail(res, 409, "Lịch trực có dữ liệu liên kết, không thể xóa.", "HAS_REFERENCES");
    }
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = {
  listSchedules,
  createSchedules,
  deleteSchedule,
  getWeekRange,
  getTodayVietnam,
};
