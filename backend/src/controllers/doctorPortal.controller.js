const pool = require("../config/db");
const { getWeekRange, getTodayVietnam } = require("./adminSchedule.controller");

const ROLE_BAC_SI = "Bác sĩ";
const STATUSES = ["CHO_KHAM", "DANG_KHAM", "DA_XONG"];
const TODAY_VN = "(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
const CHECKIN_DAY = "(h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const addDays = (value, amount) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};

const getDoctor = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    fail(res, 403, "Chỉ bác sĩ mới được truy cập khu vực này");
    return null;
  }
  const result = await pool.query(
    `SELECT id, ho_ten, cap_bac, chuyen_khoa_id
     FROM "BacSi" WHERE tai_khoan_id = $1`,
    [req.user.id]
  );
  if (result.rowCount === 0) {
    fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    return null;
  }
  return result.rows[0];
};

const resolveWeek = (query) => {
  if (query.date !== undefined && (query.start_date !== undefined || query.end_date !== undefined)) {
    return { error: "Chỉ gửi date hoặc start_date/end_date" };
  }

  let startDate;
  if (query.date !== undefined) {
    if (!isValidDate(query.date)) return { error: "date không hợp lệ (định dạng YYYY-MM-DD)" };
    startDate = getWeekRange(query.date).startDate;
  } else if (query.start_date !== undefined) {
    if (!isValidDate(query.start_date)) {
      return { error: "start_date không hợp lệ (định dạng YYYY-MM-DD)" };
    }
    startDate = query.start_date;
  } else if (query.end_date !== undefined) {
    return { error: "Cần gửi start_date khi gửi end_date" };
  } else {
    startDate = getWeekRange(getTodayVietnam()).startDate;
  }

  if (getWeekRange(startDate).startDate !== startDate) {
    return { error: "start_date phải là ngày Thứ 2 của tuần" };
  }

  const endDate = query.end_date === undefined ? addDays(startDate, 6) : query.end_date;
  if (!isValidDate(endDate) || endDate !== addDays(startDate, 6)) {
    return { error: "Khoảng ngày phải là một tuần từ Thứ 2 đến Chủ nhật" };
  }
  return { startDate, endDate };
};

// GET /api/doctor/schedules — bác sĩ luôn được suy ra từ tài khoản đăng nhập.
const listMySchedules = async (req, res) => {
  try {
    const doctor = await getDoctor(req, res);
    if (!doctor) return;

    const week = resolveWeek(req.query);
    if (week.error) return fail(res, 400, week.error, "INVALID_DATE_RANGE");

    const result = await pool.query(
      `SELECT l.id, l.bac_si_id, l.phong_kham_id,
              to_char(l.ngay, 'YYYY-MM-DD') AS ngay,
              to_char(l.gio_bat_dau, 'HH24:MI') AS gio_bat_dau,
              to_char(l.gio_ket_thuc, 'HH24:MI') AS gio_ket_thuc,
              l.trang_thai, pk.ten_phong, pk.loai_phong,
              b.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "LichKhamBacSi" l
       JOIN "BacSi" b ON b.id = l.bac_si_id
       LEFT JOIN "PhongKham" pk ON pk.id = l.phong_kham_id
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       WHERE l.bac_si_id = $1 AND l.ngay BETWEEN $2::date AND $3::date
       ORDER BY l.ngay, l.gio_bat_dau, l.id`,
      [doctor.id, week.startDate, week.endDate]
    );

    return res.json({
      success: true,
      data: {
        start_date: week.startDate,
        end_date: week.endDate,
        items: result.rows.map((row) => ({
          id: row.id,
          bac_si_id: row.bac_si_id,
          ngay: row.ngay,
          gio_bat_dau: row.gio_bat_dau,
          gio_ket_thuc: row.gio_ket_thuc,
          trang_thai: row.trang_thai,
          phong_kham: row.phong_kham_id
            ? { id: row.phong_kham_id, ten_phong: row.ten_phong, loai_phong: row.loai_phong }
            : null,
          chuyen_khoa: row.chuyen_khoa_id
            ? { id: row.chuyen_khoa_id, ten_chuyen_khoa: row.ten_chuyen_khoa }
            : null,
        })),
      },
    });
  } catch (err) {
    console.error("Lỗi listMySchedules:", err);
    return fail(res, 500, "Lỗi server");
  }
};

