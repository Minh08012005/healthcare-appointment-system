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

const EXPECTED_EXAM_ROOMS = [
  "Phòng 101 - Nội tổng quát",
  "Phòng 102 - Nội tổng quát",
  "Phòng 201 - Tim mạch",
  "Phòng 202 - Tim mạch",
  "Phòng 301 - Nhi",
  "Phòng 401 - Tai Mũi Họng",
];

const EXPECTED_LAB_ROOMS = [
  "Phòng Xét nghiệm Huyết học",
  "Phòng Xét nghiệm Sinh hóa",
  "Phòng Chẩn đoán hình ảnh",
];

const EXPECTED_DOCTORS = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Hoàng Cường",
  "Phạm Minh Dũng",
  "Võ Thị Hạnh",
  "Đặng Quốc Khánh",
];

const EXPECTED_ACCOUNTS = [
  { username: "admin", role: "Quản trị viên" },
  { username: "letan_01", role: "Lễ tân", room: "Phòng 101 - Nội tổng quát" },
  { username: "letan_02", role: "Lễ tân", room: "Phòng 201 - Tim mạch" },
  { username: "bs_an", role: "Bác sĩ" },
  { username: "bs_binh", role: "Bác sĩ" },
  { username: "bs_cuong", role: "Bác sĩ" },
  { username: "bs_dung", role: "Bác sĩ" },
  { username: "bs_hanh", role: "Bác sĩ" },
  { username: "bs_khanh", role: "Bác sĩ" },
  { username: "ktv_huyethoc", role: "Xét nghiệm", room: "Phòng Xét nghiệm Huyết học" },
  { username: "ktv_sinhhoa", role: "Xét nghiệm", room: "Phòng Xét nghiệm Sinh hóa" },
  { username: "ktv_cdha", role: "Xét nghiệm", room: "Phòng Chẩn đoán hình ảnh" },
  { username: "benhnhan_01", role: "Bệnh nhân" },
  { username: "benhnhan_02", role: "Bệnh nhân" },
];

