// C6-08 - Doctor Schedule, Shift Patients & Resume Examination
// Chạy: npm run api:test-c6-08
// Tạo fixture riêng, kiểm thử ownership/date/room/status và tự dọn sau khi chạy.

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const app = require("../src/app");
const { getWeekRange } = require("../src/controllers/adminSchedule.controller");

const suffix = Date.now().toString().slice(-7);
const tag = `ZC608${suffix}`;
let pass = 0;
let fail = 0;
let server = null;
let base = "http://localhost:3000/api";
const ids = {
  accounts: [],
  doctors: [],
  rooms: [],
  specialties: [],
  patients: [],
  schedules: [],
  queues: [],
  records: [],
};

const check = (label, condition) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
};

const api = async (method, path, body, token) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

const get = (path, token) => api("GET", path, undefined, token);
const addDays = (date, amount) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};

const createUser = async (tagName, roleName, passwordHash) => {
  const role = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [roleName]);
  const username = `${tag.toLowerCase()}_${tagName}`;
  const account = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai)
     VALUES ($1, $2, $3, 'HoatDong') RETURNING id`,
    [username, passwordHash, role.rows[0].id]
  );
  ids.accounts.push(account.rows[0].id);
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: account.rows[0].id, token: login.data?.data?.token };
};

const createDoctor = async (user, name, specialtyId) => {
  const doctor = await pool.query(
    `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, cap_bac, muc_phi, chuyen_khoa_id)
     VALUES ($1, $2, 'Bác sĩ kiểm thử', 0, $3) RETURNING id`,
    [user.id, `${tag} ${name}`, specialtyId]
  );
  ids.doctors.push(doctor.rows[0].id);
  return doctor.rows[0].id;
};

const createPatient = async (name) => {
  const patient = await pool.query(
    `INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`,
    [`${tag} ${name}`]
  );
  ids.patients.push(patient.rows[0].id);
  return patient.rows[0].id;
};

const createQueue = async ({ patientId, doctorId, roomId, status, number }) => {
  const result = await pool.query(
    `INSERT INTO "HangDoi"
       (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai)
     VALUES ($1, $2, $3, $4, 'OFFLINE', $5) RETURNING id`,
    [patientId, number, roomId, doctorId, status]
  );
  ids.queues.push(result.rows[0].id);
  return result.rows[0].id;
};

(async () => {
  const passwordHash = await bcrypt.hash("123456", 10);
  try {
    const probe = await fetch("http://localhost:3000/api/health").catch(() => null);
    if (!probe || !probe.ok) {
      server = app.listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      base = `http://localhost:${server.address().port}/api`;
    }

    const dayResult = await pool.query(
      `SELECT to_char((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS today`
    );
    const today = dayResult.rows[0].today;
    const week = getWeekRange(today);
    const specialty = await pool.query(
      `INSERT INTO "ChuyenKhoa" (ten_chuyen_khoa, mo_ta)
       VALUES ($1, 'C6-08 test') RETURNING id`,
      [`${tag} Chuyên khoa`]
    );
    const specialtyId = specialty.rows[0].id;
    ids.specialties.push(specialtyId);

    const roomA = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong, chuyen_khoa_id)
       VALUES ($1, 'Phòng khám', $2) RETURNING id`,
      [`${tag} Phòng A`, specialtyId]
    );
    const roomB = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, loai_phong, chuyen_khoa_id)
       VALUES ($1, 'Phòng khám', $2) RETURNING id`,
      [`${tag} Phòng B`, specialtyId]
    );
    ids.rooms.push(roomA.rows[0].id, roomB.rows[0].id);

    const doctorAUser = await createUser("doctor_a", "Bác sĩ", passwordHash);
    const doctorBUser = await createUser("doctor_b", "Bác sĩ", passwordHash);
    const otherUser = await createUser("patient", "Bệnh nhân", passwordHash);
    const doctorAId = await createDoctor(doctorAUser, "Bác sĩ A", specialtyId);
    const doctorBId = await createDoctor(doctorBUser, "Bác sĩ B", specialtyId);

    for (const [doctorId, roomId] of [[doctorAId, ids.rooms[0]], [doctorBId, ids.rooms[1]]]) {
      const schedule = await pool.query(
        `INSERT INTO "LichKhamBacSi"
           (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc,
            so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
         VALUES ($1, $2, $3, '00:00', '23:59', 10, 5, 0, 'HoatDong')
         RETURNING id`,
        [doctorId, roomId, today]
      );
      ids.schedules.push(schedule.rows[0].id);
    }

    const patientWaiting = await createPatient("Chờ khám");
    const patientActive = await createPatient("Đang khám");
    const patientDone = await createPatient("Đã xong");
    const patientOtherRoom = await createPatient("Phòng khác");
    const patientOtherDay = await createPatient("Ngày khác");
    const waitingQueueId = await createQueue({
      patientId: patientWaiting,
      doctorId: null,
      roomId: ids.rooms[0],
      status: "CHO_KHAM",
      number: 1,
    });
    const activeQueueId = await createQueue({
      patientId: patientActive,
      doctorId: doctorAId,
      roomId: ids.rooms[0],
      status: "DANG_KHAM",
      number: 2,
    });
    await createQueue({
      patientId: patientDone,
      doctorId: doctorAId,
      roomId: ids.rooms[0],
      status: "DA_XONG",
      number: 3,
    });
    await createQueue({
      patientId: patientOtherRoom,
      doctorId: null,
      roomId: ids.rooms[1],
      status: "CHO_KHAM",
      number: 4,
    });
    const otherDayQueueId = await createQueue({
      patientId: patientOtherDay,
      doctorId: null,
      roomId: ids.rooms[0],
      status: "CHO_KHAM",
      number: 5,
    });
    await pool.query(
      `UPDATE "HangDoi"
       SET thoi_gian_check_in =
         (((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1 + TIME '12:00')
           AT TIME ZONE 'Asia/Ho_Chi_Minh')
       WHERE id = $1`,
      [otherDayQueueId]
    );
    const activeRecord = await pool.query(
      `INSERT INTO "HoSoBenhAn"
         (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1, $2, $3, $4, 'DANG_KHAM') RETURNING id`,
      [activeQueueId, patientActive, doctorAId, today]
    );
    ids.records.push(activeRecord.rows[0].id);

    check("Doctor API yêu cầu đăng nhập", (await get("/doctor/schedules")).status === 401);
    check(
      "Tài khoản không phải bác sĩ bị từ chối",
      (await get("/doctor/schedules", otherUser.token)).status === 403
    );

    const scheduleResponse = await get(
      `/doctor/schedules?start_date=${week.startDate}&end_date=${week.endDate}&bac_si_id=${doctorBId}`,
      doctorAUser.token
    );
    const schedules = scheduleResponse.data?.data?.items || [];
    check(
      "Bác sĩ chỉ thấy lịch của mình dù request gửi bac_si_id bác sĩ khác",
      scheduleResponse.status === 200 &&
        schedules.length === 1 &&
        schedules[0].bac_si_id === doctorAId &&
        schedules[0].ngay === today &&
        schedules[0].phong_kham?.ten_phong === `${tag} Phòng A`
    );
    check(
      "Khoảng tuần không hợp lệ bị từ chối",
      (await get(`/doctor/schedules?start_date=${week.startDate}&end_date=${today}`, doctorAUser.token)).status === 400
    );
    check(
      "start_date không phải Thứ 2 bị từ chối",
      (await get(`/doctor/schedules?start_date=${addDays(week.startDate, 1)}`, doctorAUser.token)).status === 400
    );
    const previousWeek = await get(
      `/doctor/schedules?start_date=${addDays(week.startDate, -7)}`,
      doctorAUser.token
    );
    const nextWeek = await get(
      `/doctor/schedules?start_date=${addDays(week.startDate, 7)}`,
      doctorAUser.token
    );
    check(
      "Chuyển tuần trước/sau và tuần trống trả danh sách rỗng",
      previousWeek.status === 200 &&
        previousWeek.data?.data?.items?.length === 0 &&
        previousWeek.data.data.end_date === addDays(week.startDate, -1) &&
        nextWeek.status === 200 &&
        nextWeek.data?.data?.items?.length === 0 &&
        nextWeek.data.data.start_date === addDays(week.startDate, 7)
    );

    const waiting = await get("/doctor/patients?status=CHO_KHAM", doctorAUser.token);
    check(
      "Lọc CHO_KHAM đúng phòng và nhận lượt chưa gán bác sĩ",
      waiting.status === 200 &&
        waiting.data?.data?.items?.length === 1 &&
        waiting.data.data.items[0].hang_doi_id === waitingQueueId
    );
    const active = await get("/doctor/patients?status=DANG_KHAM", doctorAUser.token);
    check(
      "Lọc DANG_KHAM và trả hồ sơ để tiếp tục",
      active.status === 200 &&
        active.data?.data?.items?.length === 1 &&
        active.data.data.items[0].ho_so_id === activeRecord.rows[0].id &&
        active.data.data.current_examination?.ho_so_id === activeRecord.rows[0].id
    );
    const done = await get("/doctor/patients?status=DA_XONG", doctorAUser.token);
    check("Lọc DA_XONG đúng", done.status === 200 && done.data?.data?.items?.length === 1);
    check(
      "Từ chối trạng thái ngoài contract",
      (await get("/doctor/patients?status=BO_LUOT", doctorAUser.token)).status === 400
    );

    const duplicatePatient = await createPatient("Hồ sơ đang khám thứ hai");
    const duplicateQueueId = await createQueue({
      patientId: duplicatePatient,
      doctorId: doctorAId,
      roomId: ids.rooms[0],
      status: "DANG_KHAM",
      number: 6,
    });
    const duplicateRecord = await pool.query(
      `INSERT INTO "HoSoBenhAn"
         (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1, $2, $3, $4, 'DANG_KHAM') RETURNING id`,
      [duplicateQueueId, duplicatePatient, doctorAId, today]
    );
    ids.records.push(duplicateRecord.rows[0].id);
    const conflict = await get("/doctor/patients?status=CHO_KHAM", doctorAUser.token);
    check(
      "Không tự chọn ngẫu nhiên khi có nhiều hồ sơ DANG_KHAM",
      conflict.status === 200 && conflict.data?.data?.current_examination_conflict === true &&
        conflict.data.data.current_examination === null
    );
  } catch (err) {
    console.error("Lỗi ngoại lệ khi chạy test C6-08:", err);
    fail++;
  } finally {
    try {
      if (ids.records.length) {
        await pool.query(`DELETE FROM "HoSoBenhAn" WHERE id = ANY($1::int[])`, [ids.records]);
      }
      if (ids.queues.length) {
        await pool.query(`DELETE FROM "HangDoi" WHERE id = ANY($1::int[])`, [ids.queues]);
      }
      if (ids.schedules.length) {
        await pool.query(`DELETE FROM "LichKhamBacSi" WHERE id = ANY($1::int[])`, [ids.schedules]);
      }
      if (ids.patients.length) {
        await pool.query(`DELETE FROM "BenhNhan" WHERE id = ANY($1::int[])`, [ids.patients]);
      }
      if (ids.doctors.length) {
        await pool.query(`DELETE FROM "BacSi" WHERE id = ANY($1::int[])`, [ids.doctors]);
      }
      if (ids.rooms.length) {
        await pool.query(`DELETE FROM "PhongKham" WHERE id = ANY($1::int[])`, [ids.rooms]);
      }
      if (ids.specialties.length) {
        await pool.query(`DELETE FROM "ChuyenKhoa" WHERE id = ANY($1::int[])`, [ids.specialties]);
      }
      if (ids.accounts.length) {
        await pool.query(`DELETE FROM "TaiKhoan" WHERE id = ANY($1::int[])`, [ids.accounts]);
      }
    } catch (err) {
      console.error("Lỗi dọn dẹp test C6-08:", err);
      fail++;
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  console.log(`\n=== KẾT QUẢ TEST C6-08: ${pass} PASS, ${fail} FAIL ===`);
  process.exit(fail === 0 ? 0 : 1);
})();