const getCurrentRoom = async (doctorId) => {
  const result = await pool.query(
    `SELECT l.phong_kham_id, pk.ten_phong
     FROM "LichKhamBacSi" l
     LEFT JOIN "PhongKham" pk ON pk.id = l.phong_kham_id
     WHERE l.bac_si_id = $1 AND l.ngay = ${TODAY_VN}
       AND l.phong_kham_id IS NOT NULL AND l.trang_thai <> 'DaHuy'
     ORDER BY
       (CASE WHEN (l.ngay + l.gio_bat_dau) <= (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
              AND (l.ngay + l.gio_ket_thuc) > (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
             THEN 0 ELSE 1 END),
       ABS(EXTRACT(EPOCH FROM ((l.ngay + l.gio_bat_dau) -
                               (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')))),
       l.id
     LIMIT 1`,
    [doctorId]
  );
  return result.rows[0]
    ? { id: result.rows[0].phong_kham_id, ten_phong: result.rows[0].ten_phong }
    : null;
};

const getCurrentExamination = async (doctorId) => {
  const result = await pool.query(
    `SELECT hs.id AS ho_so_id, hs.trang_thai,
            bn.id AS benh_nhan_id, bn.ho_ten,
            h.id AS hang_doi_id, h.loai, h.so_thu_tu, h.phong_kham_id,
            pk.ten_phong
     FROM "HoSoBenhAn" hs
     JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
     LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
     LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
     WHERE hs.trang_thai = 'DANG_KHAM'
       AND COALESCE(hs.bac_si_id, h.bac_si_id) = $1
     ORDER BY hs.id DESC
     LIMIT 2`,
    [doctorId]
  );

  if (result.rowCount > 1) {
    return { examination: null, conflict: true };
  }
  if (result.rowCount === 0) {
    return { examination: null, conflict: false };
  }

  const row = result.rows[0];
  return {
    examination: {
      ho_so_id: row.ho_so_id,
      trang_thai: row.trang_thai,
      patient: { id: row.benh_nhan_id, ho_ten: row.ho_ten },
      queue: row.hang_doi_id
        ? {
            id: row.hang_doi_id,
            loai: row.loai,
            so_thu_tu: row.so_thu_tu,
            nhan_stt: `${row.loai === "ONLINE" ? "A" : row.loai === "OFFLINE" ? "B" : ""}${row.so_thu_tu}`,
          }
        : null,
      room: row.phong_kham_id ? { id: row.phong_kham_id, ten_phong: row.ten_phong } : null,
    },
    conflict: false,
  };
};

// GET /api/doctor/patients?status=CHO_KHAM|DANG_KHAM|DA_XONG
const listShiftPatients = async (req, res) => {
  try {
    const doctor = await getDoctor(req, res);
    if (!doctor) return;

    const status = req.query.status === undefined ? "CHO_KHAM" : req.query.status;
    if (!STATUSES.includes(status)) {
      return fail(res, 400, `status phải là một trong: ${STATUSES.join(", ")}`, "INVALID_STATUS");
    }

    const room = await getCurrentRoom(doctor.id);
    let items = [];
    if (room) {
      const result = await pool.query(
        `SELECT h.id AS hang_doi_id, h.benh_nhan_id, h.loai, h.so_thu_tu,
                h.trang_thai, h.phong_kham_id,
                to_char(h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') AS gio_check_in,
                bn.ho_ten, hs.id AS ho_so_id
         FROM "HangDoi" h
         JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
         LEFT JOIN LATERAL (
           SELECT id FROM "HoSoBenhAn"
           WHERE hang_doi_id = h.id
           ORDER BY id DESC LIMIT 1
         ) hs ON true
         WHERE h.phong_kham_id = $1
           AND (h.bac_si_id = $2 OR h.bac_si_id IS NULL)
           AND ${CHECKIN_DAY} = ${TODAY_VN}
           AND h.trang_thai = $3
         ORDER BY h.so_thu_tu, h.thoi_gian_check_in, h.id`,
        [room.id, doctor.id, status]
      );
      items = result.rows.map((row) => ({
        hang_doi_id: row.hang_doi_id,
        ho_so_id: row.ho_so_id,
        patient: { id: row.benh_nhan_id, ho_ten: row.ho_ten },
        loai: row.loai,
        so_thu_tu: row.so_thu_tu,
        nhan_stt: `${row.loai === "ONLINE" ? "A" : row.loai === "OFFLINE" ? "B" : ""}${row.so_thu_tu}`,
        trang_thai: row.trang_thai,
        gio_check_in: row.gio_check_in,
        room: { id: row.phong_kham_id, ten_phong: room.ten_phong },
      }));
    }

    const current = await getCurrentExamination(doctor.id);
    return res.json({
      success: true,
      data: {
        doctor: { id: doctor.id, ho_ten: doctor.ho_ten },
        room,
        status,
        items,
        current_examination: current.examination,
        current_examination_conflict: current.conflict,
      },
    });
  } catch (err) {
    console.error("Lỗi listShiftPatients:", err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listMySchedules, listShiftPatients };
