const pool = require("../src/config/db");

const EXPECTED_ROLES = [
  "Bệnh nhân",
  "Bác sĩ",
  "Lễ tân",
  "Xét nghiệm",
  "Quản trị viên",
];

const EXPECTED_SPECIALTIES = [
  "Nội tổng quát",
  "Tim mạch",
  "Nhi",
  "Tai Mũi Họng",
];

const EXPECTED_ROOMS = [
  "Phòng 101 - Nội tổng quát",
  "Phòng 102 - Nội tổng quát",
  "Phòng 201 - Tim mạch",
  "Phòng 202 - Tim mạch",
  "Phòng 301 - Nhi",
  "Phòng 401 - Tai Mũi Họng",
];

const EXPECTED_DOCTORS = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Hoàng Cường",
  "Phạm Minh Dũng",
  "Võ Thị Hạnh",
  "Đặng Quốc Khánh",
];

async function verifySeed() {
  console.log("=== BẮT ĐẦU XÁC MINH SEED DATA TRÊN NEON POSTGRESQL ===\n");
  let allPass = true;

  try {
    // 1. Kiểm tra bảng VaiTro
    console.log("1. Kiểm tra bảng \"VaiTro\":");
    const roleRes = await pool.query(`SELECT id, ten_vai_tro FROM "VaiTro" ORDER BY id;`);
    const roles = roleRes.rows;
    console.log(`- Số lượng record: ${roles.length}`);
    roles.forEach((r) => console.log(`  [ID: ${r.id}] ${r.ten_vai_tro}`));

    const roleNames = roles.map((r) => r.ten_vai_tro);
    const uniqueRoleNames = new Set(roleNames);
    const hasRoleDuplicate = roleNames.length !== uniqueRoleNames.size;
    console.log(`- Trùng lặp (Duplicate): ${hasRoleDuplicate ? "CÓ (FAIL)" : "KHÔNG (PASS)"}`);

    const missingRoles = EXPECTED_ROLES.filter((r) => !roleNames.includes(r));
    const extraRoles = roleNames.filter((r) => !EXPECTED_ROLES.includes(r));

    if (missingRoles.length === 0 && !hasRoleDuplicate && roles.length === EXPECTED_ROLES.length) {
      console.log(" [PASS] Bảng VaiTro có đầy đủ 5 vai trò chuẩn và không bị duplicate.\n");
    } else {
      if (missingRoles.length > 0) console.log(` [FAIL] Thiếu vai trò: ${missingRoles.join(", ")}`);
      if (extraRoles.length > 0) console.log(` [CẢNH BÁO] Có vai trò ngoài dự kiến: ${extraRoles.join(", ")}`);
      if (hasRoleDuplicate) console.log(" [FAIL] Phát hiện duplicate trong VaiTro!");
      allPass = false;
    }

    // 2. Kiểm tra bảng ChuyenKhoa
    console.log("2. Kiểm tra bảng \"ChuyenKhoa\":");
    const specialtyRes = await pool.query(`SELECT id, ten_chuyen_khoa, mo_ta FROM "ChuyenKhoa" ORDER BY id;`);
    const specialties = specialtyRes.rows;
    console.log(`- Số lượng record: ${specialties.length}`);
    specialties.forEach((s) => console.log(`  [ID: ${s.id}] ${s.ten_chuyen_khoa} - ${s.mo_ta}`));

    const specialtyNames = specialties.map((s) => s.ten_chuyen_khoa);
    const uniqueSpecialtyNames = new Set(specialtyNames);
    const hasSpecialtyDuplicate = specialtyNames.length !== uniqueSpecialtyNames.size;
    console.log(`- Trùng lặp (Duplicate): ${hasSpecialtyDuplicate ? "CÓ (FAIL)" : "KHÔNG (PASS)"}`);

    const missingSpecialties = EXPECTED_SPECIALTIES.filter((s) => !specialtyNames.includes(s));
    const extraSpecialties = specialtyNames.filter((s) => !EXPECTED_SPECIALTIES.includes(s));

    if (missingSpecialties.length === 0 && !hasSpecialtyDuplicate && specialties.length === EXPECTED_SPECIALTIES.length) {
      console.log(" [PASS] Bảng ChuyenKhoa có đầy đủ 4 chuyên khoa chuẩn và không bị duplicate.\n");
    } else {
      if (missingSpecialties.length > 0) console.log(` [FAIL] Thiếu chuyên khoa: ${missingSpecialties.join(", ")}`);
      if (extraSpecialties.length > 0) console.log(` [CẢNH BÁO] Có chuyên khoa ngoài dự kiến: ${extraSpecialties.join(", ")}`);
      if (hasSpecialtyDuplicate) console.log(" [FAIL] Phát hiện duplicate trong ChuyenKhoa!");
      allPass = false;
    }

    // 3. Kiểm tra bảng PhongKham
    console.log("3. Kiểm tra bảng \"PhongKham\":");
    const roomRes = await pool.query(
      `SELECT p.id, p.ten_phong, p.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "PhongKham" p
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = p.chuyen_khoa_id
       ORDER BY p.id;`
    );
    const rooms = roomRes.rows;
    console.log(`- Số lượng record: ${rooms.length}`);
    rooms.forEach((r) =>
      console.log(`  [ID: ${r.id}] ${r.ten_phong} (Chuyên khoa: ${r.ten_chuyen_khoa || "NULL"})`)
    );

    const roomNames = rooms.map((r) => r.ten_phong);
    const missingRooms = EXPECTED_ROOMS.filter((r) => !roomNames.includes(r));
    const roomsWithoutSpecialty = rooms.filter((r) => r.chuyen_khoa_id === null);
    const hasRoomDuplicate = roomNames.length !== new Set(roomNames).size;

    if (
      rooms.length === EXPECTED_ROOMS.length &&
      missingRooms.length === 0 &&
      roomsWithoutSpecialty.length === 0 &&
      !hasRoomDuplicate
    ) {
      console.log(" [PASS] Bảng PhongKham đủ 6 phòng demo, có chuyên khoa và không duplicate.\n");
    } else {
      if (rooms.length !== EXPECTED_ROOMS.length)
        console.log(` [FAIL] Số phòng khám không đúng ${EXPECTED_ROOMS.length} (hiện tại: ${rooms.length})`);
      if (missingRooms.length > 0) console.log(` [FAIL] Thiếu phòng: ${missingRooms.join(", ")}`);
      if (roomsWithoutSpecialty.length > 0)
        console.log(
          ` [FAIL] Có phòng chưa gán chuyên khoa: ${roomsWithoutSpecialty.map((r) => r.ten_phong).join(", ")}`
        );
      if (hasRoomDuplicate) console.log(" [FAIL] Phát hiện duplicate ten_phong trong PhongKham!");
      allPass = false;
    }

    // 4. Kiểm tra bảng BacSi
    console.log("4. Kiểm tra bảng \"BacSi\":");
    const doctorRes = await pool.query(
      `SELECT b.id, b.ho_ten, b.cap_bac, b.muc_phi, b.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "BacSi" b
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       ORDER BY b.id;`
    );
    const doctors = doctorRes.rows;
    console.log(`- Số lượng record: ${doctors.length}`);
    doctors.forEach((d) =>
      console.log(
        `  [ID: ${d.id}] ${d.ho_ten} | ${d.cap_bac} | Phí: ${d.muc_phi} | Chuyên khoa: ${d.ten_chuyen_khoa || "NULL"}`
      )
    );

    const doctorNames = doctors.map((d) => d.ho_ten);
    const missingDoctors = EXPECTED_DOCTORS.filter((name) => !doctorNames.includes(name));
    const extraDoctors = doctorNames.filter((name) => !EXPECTED_DOCTORS.includes(name));
    const doctorsWithoutSpecialty = doctors.filter((d) => d.chuyen_khoa_id === null);
    const doctorsWithoutRank = doctors.filter((d) => !d.cap_bac || d.cap_bac.trim() === "");
    const doctorsWithoutFee = doctors.filter((d) => d.muc_phi === null || Number(d.muc_phi) <= 0);
    const doctorKeys = doctors.map((d) => `${d.ho_ten}|${d.chuyen_khoa_id}`);
    const hasDoctorDuplicate = doctorKeys.length !== new Set(doctorKeys).size;

    if (
      doctors.length === EXPECTED_DOCTORS.length &&
      missingDoctors.length === 0 &&
      doctorsWithoutSpecialty.length === 0 &&
      doctorsWithoutRank.length === 0 &&
      doctorsWithoutFee.length === 0 &&
      !hasDoctorDuplicate
    ) {
      console.log(" [PASS] Bảng BacSi đủ 6 bác sĩ demo, có cấp bậc + mức phí + chuyên khoa.\n");
    } else {
      if (doctors.length !== EXPECTED_DOCTORS.length)
        console.log(` [FAIL] Số bác sĩ không đúng ${EXPECTED_DOCTORS.length} (hiện tại: ${doctors.length})`);
      if (missingDoctors.length > 0) console.log(` [FAIL] Thiếu bác sĩ: ${missingDoctors.join(", ")}`);
      if (extraDoctors.length > 0) console.log(` [CẢNH BÁO] Có bác sĩ ngoài dự kiến: ${extraDoctors.join(", ")}`);
      if (doctorsWithoutSpecialty.length > 0)
        console.log(
          ` [FAIL] Bác sĩ chưa gán chuyên khoa: ${doctorsWithoutSpecialty.map((d) => d.ho_ten).join(", ")}`
        );
      if (doctorsWithoutRank.length > 0)
        console.log(` [FAIL] Bác sĩ thiếu cấp bậc: ${doctorsWithoutRank.map((d) => d.ho_ten).join(", ")}`);
      if (doctorsWithoutFee.length > 0)
        console.log(` [FAIL] Bác sĩ thiếu mức phí hợp lệ: ${doctorsWithoutFee.map((d) => d.ho_ten).join(", ")}`);
      if (hasDoctorDuplicate) console.log(" [FAIL] Phát hiện duplicate (ho_ten, chuyen_khoa_id) trong BacSi!");
      allPass = false;
    }

    // 5. Kiểm tra bảng LichKhamBacSi (dữ liệu nền cho C2-04 tính slot)
    console.log("5. Kiểm tra bảng \"LichKhamBacSi\":");
    const scheduleSummary = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(DISTINCT "ngay")::int AS so_ngay,
              COUNT(DISTINCT ("bac_si_id", "ngay"))::int AS so_cap_bac_si_ngay,
              MIN("ngay")::text AS ngay_nho_nhat,
              MAX("ngay")::text AS ngay_lon_nhat
       FROM "LichKhamBacSi"
       WHERE "ngay" >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;`
    );
    const summary = scheduleSummary.rows[0];
    console.log(
      `- Tổng số khung giờ từ hôm nay trở đi: ${summary.total} (${summary.so_cap_bac_si_ngay} cặp bác sĩ/ngày, số ngày: ${summary.so_ngay}, từ ${summary.ngay_nho_nhat} đến ${summary.ngay_lon_nhat})`
    );

    const scheduleDetail = await pool.query(
      `SELECT b.ho_ten AS ten_bac_si,
              COUNT(l.id)::int AS so_ca,
              COUNT(DISTINCT l."ngay")::int AS so_ngay
       FROM "BacSi" b
       LEFT JOIN "LichKhamBacSi" l
         ON l."bac_si_id" = b.id
        AND l."ngay" >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       GROUP BY b.id, b.ho_ten
       ORDER BY b.id;`
    );
    scheduleDetail.rows.forEach((row) =>
      console.log(`  ${row.ten_bac_si}: ${row.so_ca} khung / ${row.so_ngay} ngày`)
    );
    const doctorsWithoutSchedule = scheduleDetail.rows.filter((row) => row.so_ca === 0);

    // UC-030: mỗi record là 1 khung giờ 1 tiếng (5 khung sáng + 3 khung chiều)
    const windowRes = await pool.query(
      `SELECT "gio_bat_dau"::text AS gio_bat_dau, "gio_ket_thuc"::text AS gio_ket_thuc,
              COUNT(*)::int AS so_khung,
              MAX("so_slot_toi_da")::int AS so_slot_toi_da,
              MAX("so_slot_online")::int AS so_slot_online
       FROM "LichKhamBacSi"
       WHERE "ngay" >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       GROUP BY "gio_bat_dau", "gio_ket_thuc"
       ORDER BY "gio_bat_dau";`
    );
    console.log("- Các khung giờ 1 tiếng có trong lịch:");
    windowRes.rows.forEach((row) =>
      console.log(
        `  ${row.gio_bat_dau.slice(0, 5)}-${row.gio_ket_thuc.slice(0, 5)}: ${row.so_khung} khung | sức chứa = ${row.so_slot_toi_da} | online = ${row.so_slot_online}`
      )
    );

    const duplicateScheduleRes = await pool.query(
      `SELECT "bac_si_id", "ngay"::text AS ngay, "gio_bat_dau"::text AS gio_bat_dau, COUNT(*)::int AS so_lan
       FROM "LichKhamBacSi"
       GROUP BY "bac_si_id", "ngay", "gio_bat_dau"
       HAVING COUNT(*) > 1
       ORDER BY "bac_si_id", "ngay";`
    );

    const invalidTimeRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE "gio_bat_dau" >= "gio_ket_thuc";`
    );

    const invalidSlotRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE "so_slot_toi_da" <= 0
          OR "so_slot_online" > "so_slot_toi_da"
          OR "so_slot_da_dat" > "so_slot_online"
          OR "so_slot_da_dat" < 0;`
    );

    const invalidRoomRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi" l
       JOIN "BacSi" b ON b.id = l."bac_si_id"
       LEFT JOIN "PhongKham" p ON p.id = l."phong_kham_id"
       WHERE l."phong_kham_id" IS NULL
          OR p."id" IS NULL
          OR p."chuyen_khoa_id" IS DISTINCT FROM b."chuyen_khoa_id";`
    );

    // UC-030: chỉ cho phép 8 khung giờ 1 tiếng (5 khung sáng + 3 khung chiều)
    const validWindowsRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE ("gio_bat_dau", "gio_ket_thuc") NOT IN (
               ('06:00'::time, '07:00'::time),
               ('07:00'::time, '08:00'::time),
               ('08:00'::time, '09:00'::time),
               ('09:00'::time, '10:00'::time),
               ('10:00'::time, '11:00'::time),
               ('13:00'::time, '14:00'::time),
               ('14:00'::time, '15:00'::time),
               ('15:00'::time, '16:00'::time)
             );`
    );

    // Không được lưu record cho cả ca (06:00-11:00 hoặc 13:00-16:00)
    const wholeShiftRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE ("gio_bat_dau", "gio_ket_thuc") IN (
               ('06:00'::time, '11:00'::time),
               ('13:00'::time, '16:00'::time)
             );`
    );

    // Mỗi khung giờ phải dài đúng 1 tiếng
    const invalidDurationRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE EXTRACT(EPOCH FROM ("gio_ket_thuc" - "gio_bat_dau"))::int <> 3600;`
    );

    // Mỗi bác sĩ/ngày demo phải có đúng 8 khung giờ (5 sáng + 3 chiều)
    const windowsPerDayRes = await pool.query(
      `SELECT "bac_si_id", "ngay"::text AS ngay,
              COUNT(*)::int AS so_khung,
              COUNT(DISTINCT "gio_bat_dau")::int AS so_khung_khac_nhau
       FROM "LichKhamBacSi"
       WHERE "ngay" >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
       GROUP BY "bac_si_id", "ngay"
       HAVING COUNT(*) <> 8 OR COUNT(DISTINCT "gio_bat_dau") <> 8
       ORDER BY "bac_si_id", "ngay";`
    );

    if (
      summary.total > 0 &&
      summary.so_ngay >= 5 &&
      summary.total === summary.so_cap_bac_si_ngay * 8 &&
      doctorsWithoutSchedule.length === 0 &&
      duplicateScheduleRes.rowCount === 0 &&
      invalidTimeRes.rows[0].total === 0 &&
      invalidSlotRes.rows[0].total === 0 &&
      invalidRoomRes.rows[0].total === 0 &&
      validWindowsRes.rows[0].total === 0 &&
      wholeShiftRes.rows[0].total === 0 &&
      invalidDurationRes.rows[0].total === 0 &&
      windowsPerDayRes.rowCount === 0
    ) {
      console.log(
        " [PASS] LichKhamBacSi: mỗi bác sĩ/ngày có đúng 8 khung 1 giờ, không trùng, số slot và phòng hợp lệ.\n"
      );
    } else {
      if (summary.total === 0) console.log(" [FAIL] Chưa có khung giờ nào từ hôm nay trở đi.");
      if (summary.so_ngay < 5)
        console.log(` [FAIL] Số ngày có lịch không đủ 5 (hiện tại: ${summary.so_ngay}).`);
      if (summary.total !== summary.so_cap_bac_si_ngay * 8)
        console.log(
          ` [FAIL] Tổng số khung không bằng số cặp bác sĩ/ngày x 8 (hiện tại: ${summary.total} / ${summary.so_cap_bac_si_ngay} cặp).`
        );
      if (doctorsWithoutSchedule.length > 0)
        console.log(
          ` [FAIL] Bác sĩ chưa có ca khám: ${doctorsWithoutSchedule.map((row) => row.ten_bac_si).join(", ")}`
        );
      if (duplicateScheduleRes.rowCount > 0) {
        console.log(
          ` [FAIL] Phát hiện ${duplicateScheduleRes.rowCount} ca khám bị trùng (bac_si_id, ngay, gio_bat_dau):`
        );
        duplicateScheduleRes.rows.forEach((row) =>
          console.log(`   + bac_si_id=${row.bac_si_id} | ${row.ngay} | ${row.gio_bat_dau} | ${row.so_lan} lần`)
        );
      }
      if (invalidTimeRes.rows[0].total > 0)
        console.log(` [FAIL] Có ${invalidTimeRes.rows[0].total} ca khám có gio_bat_dau >= gio_ket_thuc.`);
      if (invalidSlotRes.rows[0].total > 0)
        console.log(` [FAIL] Có ${invalidSlotRes.rows[0].total} ca khám có số slot không hợp lệ.`);
      if (invalidRoomRes.rows[0].total > 0)
        console.log(` [FAIL] Có ${invalidRoomRes.rows[0].total} ca khám dùng phòng sai/không có chuyên khoa.`);
      if (validWindowsRes.rows[0].total > 0)
        console.log(
          ` [FAIL] Có ${validWindowsRes.rows[0].total} khung giờ không thuộc 8 khung 1 tiếng hợp lệ (UC-030).`
        );
      if (wholeShiftRes.rows[0].total > 0)
        console.log(
          ` [FAIL] Có ${wholeShiftRes.rows[0].total} record lưu cả ca (06:00-11:00 hoặc 13:00-16:00) thay vì từng khung 1 giờ.`
        );
      if (invalidDurationRes.rows[0].total > 0)
        console.log(
          ` [FAIL] Có ${invalidDurationRes.rows[0].total} khung giờ không dài đúng 1 tiếng (UC-030).`
        );
      if (windowsPerDayRes.rowCount > 0) {
        console.log(
          ` [FAIL] Có ${windowsPerDayRes.rowCount} cặp bác sĩ/ngày không có đúng 8 khung giờ:`
        );
        windowsPerDayRes.rows.forEach((row) =>
          console.log(
            `   + bac_si_id=${row.bac_si_id} | ${row.ngay} | ${row.so_khung} khung (${row.so_khung_khac_nhau} giờ bắt đầu khác nhau)`
          )
        );
      }
      allPass = false;
    }

    // 6. Kết luận
    console.log("=== KẾT QUẢ TỔNG QUAN SEED ===");
    if (allPass) {
      console.log(" TẤT CẢ TIÊU CHÍ SEED DATA ĐỀU ĐẠT (PASS)!");
    } else {
      console.log(" XÁC MINH SEED DATA CHƯA ĐẠT (FAIL)!");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Lỗi khi xác minh seed data:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

verifySeed();
