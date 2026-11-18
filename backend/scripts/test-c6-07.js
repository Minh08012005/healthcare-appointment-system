// C6-07 - Phân công Lịch trực & Tổng quan Lịch (UC-030, UC-033)
// Chạy: npm run api:test-c6-07
// Tự khởi động in-process server nếu chưa có localhost:3000.
// Tự tạo dữ liệu test cô lập (tiền tố ZZS...) và tự dọn sau khi chạy.

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const app = require("../src/app");

const sfx = Date.now().toString().slice(-6);
const TAG = `ZZS${sfx}`;
let pass = 0, fail = 0;
let server = null;
let BASE = "http://localhost:3000/api";

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const get = (p, t) => api("GET", p, undefined, t);
const post = (p, t, b) => api("POST", p, b ?? {}, t);
const del = (p, t) => api("DELETE", p, undefined, t);

const roleId = async (name) =>
  (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [name])).rows[0].id;

const mkUser = async (roleName, tag, pwHash) => {
  const username = `zzs${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1, $2, $3, 'HoatDong') RETURNING id`,
    [username, pwHash, await roleId(roleName)]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login?.data?.data?.token };
};

(async () => {
  console.log("=== BẮT ĐẦU KIỂM THỬ C6-07: PHÂN CÔNG LỊCH TRỰC & TỔNG QUAN LỊCH ===");
  const pwHash = await bcrypt.hash("123456", 10);

  // 1. Kiểm tra / khởi động server
  try {
    const probe = await fetch("http://localhost:3000/api/health").catch(() => null);
    if (!probe || !probe.ok) {
      server = app.listen(0);
      const port = server.address().port;
      BASE = `http://localhost:${port}/api`;
      console.log(`Backend in-process đang chạy tại: ${BASE}`);
    } else {
      console.log(`Đang kết nối backend tại: ${BASE}`);
    }
  } catch {
    server = app.listen(0);
    const port = server.address().port;
    BASE = `http://localhost:${port}/api`;
  }

  let adminUser, doctorUser, patientUser, receptionistUser, benhNhanId;
  let testSpecialtyId, testDoctorAId, testDoctorBId, testRoom1Id, testRoom2Id, testLabRoomId;
  const createdScheduleIds = [];
  const createdAppointmentIds = [];
  let originalConfig = [];

  try {
    // 2. Chuẩn bị tài khoản người dùng test
    adminUser = await mkUser("Quản trị viên", "admin", pwHash);
    doctorUser = await mkUser("Bác sĩ", "doc", pwHash);
    patientUser = await mkUser("Bệnh nhân", "pat", pwHash);
    receptionistUser = await mkUser("Lễ tân", "rec", pwHash);

    // Tạo hồ sơ bệnh nhân cho test booking
    const patBnRes = await pool.query(
      `INSERT INTO "BenhNhan" (tai_khoan_id, ho_ten) VALUES ($1, $2) RETURNING id`,
      [patientUser.id, `${TAG} Bệnh nhân`]
    );
    benhNhanId = patBnRes.rows[0].id;

    // Chuẩn bị dữ liệu danh mục test
    const spRes = await pool.query(
      `INSERT INTO "ChuyenKhoa" (ten_chuyen_khoa, mo_ta) VALUES ($1, $2) RETURNING id`,
      [`${TAG} Chuyên Khoa`, "Chuyên khoa phục vụ test C6-07"]
    );
    testSpecialtyId = spRes.rows[0].id;

    const otherSpRes = await pool.query(
      `INSERT INTO "ChuyenKhoa" (ten_chuyen_khoa, mo_ta) VALUES ($1, $2) RETURNING id`,
      [`${TAG} Khác CK`, "Chuyên khoa khác"]
    );
    const otherSpecialtyId = otherSpRes.rows[0].id;

    const docARes = await pool.query(
      `INSERT INTO "BacSi" (ho_ten, cap_bac, muc_phi, chuyen_khoa_id) VALUES ($1, $2, 300000, $3) RETURNING id`,
      [`${TAG} BS Nguyễn Văn A`, "Thạc sĩ, Bác sĩ", testSpecialtyId]
    );
    testDoctorAId = docARes.rows[0].id;

    const docBRes = await pool.query(
      `INSERT INTO "BacSi" (ho_ten, cap_bac, muc_phi, chuyen_khoa_id) VALUES ($1, $2, 350000, $3) RETURNING id`,
      [`${TAG} BS Trần Thị B`, "Bác sĩ CKI", testSpecialtyId]
    );
    testDoctorBId = docBRes.rows[0].id;

    const room1Res = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong, chuyen_khoa_id) VALUES ($1, 'Phòng khám', $2) RETURNING id`,
      [`${TAG} Phòng 1`, testSpecialtyId]
    );
    testRoom1Id = room1Res.rows[0].id;

    const room2Res = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong, chuyen_khoa_id) VALUES ($1, 'Phòng khám', $2) RETURNING id`,
      [`${TAG} Phòng 2`, testSpecialtyId]
    );
    testRoom2Id = room2Res.rows[0].id;

    const labRoomRes = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong) VALUES ($1, 'Phòng xét nghiệm') RETURNING id`,
      [`${TAG} Phòng XN`]
    );
    testLabRoomId = labRoomRes.rows[0].id;

    // Lưu ảnh chụp template khung giờ ban đầu
    originalConfig = (
      await pool.query(`SELECT id, ca, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online FROM "CauHinhKhungGio" ORDER BY gio_bat_dau`)
    ).rows;

    const slot1 = originalConfig[0]; // e.g. 06:00 - 07:00
    const slot2 = originalConfig[1]; // e.g. 07:00 - 08:00
    const slot3 = originalConfig[2]; // e.g. 08:00 - 09:00
    const slot4 = originalConfig[3]; // e.g. 09:00 - 10:00

    const testDate = "2027-02-15"; // Thứ 2

    // -------------------------------------------------------------
    // NHÓM 1: PHÂN QUYỀN (RBAC)
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra phân quyền ---");
    check("GET /api/admin/schedules không token -> 401", (await get("/admin/schedules")).status === 401);
    check("GET /api/admin/schedules Bác sĩ -> 403", (await get("/admin/schedules", doctorUser.token)).status === 403);
    check("GET /api/admin/schedules Bệnh nhân -> 403", (await get("/admin/schedules", patientUser.token)).status === 403);
    check("GET /api/admin/schedules Lễ tân -> 403", (await get("/admin/schedules", receptionistUser.token)).status === 403);
    check("GET /api/admin/schedules Quản trị viên -> 200", (await get("/admin/schedules", adminUser.token)).status === 200);

    check(
      "POST /api/admin/schedules không token -> 401",
      (await post("/admin/schedules", null, { bac_si_id: testDoctorAId, phong_kham_id: testRoom1Id, ngay: testDate, khung_gio_ids: [slot1.id] })).status === 401
    );
    check(
      "POST /api/admin/schedules Bác sĩ -> 403",
      (await post("/admin/schedules", doctorUser.token, { bac_si_id: testDoctorAId, phong_kham_id: testRoom1Id, ngay: testDate, khung_gio_ids: [slot1.id] })).status === 403
    );

    // -------------------------------------------------------------
    // NHÓM 2: VALIDATION ĐẦU VÀO & INVALID RELATIONS
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra validate đầu vào & quan hệ không hợp lệ ---");
    let valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: 999999,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Bác sĩ không tồn tại -> 404 DOCTOR_NOT_FOUND", valRes.status === 404 && valRes.data.code === "DOCTOR_NOT_FOUND");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: 999999,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Phòng không tồn tại -> 404 ROOM_NOT_FOUND", valRes.status === 404 && valRes.data.code === "ROOM_NOT_FOUND");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testLabRoomId,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Phòng xét nghiệm không được phân công khám -> 400 INVALID_ROOM_TYPE", valRes.status === 400 && valRes.data.code === "INVALID_ROOM_TYPE");

    // Tạo phòng khác chuyên khoa
    const otherRoomRes = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong, chuyen_khoa_id) VALUES ($1, 'Phòng khám', $2) RETURNING id`,
      [`${TAG} Phòng Sai CK`, otherSpecialtyId]
    );
    const otherRoomId = otherRoomRes.rows[0].id;
    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: otherRoomId,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Phòng khác chuyên khoa với bác sĩ -> 400 ROOM_SPECIALTY_MISMATCH", valRes.status === 400 && valRes.data.code === "ROOM_SPECIALTY_MISMATCH");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: "2027-02-35",
      khung_gio_ids: [slot1.id],
    });
    check("Ngày không hợp lệ -> 400 INVALID_DATE", valRes.status === 400 && valRes.data.code === "INVALID_DATE");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [],
    });
    check("Danh sách khung giờ rỗng -> 400 MISSING_TIME_SLOTS", valRes.status === 400 && valRes.data.code === "MISSING_TIME_SLOTS");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [999999],
    });
    check("Khung giờ không tồn tại trong CauHinhKhungGio -> 400 INVALID_TIME_SLOT", valRes.status === 400 && valRes.data.code === "INVALID_TIME_SLOT");

    valRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id, slot1.id],
    });
    check("Khung giờ bị trùng trong request -> 400 DUPLICATE_TIME_SLOT_IN_REQUEST", valRes.status === 400 && valRes.data.code === "DUPLICATE_TIME_SLOT_IN_REQUEST");

    // -------------------------------------------------------------
    // NHÓM 3: TẠO LỊCH HỢP LỆ & LẤY CAPACITY TỪ C6-06
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra tạo lịch hợp lệ & capacity từ C6-06 ---");
    let createRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id, slot2.id],
    });
    check("Tạo lịch hợp lệ cho 2 slot -> 201 Created", createRes.status === 201);
    const createdItems = createRes.data?.data?.items || [];
    check("Trả về đúng 2 ca trực", createdItems.length === 2);

    for (const item of createdItems) {
      createdScheduleIds.push(item.id);
      check(`Ca ${item.gio_bat_dau} lưu đúng Doctor ID`, item.bac_si_id === testDoctorAId);
      check(`Ca ${item.gio_bat_dau} lưu đúng Room ID`, item.phong_kham_id === testRoom1Id);
      check(`Ca ${item.gio_bat_dau} lưu đúng Ngày`, item.ngay === testDate);
      check(`Ca ${item.gio_bat_dau} lưu đúng trạng thái HoatDong`, item.trang_thai === "HoatDong");
      check(`Ca ${item.gio_bat_dau} so_slot_da_dat khởi tạo = 0`, item.so_slot_da_dat === 0);

      const matchingTpl = originalConfig.find((c) => c.id === item.id || c.gio_bat_dau.slice(0, 5) === item.gio_bat_dau);
      if (matchingTpl) {
        check(
          `Ca ${item.gio_bat_dau} capacity tối đa khớp CauHinhKhungGio (${matchingTpl.so_slot_toi_da})`,
          item.so_slot_toi_da === matchingTpl.so_slot_toi_da
        );
        check(
          `Ca ${item.gio_bat_dau} capacity online khớp CauHinhKhungGio (${matchingTpl.so_slot_online})`,
          item.so_slot_online === matchingTpl.so_slot_online
        );
      }
    }

    // -------------------------------------------------------------
    // NHÓM 4: CHẶN TRÙNG LỊCH (CONFLICT HANDLING)
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra chặn trùng lịch Bác sĩ & Phòng khám ---");
    // Doctor Conflict: Bác sĩ A đã có lịch lúc slot1 tại testRoom1Id -> thử gán Bác sĩ A tại testRoom2Id lúc slot1
    let conflictRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom2Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Doctor conflict bị chặn -> 409 DOCTOR_CONFLICT", conflictRes.status === 409 && conflictRes.data.code === "DOCTOR_CONFLICT");
    check("Thông báo lỗi rõ ràng cho bác sĩ trùng", (conflictRes.data?.message || "").includes("Bác sĩ đã có lịch trực"));

    // Room Conflict: Phòng 1 đã được gán cho Bác sĩ A lúc slot1 -> thử gán Bác sĩ B vào Phòng 1 lúc slot1
    conflictRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorBId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id],
    });
    check("Room conflict bị chặn -> 409 ROOM_CONFLICT", conflictRes.status === 409 && conflictRes.data.code === "ROOM_CONFLICT");
    check("Thông báo lỗi rõ ràng cho phòng trùng", (conflictRes.data?.message || "").includes("Phòng khám đã được phân công cho bác sĩ khác"));

    // Transaction Rollback (Không tạo nửa chừng):
    // Gửi batch: slot1 (bị conflict) và slot3 (chưa có). Request phải thất bại và slot3 KHÔNG được tạo.
    conflictRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot1.id, slot3.id],
    });
    check("Batch có slot bị trùng -> toàn bộ request bị chặn (409)", conflictRes.status === 409);

    const checkSlot3 = await pool.query(
      `SELECT id FROM "LichKhamBacSi" WHERE bac_si_id = $1 AND ngay = $2 AND gio_bat_dau = $3`,
      [testDoctorAId, testDate, slot3.gio_bat_dau]
    );
    check("Transaction Rollback: slot3 không bị tạo nửa vời", checkSlot3.rowCount === 0);

    // -------------------------------------------------------------
    // NHÓM 5: THAY ĐỔI CẤU HÌNH C6-06 KHÔNG ẢNH HƯỞNG LỊCH CŨ
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra tính độc lập cấu hình C6-06 với lịch cũ ---");
    // Lấy capacity của ca trực slot1 đã tạo ở trên
    const oldScheduleRow = (
      await pool.query(`SELECT so_slot_toi_da, so_slot_online FROM "LichKhamBacSi" WHERE id = $1`, [createdItems[0].id])
    ).rows[0];

    // Cập nhật cấu hình slot4 trong CauHinhKhungGio: 10/7
    const updateConfigRes = await api("PUT", `/admin/time-slots/${slot4.id}`, {
      so_slot_toi_da: 10,
      so_slot_online: 7,
    }, adminUser.token);
    check("Cập nhật template C6-06 thành 10 tối đa / 7 online -> 200", updateConfigRes.status === 200);

    // Kiểm tra lịch cũ (slot1) vẫn giữ nguyên capacity gốc
    const oldScheduleAfter = (
      await pool.query(`SELECT so_slot_toi_da, so_slot_online FROM "LichKhamBacSi" WHERE id = $1`, [createdItems[0].id])
    ).rows[0];
    check("Lịch cũ không bị ghi đè capacity", oldScheduleAfter.so_slot_toi_da === oldScheduleRow.so_slot_toi_da && oldScheduleAfter.so_slot_online === oldScheduleRow.so_slot_online);

    // Tạo lịch mới với slot4 -> phải lấy capacity mới (10 và 7)
    const newSchedRes = await post("/admin/schedules", adminUser.token, {
      bac_si_id: testDoctorAId,
      phong_kham_id: testRoom1Id,
      ngay: testDate,
      khung_gio_ids: [slot4.id],
    });
    check("Tạo lịch mới sau khi đổi cấu hình -> 201 Created", newSchedRes.status === 201);
    const newSchedItem = newSchedRes.data?.data?.items?.[0];
    if (newSchedItem) {
      createdScheduleIds.push(newSchedItem.id);
      check("Lịch mới lấy đúng capacity tối đa mới (10)", newSchedItem.so_slot_toi_da === 10);
      check("Lịch mới lấy đúng capacity online mới (7)", newSchedItem.so_slot_online === 7);
    }

    // Khôi phục template ban đầu của slot4
    await api("PUT", `/admin/time-slots/${slot4.id}`, {
      so_slot_toi_da: slot4.so_slot_toi_da,
      so_slot_online: slot4.so_slot_online,
    }, adminUser.token);

    // -------------------------------------------------------------
    // NHÓM 6: INTEGRATION VỚI PATIENT BOOKING
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra tích hợp Patient Booking ---");
    // Bệnh nhân xem slot khả dụng
    const slotPath = `/slots?bac_si_id=${testDoctorAId}&ngay=${testDate}`;
    const slotsRes = await get(slotPath, patientUser.token);
    check("Patient gọi /api/slots -> 200", slotsRes.status === 200);
    check("Trạng thái ngày khám = CON_SLOT", slotsRes.data?.data?.trang_thai === "CON_SLOT");

    const patientSlots = slotsRes.data?.data?.slots || [];
    check("Tìm thấy các slot vừa tạo cho bác sĩ", patientSlots.length >= 2);

    const targetSlot = patientSlots.find((s) => s.lich_kham_id === createdItems[0].id);
    check("Slot mới tạo có trong danh sách khả dụng", Boolean(targetSlot));
    check("Slot hiển thị đúng tên phòng khám", targetSlot?.ten_phong === `${TAG} Phòng 1`);
    check("Slot có slot_con_lai > 0", (targetSlot?.slot_con_lai || 0) > 0);

    // Bệnh nhân thực hiện đặt lịch khám qua API booking hiện tại
    const bookRes = await post("/appointments", patientUser.token, {
      lich_kham_id: createdItems[0].id,
      trieu_chung: "Kiểm tra tích hợp C6-07",
    });
    check("Patient đặt lịch thành công qua flow hiện tại -> 201 Created", bookRes.status === 201);
    const aptId = bookRes.data?.data?.lich_hen_id || bookRes.data?.data?.id;
    if (aptId) {
      createdAppointmentIds.push(aptId);
    }

    // Kiểm tra so_slot_da_dat trong LichKhamBacSi tăng lên 1
    const bookedScheduleRow = (
      await pool.query(`SELECT so_slot_da_dat FROM "LichKhamBacSi" WHERE id = $1`, [createdItems[0].id])
    ).rows[0];
    check("so_slot_da_dat tăng lên 1 sau khi booking thành công", Number(bookedScheduleRow.so_slot_da_dat) === 1);

    // Thử xóa lịch đã có người đặt -> bị chặn 409
    const delConflictRes = await del(`/admin/schedules/${createdItems[0].id}`, adminUser.token);
    check("Lịch đã có đặt hẹn không được phép xóa -> 409 SCHEDULE_HAS_BOOKINGS", delConflictRes.status === 409 && delConflictRes.data.code === "SCHEDULE_HAS_BOOKINGS");

    // Xóa lịch chưa có người đặt (createdItems[1]) -> thành công 200
    const delOkRes = await del(`/admin/schedules/${createdItems[1].id}`, adminUser.token);
    check("Lịch chưa có đặt hẹn xóa thành công -> 200", delOkRes.status === 200);

    // -------------------------------------------------------------
    // NHÓM 7: ADMIN OVERVIEW (UC-033) & FILTERING
    // -------------------------------------------------------------
    console.log("\n--- Kiểm tra Admin Overview (UC-033) & Bộ lọc ---");
    // Lấy theo tuần chứa testDate
    const overviewWeekRes = await get(`/admin/schedules?start_date=2027-02-15&end_date=2027-02-21`, adminUser.token);
    check("Overview lấy theo tuần -> 200", overviewWeekRes.status === 200);
    const weekItems = overviewWeekRes.data?.data?.items || [];
    check("Overview hiển thị ca trực vừa tạo", weekItems.some((i) => i.id === createdItems[0].id));

    // Lấy theo ngày cụ thể
    const overviewDayRes = await get(`/admin/schedules?date=${testDate}`, adminUser.token);
    check("Overview lấy theo ngày -> 200", overviewDayRes.status === 200);
    const dayItems = overviewDayRes.data?.data?.items || [];
    check("Lọc đúng theo ngày testDate", dayItems.every((i) => i.ngay === testDate));

    // Lọc theo Bác sĩ
    const filterDocRes = await get(`/admin/schedules?start_date=2027-02-15&end_date=2027-02-21&bac_si_id=${testDoctorAId}`, adminUser.token);
    check("Lọc theo bác sĩ thành công", filterDocRes.status === 200 && filterDocRes.data?.data?.items?.every((i) => i.bac_si_id === testDoctorAId));

    // Lọc theo Chuyên khoa
    const filterSpRes = await get(`/admin/schedules?start_date=2027-02-15&end_date=2027-02-21&chuyen_khoa_id=${testSpecialtyId}`, adminUser.token);
    check("Lọc theo chuyên khoa thành công", filterSpRes.status === 200 && filterSpRes.data?.data?.items?.every((i) => i.chuyen_khoa?.id === testSpecialtyId));

    // Lọc theo Phòng
    const filterRoomRes = await get(`/admin/schedules?start_date=2027-02-15&end_date=2027-02-21&phong_kham_id=${testRoom1Id}`, adminUser.token);
    check("Lọc theo phòng thành công", filterRoomRes.status === 200 && filterRoomRes.data?.data?.items?.every((i) => i.phong_kham_id === testRoom1Id));

    // Lọc không có dữ liệu -> trả danh sách rỗng
    const emptyRes = await get(`/admin/schedules?start_date=2099-01-01&end_date=2099-01-07`, adminUser.token);
    check("Không có lịch -> trả danh sách rỗng items: []", emptyRes.status === 200 && Array.isArray(emptyRes.data?.data?.items) && emptyRes.data.data.items.length === 0);

    // Kiểm tra đủ trường theo yêu cầu UC-033
    const sampleItem = weekItems.find((i) => i.id === createdItems[0].id);
    if (sampleItem) {
      check("Overview có trường id", Boolean(sampleItem.id));
      check("Overview có trường bác sĩ", Boolean(sampleItem.bac_si?.ho_ten));
      check("Overview có trường chuyên khoa", Boolean(sampleItem.chuyen_khoa?.ten_chuyen_khoa));
      check("Overview có trường phòng khám", Boolean(sampleItem.phong_kham?.ten_phong));
      check("Overview có trường ngày", sampleItem.ngay === testDate);
      check("Overview có giờ bắt đầu & kết thúc", Boolean(sampleItem.gio_bat_dau && sampleItem.gio_ket_thuc));
      check("Overview có so_slot_toi_da", typeof sampleItem.so_slot_toi_da === "number");
      check("Overview có so_slot_online", typeof sampleItem.so_slot_online === "number");
      check("Overview có so_slot_da_dat", typeof sampleItem.so_slot_da_dat === "number");
      check("Overview có trang_thai", Boolean(sampleItem.trang_thai));
    }
  } catch (err) {
    console.error("LỖI NGOẠI LỆ KHI CHẠY TEST:", err);
    fail++;
  } finally {
    // -------------------------------------------------------------
    // DỌN DẸP DỮ LIỆU TEST
    // -------------------------------------------------------------
    console.log("\n--- Dọn dẹp dữ liệu test ---");
    try {
      if (createdAppointmentIds.length > 0) {
        await pool.query(`DELETE FROM "DatLichKham" WHERE id = ANY($1::int[])`, [createdAppointmentIds]);
      }
      await pool.query(
        `DELETE FROM "DatLichKham" WHERE benh_nhan_id = $1 OR bac_si_id IN ($2, $3)`,
        [benhNhanId || 0, testDoctorAId || 0, testDoctorBId || 0]
      );
      if (createdScheduleIds.length > 0) {
        await pool.query(`DELETE FROM "LichKhamBacSi" WHERE id = ANY($1::int[])`, [createdScheduleIds]);
      }
      await pool.query(`DELETE FROM "LichKhamBacSi" WHERE ngay = '2027-02-15'`);
      if (testDoctorAId || testDoctorBId) {
        await pool.query(`DELETE FROM "BacSi" WHERE id IN ($1, $2)`, [testDoctorAId || 0, testDoctorBId || 0]);
      }
      if (testRoom1Id || testRoom2Id || testLabRoomId) {
        await pool.query(`DELETE FROM "PhongKham" WHERE id IN ($1, $2, $3)`, [testRoom1Id || 0, testRoom2Id || 0, testLabRoomId || 0]);
      }
      await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE '${TAG}%'`);
      if (testSpecialtyId) {
        await pool.query(`DELETE FROM "ChuyenKhoa" WHERE ten_chuyen_khoa LIKE '${TAG}%'`);
      }
      await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE '${TAG}%'`);
      await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE 'zzs${sfx}%'`);

      // Khôi phục toàn bộ cấu hình khung giờ ban đầu nếu bị lệch
      if (originalConfig.length > 0) {
        for (const c of originalConfig) {
          await pool.query(
            `UPDATE "CauHinhKhungGio" SET so_slot_toi_da = $1, so_slot_online = $2 WHERE id = $3`,
            [c.so_slot_toi_da, c.so_slot_online, c.id]
          );
        }
      }
      console.log("Đã dọn dẹp sạch dữ liệu test.");
    } catch (cleanupErr) {
      console.error("Lỗi khi dọn dẹp test:", cleanupErr);
    }

    if (server) {
      server.close();
    }
  }

  console.log(`\n=== KẾT QUẢ TEST C6-07: ${pass} PASS, ${fail} FAIL ===`);
  pool.end();
  process.exit(fail === 0 ? 0 : 1);
})();