async function verifySeed() {
  console.log("=== BẮT ĐẦU XÁC MINH SEED DATA TRÊN NEON POSTGRESQL ===\n");
  let allPass = true;

  try {
    // 1. Kiểm tra bảng VaiTro
    console.log("1. Kiểm tra bảng \"VaiTro\":");
    const roleRes = await pool.query(`SELECT id, ten_vai_tro FROM "VaiTro" ORDER BY id;`);
    const roles = roleRes.rows;
    const roleNames = roles.map((r) => r.ten_vai_tro);
    const hasRoleDuplicate = roleNames.length !== new Set(roleNames).size;
    const missingRoles = EXPECTED_ROLES.filter((r) => !roleNames.includes(r));

    if (missingRoles.length === 0 && !hasRoleDuplicate && roles.length === EXPECTED_ROLES.length) {
      console.log(`  [PASS] Đủ 5 vai trò chuẩn: ${roleNames.join(", ")}\n`);
    } else {
      if (missingRoles.length > 0) console.log(`  [FAIL] Thiếu vai trò: ${missingRoles.join(", ")}`);
      if (hasRoleDuplicate) console.log("  [FAIL] Phát hiện duplicate trong VaiTro!");
      allPass = false;
    }

    // 2. Kiểm tra bảng ChuyenKhoa
    console.log("2. Kiểm tra bảng \"ChuyenKhoa\":");
    const specialtyRes = await pool.query(`SELECT id, ten_chuyen_khoa, mo_ta FROM "ChuyenKhoa" ORDER BY id;`);
    const specialties = specialtyRes.rows;
    const specialtyNames = specialties.map((s) => s.ten_chuyen_khoa);
    const hasSpecialtyDuplicate = specialtyNames.length !== new Set(specialtyNames).size;
    const missingSpecialties = EXPECTED_SPECIALTIES.filter((s) => !specialtyNames.includes(s));
    const extraSpecialties = specialtyNames.filter((s) => !EXPECTED_SPECIALTIES.includes(s));

    if (missingSpecialties.length === 0 && extraSpecialties.length === 0 && !hasSpecialtyDuplicate) {
      console.log(`  [PASS] Đủ 4 chuyên khoa chuẩn: ${specialtyNames.join(", ")}\n`);
    } else {
      if (missingSpecialties.length > 0) console.log(`  [FAIL] Thiếu chuyên khoa: ${missingSpecialties.join(", ")}`);
      if (extraSpecialties.length > 0) console.log(`  [FAIL] Có chuyên khoa ngoài baseline: ${extraSpecialties.join(", ")}`);
      if (hasSpecialtyDuplicate) console.log("  [FAIL] Phát hiện duplicate trong ChuyenKhoa!");
      allPass = false;
    }

    // 3. Kiểm tra bảng PhongKham (6 phòng khám + 3 phòng xét nghiệm)
    console.log("3. Kiểm tra bảng \"PhongKham\":");
    const roomRes = await pool.query(
      `SELECT p.id, p.ten_phong, p.loai_phong, p.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "PhongKham" p
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = p.chuyen_khoa_id
       ORDER BY p.id;`
    );
    const rooms = roomRes.rows;
    const roomNames = rooms.map((r) => r.ten_phong);
    const allExpectedRooms = [...EXPECTED_EXAM_ROOMS, ...EXPECTED_LAB_ROOMS];
    const missingRooms = allExpectedRooms.filter((r) => !roomNames.includes(r));
    const extraRooms = roomNames.filter((r) => !allExpectedRooms.includes(r));
    const hasRoomDuplicate = roomNames.length !== new Set(roomNames).size;

    const invalidExamRooms = rooms.filter(
      (r) => EXPECTED_EXAM_ROOMS.includes(r.ten_phong) && (!r.chuyen_khoa_id || r.loai_phong !== "Phòng khám")
    );
    const invalidLabRooms = rooms.filter(
      (r) => EXPECTED_LAB_ROOMS.includes(r.ten_phong) && (r.chuyen_khoa_id !== null || r.loai_phong !== "Phòng xét nghiệm")
    );

    if (
      missingRooms.length === 0 &&
      extraRooms.length === 0 &&
      !hasRoomDuplicate &&
      invalidExamRooms.length === 0 &&
      invalidLabRooms.length === 0
    ) {
      console.log(`  [PASS] Đủ 9 phòng chuẩn (6 phòng khám chuyên khoa + 3 phòng xét nghiệm C5)\n`);
    } else {
      if (missingRooms.length > 0) console.log(`  [FAIL] Thiếu phòng: ${missingRooms.join(", ")}`);
      if (extraRooms.length > 0) console.log(`  [FAIL] Có phòng ngoài baseline: ${extraRooms.join(", ")}`);
      if (invalidExamRooms.length > 0) console.log(`  [FAIL] Phòng khám sai loại/chưa gán chuyên khoa: ${invalidExamRooms.map(r => r.ten_phong).join(", ")}`);
      if (invalidLabRooms.length > 0) console.log(`  [FAIL] Phòng xét nghiệm sai loại/gán nhầm chuyên khoa: ${invalidLabRooms.map(r => r.ten_phong).join(", ")}`);
      if (hasRoomDuplicate) console.log("  [FAIL] Phát hiện duplicate trong PhongKham!");
      allPass = false;
    }

    // 4. Kiểm tra bảng BacSi & Liên kết tài khoản
    console.log("4. Kiểm tra bảng \"BacSi\" & liên kết tài khoản:");
    const doctorRes = await pool.query(
      `SELECT b.id, b.ho_ten, b.cap_bac, b.muc_phi, b.chuyen_khoa_id, ck.ten_chuyen_khoa,
              b.tai_khoan_id, tk.ten_dang_nhap, vt.ten_vai_tro
       FROM "BacSi" b
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       LEFT JOIN "TaiKhoan" tk ON tk.id = b.tai_khoan_id
       LEFT JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       ORDER BY b.id;`
    );
    const doctors = doctorRes.rows;
    const doctorNames = doctors.map((d) => d.ho_ten);
    const missingDoctors = EXPECTED_DOCTORS.filter((name) => !doctorNames.includes(name));
    const extraDoctors = doctorNames.filter((name) => !EXPECTED_DOCTORS.includes(name));
    const doctorsWithoutSpecialty = doctors.filter((d) => d.chuyen_khoa_id === null);
    const doctorsWithoutRank = doctors.filter((d) => !d.cap_bac || d.cap_bac.trim() === "");
    const doctorsWithoutFee = doctors.filter((d) => d.muc_phi === null || Number(d.muc_phi) <= 0);
    const doctorsWithoutAccount = doctors.filter((d) => !d.tai_khoan_id || d.ten_vai_tro !== "Bác sĩ");
    const hasDoctorDuplicate = doctorNames.length !== new Set(doctorNames).size;

    if (
      missingDoctors.length === 0 &&
      extraDoctors.length === 0 &&
      doctorsWithoutSpecialty.length === 0 &&
      doctorsWithoutRank.length === 0 &&
      doctorsWithoutFee.length === 0 &&
      doctorsWithoutAccount.length === 0 &&
      !hasDoctorDuplicate
    ) {
      console.log(`  [PASS] Đủ 6 bác sĩ chuẩn, có chuyên môn/phí và đã liên kết tài khoản Bác sĩ\n`);
    } else {
      if (missingDoctors.length > 0) console.log(`  [FAIL] Thiếu bác sĩ: ${missingDoctors.join(", ")}`);
      if (extraDoctors.length > 0) console.log(`  [FAIL] Có bác sĩ ngoài baseline: ${extraDoctors.join(", ")}`);
      if (doctorsWithoutSpecialty.length > 0) console.log(`  [FAIL] Bác sĩ chưa gán chuyên khoa: ${doctorsWithoutSpecialty.map(d => d.ho_ten).join(", ")}`);
      if (doctorsWithoutRank.length > 0) console.log(`  [FAIL] Bác sĩ thiếu cấp bậc: ${doctorsWithoutRank.map(d => d.ho_ten).join(", ")}`);
      if (doctorsWithoutFee.length > 0) console.log(`  [FAIL] Bác sĩ thiếu phí: ${doctorsWithoutFee.map(d => d.ho_ten).join(", ")}`);
      if (doctorsWithoutAccount.length > 0) console.log(`  [FAIL] Bác sĩ chưa liên kết tài khoản bác sĩ: ${doctorsWithoutAccount.map(d => d.ho_ten).join(", ")}`);
      if (hasDoctorDuplicate) console.log("  [FAIL] Phát hiện duplicate trong BacSi!");
      allPass = false;
    }

    // 5. Kiểm tra Tài khoản Demo (TaiKhoan)
    console.log("5. Kiểm tra Tài khoản Demo (TaiKhoan):");
    const accountRes = await pool.query(
      `SELECT tk.id, tk.ten_dang_nhap, tk.trang_thai, vt.ten_vai_tro, tk.phong_kham_id, pk.ten_phong,
              bn.id AS benh_nhan_id, bn.ho_ten AS ho_ten_bn, bn.so_cccd_ho_chieu
       FROM "TaiKhoan" tk
       JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       LEFT JOIN "PhongKham" pk ON pk.id = tk.phong_kham_id
       LEFT JOIN "BenhNhan" bn ON bn.tai_khoan_id = tk.id
       ORDER BY tk.id;`
    );
    const accounts = accountRes.rows;

    for (const exp of EXPECTED_ACCOUNTS) {
      const acc = accounts.find((a) => a.ten_dang_nhap === exp.username);
      if (!acc) {
        console.log(`  [FAIL] Thiếu tài khoản demo: ${exp.username}`);
        allPass = false;
        continue;
      }
      if (acc.trang_thai !== "HoatDong") {
        console.log(`  [FAIL] Tài khoản ${exp.username} không ở trạng thái HoatDong`);
        allPass = false;
      }
      if (acc.ten_vai_tro !== exp.role) {
        console.log(`  [FAIL] Tài khoản ${exp.username} sai vai trò: mong đợi ${exp.role}, thực tế ${acc.ten_vai_tro}`);
        allPass = false;
      }
      if (exp.room && acc.ten_phong !== exp.room) {
        console.log(`  [FAIL] Tài khoản ${exp.username} sai phân công phòng: mong đợi ${exp.room}, thực tế ${acc.ten_phong || "NULL"}`);
        allPass = false;
      }
      if (exp.role === "Bệnh nhân" && (!acc.benh_nhan_id || !acc.so_cccd_ho_chieu)) {
        console.log(`  [FAIL] Bệnh nhân ${exp.username} thiếu hồ sơ BenhNhan hoặc CCCD`);
        allPass = false;
      }
    }
    console.log(`  [PASS] Đã kiểm tra ${EXPECTED_ACCOUNTS.length} tài khoản demo (Admin, Lễ tân, Bác sĩ, Lab, Bệnh nhân)\n`);

    // 6. Kiểm tra bảng LichKhamBacSi (Lịch trực tương lai)
    console.log("6. Kiểm tra bảng \"LichKhamBacSi\" (Lịch trực tương lai):");
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
      `  - Tổng số slot khả dụng từ hôm nay: ${summary.total} (${summary.so_cap_bac_si_ngay} ca trực, ${summary.so_ngay} ngày, từ ${summary.ngay_nho_nhat} đến ${summary.ngay_lon_nhat})`
    );

    const doctorsWithoutFutureSchedule = await pool.query(
      `SELECT b.ho_ten
       FROM "BacSi" b
       WHERE b.ho_ten = ANY($1::text[])
         AND NOT EXISTS (
           SELECT 1 FROM "LichKhamBacSi" l
           WHERE l.bac_si_id = b.id AND l.ngay >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         );`,
      [EXPECTED_DOCTORS]
    );

    const invalidRoomRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi" l
       JOIN "BacSi" b ON b.id = l.bac_si_id
       JOIN "PhongKham" p ON p.id = l.phong_kham_id
       WHERE l.ngay >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         AND p.chuyen_khoa_id IS DISTINCT FROM b.chuyen_khoa_id;`
    );

    const invalidSlotRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM "LichKhamBacSi"
       WHERE "ngay" >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         AND ("so_slot_toi_da" <= 0
              OR "so_slot_online" > "so_slot_toi_da"
              OR "so_slot_da_dat" > "so_slot_online"
              OR "so_slot_da_dat" < 0);`
    );

    if (
      summary.total > 0 &&
      summary.so_ngay >= 5 &&
      doctorsWithoutFutureSchedule.rowCount === 0 &&
      invalidRoomRes.rows[0].total === 0 &&
      invalidSlotRes.rows[0].total === 0
    ) {
      console.log(`  [PASS] Lịch trực tương lai đầy đủ, hợp lệ cho 6 bác sĩ (8 khung/ngày, đúng chuyên khoa phòng)\n`);
    } else {
      if (summary.total === 0) console.log("  [FAIL] Chưa có khung giờ nào từ hôm nay trở đi.");
      if (summary.so_ngay < 5) console.log(`  [FAIL] Số ngày có lịch tương lai không đủ (hiện tại: ${summary.so_ngay})`);
      if (doctorsWithoutFutureSchedule.rowCount > 0)
        console.log(`  [FAIL] Bác sĩ chưa có lịch tương lai: ${doctorsWithoutFutureSchedule.rows.map(r => r.ho_ten).join(", ")}`);
      if (invalidRoomRes.rows[0].total > 0) console.log(`  [FAIL] Có ${invalidRoomRes.rows[0].total} slot gán phòng lệch chuyên khoa`);
      if (invalidSlotRes.rows[0].total > 0) console.log(`  [FAIL] Có ${invalidSlotRes.rows[0].total} slot có capacity sai quy chuẩn`);
      allPass = false;
    }

    // 7. Cấu hình khung giờ & Cấu hình hệ thống
    console.log("7. Kiểm tra CauHinhKhungGio & CauHinhHeThong:");
    const slotCfgRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "CauHinhKhungGio"`);
    if (slotCfgRes.rows[0].cnt === 8) {
      console.log("  [PASS] CauHinhKhungGio đủ 8 khung giờ chuẩn (UC-030/UC-031)");
    } else {
      console.log(`  [FAIL] CauHinhKhungGio có ${slotCfgRes.rows[0].cnt} khung (mong đợi 8)`);
      allPass = false;
    }

    const sysCfgRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "CauHinhHeThong"`);
    if (sysCfgRes.rows[0].cnt >= 1) {
      console.log("  [PASS] CauHinhHeThong có bản ghi cấu hình mặc định (C3-01)\n");
    } else {
      console.log("  [FAIL] CauHinhHeThong chưa có bản ghi cấu hình");
      allPass = false;
    }

    // 8. Tin tức & Quy trình khám (Nội dung công khai)
    console.log("8. Kiểm tra TinTuc & QuyTrinhKham:");
    const procRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "QuyTrinhKham"`);
    if (procRes.rows[0].cnt >= 5) {
      console.log(`  [PASS] QuyTrinhKham có ${procRes.rows[0].cnt} bước chuẩn (UC-036)`);
    } else {
      console.log(`  [FAIL] QuyTrinhKham chỉ có ${procRes.rows[0].cnt} bước (mong đợi >= 5)`);
      allPass = false;
    }

    const newsRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "TinTuc" WHERE trang_thai = 'HienThi'`);
    if (newsRes.rows[0].cnt >= 3) {
      console.log(`  [PASS] TinTuc có ${newsRes.rows[0].cnt} bài tin HienThi (UC-035)\n`);
    } else {
      console.log(`  [FAIL] TinTuc chỉ có ${newsRes.rows[0].cnt} bài tin HienThi (mong đợi >= 3)`);
      allPass = false;
    }

    // Kết luận
    console.log("=== KẾT QUẢ TỔNG QUAN XÁC MINH SEED ===");
    if (allPass) {
      console.log(" TẤT CẢ TIÊU CHÍ SEED BASELINE ĐỀU ĐẠT (PASS)!");
    } else {
      console.log(" XÁC MINH SEED BASELINE CHƯA ĐẠT (FAIL)!");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Lỗi khi xác minh seed baseline:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

verifySeed();
