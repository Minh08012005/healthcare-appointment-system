const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const PASSWORD = "123456";
const ACCOUNT = {
  patient: { username: "bn_c3_demo", role: "Bệnh nhân" },
  receptionist: { username: "lt_demo", role: "Lễ tân" },
  doctor: { username: "bs_c3_demo", role: "Bác sĩ" },
};

const SPECIALTY_NAME = "Nội tổng quát";
const ROOM_NAME = "Phòng C3 Demo";
const DOCTOR_NAME = "BS Demo C3";
const APPOINTMENT = {
  readyA1: "C3DEMO-A1",
  readyA2: "C3DEMO-A2",
  checkin: "C3DEMO-CHECKIN",
};

const PATIENTS = {
  onlineA1: {
    ho_ten: "Nguyễn Văn Demo C3",
    ngay_sinh: "1990-03-01",
    gioi_tinh: "Nam",
    so_cccd_ho_chieu: "C3DEMOONLINE001",
    dia_chi: "Hà Nội",
  },
  onlineA2: {
    ho_ten: "Demo C3 Online Hai",
    ngay_sinh: "1992-03-02",
    gioi_tinh: "Nữ",
    so_cccd_ho_chieu: "C3DEMOONLINE002",
    dia_chi: "Hà Nội",
  },
  onlineCheckin: {
    ho_ten: "Demo C3 Online Check-in",
    ngay_sinh: "1993-03-05",
    gioi_tinh: "Nam",
    so_cccd_ho_chieu: "C3DEMOONLINE003",
    dia_chi: "Hà Nội",
  },
  offlineB1: {
    ho_ten: "Demo C3 Offline Một",
    ngay_sinh: "1988-03-03",
    gioi_tinh: "Nam",
    so_cccd_ho_chieu: "C3DEMOOFFLINE001",
    dia_chi: "Hà Nội",
    trieu_chung: "Đau đầu, chóng mặt",
  },
  offlineB2: {
    ho_ten: "Demo C3 Offline Hai",
    ngay_sinh: "1995-03-04",
    gioi_tinh: "Nữ",
    so_cccd_ho_chieu: "C3DEMOOFFLINE002",
    dia_chi: "Hà Nội",
    trieu_chung: "Ho kéo dài",
  },
};

