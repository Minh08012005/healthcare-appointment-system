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

    // 3. Kết luận
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
