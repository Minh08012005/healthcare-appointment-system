const app = require("../src/app");
const pool = require("../src/config/db");

let pass = 0;
let fail = 0;

const check = (label, ok, extra = "") => {
  if (ok) {
    pass++;
    console.log(`  [PASS] ${label}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${label} ${extra}`);
  }
};

async function testBaselineSmoke() {
  console.log("=== BẮT ĐẦU SMOKE TEST BASELINE (READ-ONLY) ===\n");
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Test Login cho cả 5 roles
    console.log("1. Kiểm tra Đăng nhập cho các role demo:");
    const testAccounts = [
      { username: "admin", expectedRole: "Quản trị viên" },
      { username: "letan_01", expectedRole: "Lễ tân" },
      { username: "letan_02", expectedRole: "Lễ tân" },
      { username: "bs_an", expectedRole: "Bác sĩ" },
      { username: "bs_cuong", expectedRole: "Bác sĩ" },
      { username: "ktv_huyethoc", expectedRole: "Xét nghiệm" },
      { username: "benhnhan_01", expectedRole: "Bệnh nhân" },
    ];

    const tokens = {};
    for (const acc of testAccounts) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: acc.username, password: "123456" }),
      });
      const body = await res.json();
      const ok = res.status === 200 && body.success === true && body.data?.user?.role === acc.expectedRole;
      check(`Login ${acc.username} (${acc.expectedRole}) -> 200`, ok, `nhận ${res.status}: ${JSON.stringify(body)}`);
      if (ok) tokens[acc.username] = body.data.token;
    }

    // 2. Kiểm tra thông tin /auth/me và liên kết nghiệp vụ
    console.log("\n2. Kiểm tra thông tin /auth/me và liên kết nghiệp vụ:");

    // Doctor me
    const docMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens["bs_an"]}` },
    });
    const docMe = await docMeRes.json();
    check("bs_an /auth/me trả về đúng thông tin bác sĩ", docMe.success === true && docMe.data?.user?.role === "Bác sĩ");

    const bsDb = await pool.query(
      `SELECT b.id, b.ho_ten, b.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "BacSi" b
       JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
       JOIN "TaiKhoan" tk ON tk.id = b.tai_khoan_id
       WHERE tk.ten_dang_nhap = 'bs_an'`
    );
    check("bs_an liên kết đúng bác sĩ Nguyễn Văn An (Nội tổng quát)", bsDb.rows[0]?.ho_ten === "Nguyễn Văn An");

    // Reception me & room
    const recDb = await pool.query(
      `SELECT tk.id, tk.ten_dang_nhap, pk.ten_phong
       FROM "TaiKhoan" tk
       JOIN "PhongKham" pk ON pk.id = tk.phong_kham_id
       WHERE tk.ten_dang_nhap = 'letan_01'`
    );
    check("letan_01 đã được phân công Phòng 101 - Nội tổng quát", recDb.rows[0]?.ten_phong === "Phòng 101 - Nội tổng quát");

    // Lab me & room
    const labDb = await pool.query(
      `SELECT tk.id, tk.ten_dang_nhap, pk.ten_phong
       FROM "TaiKhoan" tk
       JOIN "PhongKham" pk ON pk.id = tk.phong_kham_id
       WHERE tk.ten_dang_nhap = 'ktv_huyethoc'`
    );
    check("ktv_huyethoc đã được phân công Phòng Xét nghiệm Huyết học", labDb.rows[0]?.ten_phong === "Phòng Xét nghiệm Huyết học");

    // Patient me & profile
    const patDb = await pool.query(
      `SELECT bn.ho_ten, bn.so_cccd_ho_chieu
       FROM "BenhNhan" bn
       JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id
       WHERE tk.ten_dang_nhap = 'benhnhan_01'`
    );
    check("benhnhan_01 có hồ sơ bệnh nhân Nguyễn Văn Bình với CCCD", patDb.rows[0]?.ho_ten === "Nguyễn Văn Bình" && !!patDb.rows[0]?.so_cccd_ho_chieu);

    // 3. Kiểm tra Patient Booking: xem được slot tương lai
    console.log("\n3. Kiểm tra Patient Booking Slot API:");
    // Lấy ngày mai
    const tomorrowRes = await pool.query(
      `SELECT to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '1 day', 'YYYY-MM-DD') AS ngay_mai`
    );
    const ngayMai = tomorrowRes.rows[0].ngay_mai;
    const bsId = bsDb.rows[0].id;

    const slotsRes = await fetch(`${baseUrl}/api/slots?bac_si_id=${bsId}&ngay=${ngayMai}`, {
      headers: { Authorization: `Bearer ${tokens["benhnhan_01"]}` },
    });
    const slotsBody = await slotsRes.json();
    const slots = Array.isArray(slotsBody.data?.slots) ? slotsBody.data.slots : [];

    check(
      `GET /api/slots ngày mai (${ngayMai}) cho bác sĩ ${bsId} -> 200`,
      slotsRes.status === 200 && slotsBody.success === true,
      `nhận ${slotsRes.status}`
    );
    check(
      `Trả về đúng 8 khung giờ chuẩn có thể đặt lịch`,
      slots.length === 8,
      `nhận ${slots.length} khung`
    );
    check(
      `Có slot còn chỗ (slot_con_lai > 0)`,
      slots.some((s) => s.slot_con_lai > 0)
    );

    // 4. Kiểm tra Master API ChuyenKhoa & BacSi
    console.log("\n4. Kiểm tra Master API:");
    const ckRes = await fetch(`${baseUrl}/api/master/chuyen-khoa`);
    const ckBody = await ckRes.json();
    check("GET /api/master/chuyen-khoa trả về đúng 4 chuyên khoa sạch", ckBody.data?.length === 4);

    const docRes = await fetch(`${baseUrl}/api/master/bac-si`);
    const docBody = await docRes.json();
    check("GET /api/master/bac-si trả về đúng 6 bác sĩ sạch", docBody.data?.length === 6);

    // 5. Kiểm tra TinTuc & QuyTrinh công khai
    console.log("\n5. Kiểm tra Public Content API:");
    const newsRes = await fetch(`${baseUrl}/api/public/news`);
    const newsBody = await newsRes.json();
    check("GET /api/public/news trả về 3 bài tin tức hiển thị", newsBody.data?.length === 3);

    const procRes = await fetch(`${baseUrl}/api/public/procedure-steps`);
    const procBody = await procRes.json();
    check("GET /api/public/procedure-steps trả về 5 bước quy trình khám", procBody.data?.length === 5);

    console.log(`\n=== KẾT QUẢ SMOKE TEST: ${pass} PASS, ${fail} FAIL ===`);
  } catch (err) {
    fail++;
    console.error("LỖI SMOKE TEST:", err);
  } finally {
    server.close();
    await pool.end();
    process.exitCode = fail > 0 ? 1 : 0;
  }
}

testBaselineSmoke();