const upsertAccount = async (client, username, roleId, passwordHash) => {
  const existing = await client.query(
    `SELECT tk.id, vt.ten_vai_tro
     FROM "TaiKhoan" tk
     JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
     WHERE tk.ten_dang_nhap = $1`,
    [username],
  );
  if (
    existing.rowCount > 0 &&
    existing.rows[0].ten_vai_tro !==
      Object.values(ACCOUNT).find((a) => a.username === username).role
  ) {
    throw new Error(
      `Tài khoản ${username} đã tồn tại với vai trò ${existing.rows[0].ten_vai_tro}`,
    );
  }
  if (existing.rowCount > 0 && username === ACCOUNT.patient.username) {
    const profile = await client.query(
      `SELECT so_cccd_ho_chieu FROM "BenhNhan" WHERE tai_khoan_id = $1`,
      [existing.rows[0].id],
    );
    if (
      profile.rowCount > 0 &&
      profile.rows[0].so_cccd_ho_chieu !== PATIENTS.onlineA1.so_cccd_ho_chieu
    ) {
      throw new Error(`Tài khoản ${username} không thuộc fixture C3 demo`);
    }
  }
  if (existing.rowCount > 0 && username === ACCOUNT.doctor.username) {
    const profile = await client.query(
      `SELECT ho_ten FROM "BacSi" WHERE tai_khoan_id = $1`,
      [existing.rows[0].id],
    );
    if (profile.rowCount > 0 && profile.rows[0].ho_ten !== DOCTOR_NAME) {
      throw new Error(`Tài khoản ${username} không thuộc fixture C3 demo`);
    }
  }

  const result = await client.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai)
     VALUES ($1, $2, $3, 'HoatDong')
     ON CONFLICT (ten_dang_nhap) DO UPDATE
       SET mat_khau = EXCLUDED.mat_khau,
           vai_tro_id = EXCLUDED.vai_tro_id,
           trang_thai = 'HoatDong'
     RETURNING id`,
    [username, passwordHash, roleId],
  );
  return result.rows[0].id;
};

const upsertPatient = async (client, data, accountId = null) => {
  const found = await client.query(
    `SELECT id, tai_khoan_id, so_cccd_ho_chieu
     FROM "BenhNhan"
     WHERE so_cccd_ho_chieu = $1 OR ($2::int IS NOT NULL AND tai_khoan_id = $2)`,
    [data.so_cccd_ho_chieu, accountId],
  );
  if (found.rowCount > 1) {
    throw new Error(
      `Dữ liệu bệnh nhân demo bị trùng: ${data.so_cccd_ho_chieu}`,
    );
  }
  if (
    found.rowCount === 1 &&
    ((accountId &&
      ((found.rows[0].tai_khoan_id &&
        found.rows[0].tai_khoan_id !== accountId) ||
        found.rows[0].so_cccd_ho_chieu !== data.so_cccd_ho_chieu)) ||
      (!accountId && found.rows[0].tai_khoan_id))
  ) {
    throw new Error(
      `CCCD ${data.so_cccd_ho_chieu} đang gắn với tài khoản khác`,
    );
  }

  if (found.rowCount === 1) {
    const updated = await client.query(
      `UPDATE "BenhNhan"
       SET tai_khoan_id = COALESCE($2, tai_khoan_id),
           ho_ten = $3,
           ngay_sinh = $4::date,
           gioi_tinh = $5,
           so_cccd_ho_chieu = $6,
           dia_chi = $7
       WHERE id = $1
       RETURNING id`,
      [
        found.rows[0].id,
        accountId,
        data.ho_ten,
        data.ngay_sinh,
        data.gioi_tinh,
        data.so_cccd_ho_chieu,
        data.dia_chi,
      ],
    );
    return updated.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO "BenhNhan"
       (tai_khoan_id, ho_ten, ngay_sinh, gioi_tinh, so_cccd_ho_chieu, dia_chi)
     VALUES ($1, $2, $3::date, $4, $5, $6)
     RETURNING id`,
    [
      accountId,
      data.ho_ten,
      data.ngay_sinh,
      data.gioi_tinh,
      data.so_cccd_ho_chieu,
      data.dia_chi,
    ],
  );
  return inserted.rows[0].id;
};

const createOfflineMedicalRecord = async (
  client,
  queueId,
  patientId,
  doctorId,
  symptoms,
) => {
  const record = await client.query(
    `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
     VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'CHO_KHAM')
     RETURNING id`,
    [queueId, patientId, doctorId],
  );
  await client.query(
    `INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan) VALUES ($1, $2)`,
    [record.rows[0].id, symptoms],
  );
};

