const app = require("../src/app");
const pool = require("../src/config/db");

let passed = 0;
let failed = 0;

const check = (label, condition, detail = "") => {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failed += 1;
    console.log(`  [FAIL] ${label}${detail ? ` -> ${detail}` : ""}`);
  }
};

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

// So sánh đúng tập key để chắc chắn API không trả field ngoài contract
const hasExactKeys = (object, expectedKeys) => {
  const actualKeys = Object.keys(object).sort();
  const sortedExpected = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpected.length &&
    actualKeys.every((key, index) => key === sortedExpected[index])
  );
};

const isSortedById = (items) =>
  items.every((item, index) => index === 0 || items[index - 1].id < item.id);

async function verifyMasterApi() {
  console.log("=== BẮT ĐẦU KIỂM TRA MASTER API (C2-03) ===\n");

  // Chạy app trên cổng ngẫu nhiên để không đụng server dev đang chạy
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`- Base URL tạm thời: ${baseUrl}\n`);

  try {
    // 1. GET /api/master/chuyen-khoa
    console.log("1. GET /api/master/chuyen-khoa");
    const specialtiesRes = await fetch(`${baseUrl}/api/master/chuyen-khoa`);
    const specialtiesBody = await specialtiesRes.json();
    const specialties = Array.isArray(specialtiesBody.data) ? specialtiesBody.data : [];
    const specialtyKeys = ["id", "ten_chuyen_khoa", "mo_ta"];

    check("HTTP status = 200", specialtiesRes.status === 200, `nhận ${specialtiesRes.status}`);
    check("success = true", specialtiesBody.success === true);
    check("data là mảng", Array.isArray(specialtiesBody.data));
    check(
      "chỉ trả đúng field id/ten_chuyen_khoa/mo_ta",
      specialties.every((item) => hasExactKeys(item, specialtyKeys))
    );
    check("id là số nguyên dương", specialties.every((item) => isPositiveInt(item.id)));
    check(
      "ten_chuyen_khoa là chuỗi không rỗng",
      specialties.every(
        (item) => typeof item.ten_chuyen_khoa === "string" && item.ten_chuyen_khoa.trim() !== ""
      )
    );
    check("sắp xếp theo id tăng dần", isSortedById(specialties));
    if (specialties[0]) console.log(`  Ví dụ: ${JSON.stringify(specialties[0])}`);
    console.log("");

    // 2. GET /api/master/bac-si theo từng chuyên khoa
    console.log("2. GET /api/master/bac-si?chuyen_khoa_id=<id>");
    const doctorKeys = [
      "id",
      "ho_ten",
      "cap_bac",
      "muc_phi",
      "chuyen_khoa_id",
      "ten_chuyen_khoa",
    ];
    let totalDoctors = 0;

    for (const specialty of specialties) {
      const response = await fetch(
        `${baseUrl}/api/master/bac-si?chuyen_khoa_id=${specialty.id}`
      );
      const body = await response.json();
      const doctors = Array.isArray(body.data) ? body.data : [];

      check(
        `Chuyên khoa ${specialty.id} - HTTP status = 200`,
        response.status === 200,
        `nhận ${response.status}`
      );
      check(`Chuyên khoa ${specialty.id} - success = true`, body.success === true);
      check(
        `Chuyên khoa ${specialty.id} - có ít nhất 1 bác sĩ`,
        doctors.length >= 1,
        `nhận ${doctors.length}`
      );
      check(
        `Chuyên khoa ${specialty.id} - chỉ trả đúng field contract`,
        doctors.every((item) => hasExactKeys(item, doctorKeys))
      );
      check(
        `Chuyên khoa ${specialty.id} - lọc đúng chuyên khoa`,
        doctors.every(
          (item) =>
            item.chuyen_khoa_id === specialty.id &&
            item.ten_chuyen_khoa === specialty.ten_chuyen_khoa
        )
      );
      check(
        `Chuyên khoa ${specialty.id} - id/ho_ten/cap_bac hợp lệ`,
        doctors.every(
          (item) =>
            isPositiveInt(item.id) &&
            typeof item.ho_ten === "string" &&
            item.ho_ten.trim() !== "" &&
            typeof item.cap_bac === "string" &&
            item.cap_bac.trim() !== ""
        )
      );
      check(
        `Chuyên khoa ${specialty.id} - muc_phi là number > 0 (không phải string)`,
        doctors.every((item) => typeof item.muc_phi === "number" && item.muc_phi > 0)
      );
      check(
        `Chuyên khoa ${specialty.id} - sắp xếp theo id tăng dần`,
        isSortedById(doctors)
      );

      if (specialty === specialties[0] && doctors[0]) {
        console.log(`  Ví dụ: ${JSON.stringify(doctors[0])}`);
      }

      totalDoctors += doctors.length;
    }

    // 3. Không truyền chuyen_khoa_id -> trả về tất cả bác sĩ
    console.log("3. GET /api/master/bac-si (không truyền chuyen_khoa_id)");
    const allRes = await fetch(`${baseUrl}/api/master/bac-si`);
    const allBody = await allRes.json();
    const allDoctors = Array.isArray(allBody.data) ? allBody.data : [];

    check("HTTP status = 200", allRes.status === 200, `nhận ${allRes.status}`);
    check("success = true", allBody.success === true);
    check(
      "trả về bác sĩ của nhiều hơn 1 chuyên khoa",
      new Set(allDoctors.map((item) => item.chuyen_khoa_id)).size > 1
    );
    check(
      "tổng số bác sĩ khớp khi gọi theo từng chuyên khoa",
      allDoctors.length === totalDoctors,
      `tất cả: ${allDoctors.length} - theo chuyên khoa: ${totalDoctors}`
    );
    console.log("");

    // 4. Query param không hợp lệ -> 400
    console.log("4. GET /api/master/bac-si?chuyen_khoa_id=<không hợp lệ>");
    for (const invalidValue of ["abc", "0", "-1", "1.5"]) {
      const response = await fetch(
        `${baseUrl}/api/master/bac-si?chuyen_khoa_id=${encodeURIComponent(invalidValue)}`
      );
      const body = await response.json();

      check(
        `chuyen_khoa_id="${invalidValue}" -> 400 + success=false`,
        response.status === 400 && body.success === false && typeof body.message === "string",
        `status ${response.status}, body ${JSON.stringify(body)}`
      );
    }

    // 5. Chuyên khoa không tồn tại -> 200 + mảng rỗng
    console.log("5. GET /api/master/bac-si?chuyen_khoa_id=999999");
    const emptyRes = await fetch(`${baseUrl}/api/master/bac-si?chuyen_khoa_id=999999`);
    const emptyBody = await emptyRes.json();

    check("HTTP status = 200", emptyRes.status === 200, `nhận ${emptyRes.status}`);
    check(
      "data là mảng rỗng",
      Array.isArray(emptyBody.data) && emptyBody.data.length === 0,
      JSON.stringify(emptyBody)
    );
  } catch (error) {
    failed += 1;
    console.error(" LỖI KHI KIỂM TRA MASTER API:", error.message);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  console.log(`\n=== KẾT QUẢ: ${passed} PASS / ${failed} FAIL ===`);
  if (failed > 0) {
    console.log(" MASTER API CHƯA ĐẠT (FAIL)!");
    process.exitCode = 1;
  } else {
    console.log(" MASTER API ĐẠT (PASS)!");
  }
}

verifyMasterApi();