async function seedC3Demo() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026110310)");

    const clock = await client.query(
      `SELECT to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI:SS') AS gio_vn`,
    );
    if (clock.rows[0].gio_vn >= "23:45:00") {
      throw new Error(
        "Không seed C3 demo sau 23:45 giờ Việt Nam; hãy chạy lại vào ngày hôm sau.",
      );
    }

    const migrationCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'HangDoi'
           AND column_name = 'thoi_gian_goi_gan_nhat'
       ) AS c3_09_ready`,
    );
    if (!migrationCheck.rows[0].c3_09_ready) {
      throw new Error(
        "Thiếu migration C3-09. Chạy npm run db:migrate:c3-09 trước.",
      );
    }

    const roleNames = Object.values(ACCOUNT).map((item) => item.role);
    const roleResult = await client.query(
      `SELECT id, ten_vai_tro FROM "VaiTro" WHERE ten_vai_tro = ANY($1::text[])`,
      [roleNames],
    );
    const roleIds = new Map(
      roleResult.rows.map((row) => [row.ten_vai_tro, row.id]),
    );
    const missingRoles = roleNames.filter((role) => !roleIds.has(role));
    if (missingRoles.length > 0) {
      throw new Error(
        `Thiếu vai trò: ${missingRoles.join(", ")}. Chạy npm run db:seed trước.`,
      );
    }

    const config = await client.query(
      `SELECT id, ti_le_online, ti_le_offline, checkin_som_nhat_phut,
              checkin_toi_thieu_phut, so_lan_goi_toi_da,
              khoang_cach_goi_phut, chu_ky_quet_phut
       FROM "CauHinhHeThong" ORDER BY id`,
    );
    if (config.rowCount > 1) {
      throw new Error(
        "CauHinhHeThong có nhiều hơn một dòng; dừng để tránh dùng nhầm cấu hình.",
      );
    }
    if (config.rowCount === 0) {
      await client.query(
        `INSERT INTO "CauHinhHeThong"
           (ti_le_online, ti_le_offline, checkin_som_nhat_phut, checkin_toi_thieu_phut,
            so_lan_goi_toi_da, khoang_cach_goi_phut, chu_ky_quet_phut)
         VALUES (1, 1, 60, 10, 3, 1, 1)`,
      );
    } else {
      const values = config.rows[0];
      const expected = [1, 1, 60, 10, 3, 1, 1];
      const actual = [
        values.ti_le_online,
        values.ti_le_offline,
        values.checkin_som_nhat_phut,
        values.checkin_toi_thieu_phut,
        values.so_lan_goi_toi_da,
        values.khoang_cach_goi_phut,
        values.chu_ky_quet_phut,
      ].map(Number);
      if (actual.some((value, index) => value !== expected[index])) {
        throw new Error(
          "Cấu hình C3 phải là 1:1, check-in 60/10, recall 3 lần/1 phút, chu kỳ 1 phút.",
        );
      }
    }

    const specialty = await client.query(
      `SELECT id FROM "ChuyenKhoa" WHERE ten_chuyen_khoa = $1 ORDER BY id`,
      [SPECIALTY_NAME],
    );
    if (specialty.rowCount !== 1) {
      throw new Error(
        `Cần đúng một chuyên khoa '${SPECIALTY_NAME}'. Chạy npm run db:seed và kiểm tra dữ liệu trùng.`,
      );
    }
    const specialtyId = specialty.rows[0].id;

    const roomResult = await client.query(
      `SELECT id FROM "PhongKham" WHERE ten_phong = $1 ORDER BY id`,
      [ROOM_NAME],
    );
    if (roomResult.rowCount > 1) {
      throw new Error(`Có nhiều phòng trùng tên '${ROOM_NAME}'`);
    }
    let roomId;
    if (roomResult.rowCount === 0) {
      roomId = (
        await client.query(
          `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong)
           VALUES ($1, $2, 'Phòng khám') RETURNING id`,
          [ROOM_NAME, specialtyId],
        )
      ).rows[0].id;
    } else {
      roomId = roomResult.rows[0].id;
      await client.query(
        `UPDATE "PhongKham" SET chuyen_khoa_id = $2, loai_phong = 'Phòng khám' WHERE id = $1`,
        [roomId, specialtyId],
      );
    }

    const patientAccountId = await upsertAccount(
      client,
      ACCOUNT.patient.username,
      roleIds.get(ACCOUNT.patient.role),
      passwordHash,
    );
    await upsertAccount(
      client,
      ACCOUNT.receptionist.username,
      roleIds.get(ACCOUNT.receptionist.role),
      passwordHash,
    );
    const doctorAccountId = await upsertAccount(
      client,
      ACCOUNT.doctor.username,
      roleIds.get(ACCOUNT.doctor.role),
      passwordHash,
    );

    const doctorResult = await client.query(
      `SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`,
      [doctorAccountId],
    );
    let doctorId;
    if (doctorResult.rowCount === 0) {
      doctorId = (
        await client.query(
          `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac)
           VALUES ($1, $2, $3, 300000, 'Bác sĩ demo') RETURNING id`,
          [doctorAccountId, DOCTOR_NAME, specialtyId],
        )
      ).rows[0].id;
    } else {
      doctorId = doctorResult.rows[0].id;
      await client.query(
        `UPDATE "BacSi"
         SET ho_ten = $2, chuyen_khoa_id = $3, muc_phi = 300000, cap_bac = 'Bác sĩ demo'
         WHERE id = $1`,
        [doctorId, DOCTOR_NAME, specialtyId],
      );
    }

    const patientIds = {
      onlineA1: await upsertPatient(
        client,
        PATIENTS.onlineA1,
        patientAccountId,
      ),
      onlineA2: await upsertPatient(client, PATIENTS.onlineA2),
      onlineCheckin: await upsertPatient(client, PATIENTS.onlineCheckin),
      offlineB1: await upsertPatient(client, PATIENTS.offlineB1),
      offlineB2: await upsertPatient(client, PATIENTS.offlineB2),
    };
    const allPatientIds = Object.values(patientIds);
    const foreignQueue = await client.query(
      `SELECT h.id
       FROM "HangDoi" h
       WHERE h.phong_kham_id = $1
         AND (h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
             = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         AND NOT (h.benh_nhan_id = ANY($2::int[]))
       LIMIT 1`,
      [roomId, allPatientIds],
    );
    if (foreignQueue.rowCount > 0) {
      throw new Error(
        `Phòng '${ROOM_NAME}' đang có queue hôm nay ngoài fixture C3 demo`,
      );
    }

    const oldAppointments = await client.query(
      `SELECT id FROM "DatLichKham"
       WHERE benh_nhan_id = ANY($1::int[]) OR ma_dat_lich = ANY($2::text[])`,
      [allPatientIds, Object.values(APPOINTMENT)],
    );
    const oldAppointmentIds = oldAppointments.rows.map((row) => row.id);
    const oldQueues = await client.query(
      `SELECT id FROM "HangDoi"
       WHERE benh_nhan_id = ANY($1::int[])
          OR dat_lich_id = ANY($2::int[])`,
      [allPatientIds, oldAppointmentIds],
    );
    const oldQueueIds = oldQueues.rows.map((row) => row.id);
    const oldMedicalRecords = await client.query(
      `SELECT id FROM "HoSoBenhAn"
       WHERE benh_nhan_id = ANY($1::int[])
          OR hang_doi_id = ANY($2::int[])`,
      [allPatientIds, oldQueueIds],
    );
    const oldMedicalRecordIds = oldMedicalRecords.rows.map((row) => row.id);

    await client.query(
      `DELETE FROM "KetQuaXetNghiem"
       WHERE chi_dinh_id IN (
         SELECT id FROM "ChiDinhXetNghiem" WHERE ho_so_id = ANY($1::int[])
       )`,
      [oldMedicalRecordIds],
    );
    await client.query(
      `DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id = ANY($1::int[])`,
      [oldMedicalRecordIds],
    );
    await client.query(
      `DELETE FROM "KetQuaKham" WHERE ho_so_id = ANY($1::int[])`,
      [oldMedicalRecordIds],
    );
    await client.query(`DELETE FROM "HoSoBenhAn" WHERE id = ANY($1::int[])`, [
      oldMedicalRecordIds,
    ]);
    await client.query(`DELETE FROM "HangDoi" WHERE id = ANY($1::int[])`, [
      oldQueueIds,
    ]);
    await client.query(`DELETE FROM "DatLichKham" WHERE id = ANY($1::int[])`, [
      oldAppointmentIds,
    ]);
    await client.query(
      `DELETE FROM "LichKhamBacSi" WHERE bac_si_id = $1 AND phong_kham_id = $2`,
      [doctorId, roomId],
    );

    const anchorSchedule = await client.query(
      `WITH vn AS (SELECT NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS now_vn)
       INSERT INTO "LichKhamBacSi"
         (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc,
          so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       SELECT $1, $2, now_vn::date,
              date_trunc('hour', now_vn)::time,
              CASE
                WHEN now_vn::time >= TIME '23:00' THEN TIME '23:59:59.999999'
                ELSE (date_trunc('hour', now_vn) + INTERVAL '1 hour')::time
              END,
              6, 4, 2, 'HoatDong'
       FROM vn
       RETURNING id, ngay::text, gio_bat_dau::text`,
      [doctorId, roomId],
    );
    const anchor = anchorSchedule.rows[0];

    const checkinSchedule = await client.query(
      `WITH vn AS (
         SELECT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '20 minutes' AS appointment_at
       )
       INSERT INTO "LichKhamBacSi"
         (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc,
          so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       SELECT $1, $2, appointment_at::date, appointment_at::time,
              CASE
                WHEN appointment_at::time >= TIME '23:00' THEN TIME '23:59:59.999999'
                ELSE (appointment_at + INTERVAL '1 hour')::time
              END,
              6, 4, 1, 'HoatDong'
       FROM vn
       RETURNING id, ngay::text, gio_bat_dau::text`,
      [doctorId, roomId],
    );
    const checkinSlot = checkinSchedule.rows[0];

    const readyAppointments = await client.query(
      `INSERT INTO "DatLichKham"
         (ma_dat_lich, benh_nhan_id, bac_si_id, phong_kham_id, chuyen_khoa_id,
          ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai, qr_code)
       VALUES
         ($1::text, $3, $5, $6, $7, $8::date, $9::time, 'Khám tổng quát demo A1', 300000, 'DA_CHECK_IN', $1::text),
         ($2::text, $4, $5, $6, $7, $8::date, $9::time, 'Khám tổng quát demo A2', 300000, 'DA_CHECK_IN', $2::text)
       RETURNING id, ma_dat_lich`,
      [
        APPOINTMENT.readyA1,
        APPOINTMENT.readyA2,
        patientIds.onlineA1,
        patientIds.onlineA2,
        doctorId,
        roomId,
        specialtyId,
        anchor.ngay,
        anchor.gio_bat_dau,
      ],
    );
    const appointmentIds = new Map(
      readyAppointments.rows.map((row) => [row.ma_dat_lich, row.id]),
    );

    await client.query(
      `INSERT INTO "DatLichKham"
         (ma_dat_lich, benh_nhan_id, bac_si_id, phong_kham_id, chuyen_khoa_id,
          ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai, qr_code)
       VALUES ($1::text, $2, $3, $4, $5, $6::date, $7::time,
               'Lịch dùng để manual test Online Check-in', 300000, 'DA_DAT', $1::text)`,
      [
        APPOINTMENT.checkin,
        patientIds.onlineCheckin,
        doctorId,
        roomId,
        specialtyId,
        checkinSlot.ngay,
        checkinSlot.gio_bat_dau,
      ],
    );

    const queues = await client.query(
      `INSERT INTO "HangDoi"
         (dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id,
          loai, trang_thai, thoi_gian_check_in, so_lan_goi, so_lan_bo_luot)
       VALUES
         ($1, $3, 1, $7, $8, 'ONLINE',  'CHO_KHAM', NOW(), 0, 0),
         ($2, $4, 2, $7, $8, 'ONLINE',  'CHO_KHAM', NOW(), 0, 0),
         (NULL, $5, 1, $7, NULL, 'OFFLINE', 'CHO_KHAM', NOW(), 0, 0),
         (NULL, $6, 2, $7, NULL, 'OFFLINE', 'CHO_KHAM', NOW(), 0, 0)
       RETURNING id, loai, so_thu_tu, benh_nhan_id`,
      [
        appointmentIds.get(APPOINTMENT.readyA1),
        appointmentIds.get(APPOINTMENT.readyA2),
        patientIds.onlineA1,
        patientIds.onlineA2,
        patientIds.offlineB1,
        patientIds.offlineB2,
        roomId,
        doctorId,
      ],
    );

    const queueByPatient = new Map(
      queues.rows.map((row) => [row.benh_nhan_id, row.id]),
    );
    await createOfflineMedicalRecord(
      client,
      queueByPatient.get(patientIds.offlineB1),
      patientIds.offlineB1,
      doctorId,
      PATIENTS.offlineB1.trieu_chung,
    );
    await createOfflineMedicalRecord(
      client,
      queueByPatient.get(patientIds.offlineB2),
      patientIds.offlineB2,
      doctorId,
      PATIENTS.offlineB2.trieu_chung,
    );

    await client.query("COMMIT");

    console.log("\nC3 demo seed: PASS");
    console.log(`Phòng: ${ROOM_NAME}`);
    console.log(`Hàng đợi: A1 -> B1 -> A2 -> B2`);
    console.log(
      `Lịch Online Check-in: ${APPOINTMENT.checkin} lúc ${checkinSlot.ngay} ${checkinSlot.gio_bat_dau}`,
    );
    console.log("Tài khoản:");
    console.log(`  Bệnh nhân: ${ACCOUNT.patient.username} / ${PASSWORD}`);
    console.log(`  Lễ tân:    ${ACCOUNT.receptionist.username} / ${PASSWORD}`);
    console.log(`  Bác sĩ:    ${ACCOUNT.doctor.username} / ${PASSWORD}`);
    console.log("Bật ENABLE_C3_BACKGROUND=true để test auto-recall.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C3 demo seed: FAIL -", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedC3Demo();
