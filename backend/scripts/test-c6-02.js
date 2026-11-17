// C6-02 - Quản lý Chuyên khoa & Bác sĩ (UC-027, UC-028)
// Chạy: node scripts/test-c6-02.js   (backend phải đang chạy ở localhost:3000)
// Lưu ý nghiệp vụ: Admin KHÔNG có chức năng xóa bác sĩ, chỉ thêm/sửa/xem/lọc.

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong"; // phải giống auth.controller
const sfx = Date.now().toString().slice(-6);
const P = `ZZS${sfx}`;
let pass = 0, fail = 0, pwHash, roleAD, roleBS, roleLT;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const get = (p, t) => api("GET", p, undefined, t);
const post = (p, t, b) => api("POST", p, b === undefined ? {} : b, t);
const put = (p, t, b) => api("PUT", p, b === undefined ? {} : b, t);
const del = (p, t) => api("DELETE", p, undefined, t);

const mkUser = async (roleId, tag) => {
  const username = `zzs${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkRoom = async (name, ckId = null) =>
  (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} ${name}`, ckId])).rows[0].id;

const mkSlot = async (bsId, roomId, hours) =>
  (
    await pool.query(
      `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       SELECT $1::int, $2::int, t::date, t::time, (t + interval '30 minutes')::time, 5, 3, 0, 'HoatDong'
       FROM (SELECT date_trunc('minute', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + ($3::int * interval '1 hour')) AS t) x
       RETURNING id, to_char(ngay, 'YYYY-MM-DD') AS ngay`,
      [bsId, roomId, hours]
    )
  ).rows[0];

const countLike = async (table, col, pattern) =>
  Number((await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE ${col} LIKE $1`, [pattern])).rows[0].count);

// Dọn dữ liệu test trực tiếp trong DB (đây là dọn dẹp, không phải chức năng của hệ thống)
const cleanup = async () => {
  try {
    const pats = [`${P} BN %`, `zzs${sfx}_%`, `${P} %`];
    await pool.query(
      `DELETE FROM "DatLichKham"
       WHERE benh_nhan_id IN (SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2))
          OR chuyen_khoa_id IN (SELECT id FROM "ChuyenKhoa" WHERE ten_chuyen_khoa LIKE $3)`,
      pats
    );
    await pool.query(`DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(`DELETE FROM "ChuyenKhoa" WHERE ten_chuyen_khoa LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [pats[0], pats[1]]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [pats[1]]);
    const l = {
      tk: await countLike("TaiKhoan", "ten_dang_nhap", `zzs${sfx}_%`),
      ck: await countLike("ChuyenKhoa", "ten_chuyen_khoa", `${P} %`),
      bs: await countLike("BacSi", "ho_ten", `${P} BS %`),
      pk: await countLike("PhongKham", "ten_phong", `${P} %`),
    };
    console.log(`\nDọn dữ liệu xong. Còn sót: TaiKhoan=${l.tk}, ChuyenKhoa=${l.ck}, BacSi=${l.bs}, PhongKham=${l.pk} (phải = 0)`);
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleAD = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Quản trị viên'`)).rows[0].id;
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    roleLT = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`)).rows[0].id;

    const ad = (await mkUser(roleAD, "ad")).token;
    const docU = await mkUser(roleBS, "doc");
    const lt = await mkUser(roleLT, "lt");
    const ptName = `zzs${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    // ================= 1. Xác thực và vai trò =================
    let r = await get("/admin/specialties");
    check("GET /admin/specialties - không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    r = await get("/admin/doctors");
    check("GET /admin/doctors - không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    for (const [tag, tok] of [["bệnh nhân", ptTok], ["bác sĩ", docU.token], ["lễ tân", lt.token]]) {
      const codes = [
        (await get("/admin/specialties", tok)).status,
        (await post("/admin/specialties", tok, { ten_chuyen_khoa: `${P} forbidden` })).status,
        (await put("/admin/specialties/1", tok, { ten_chuyen_khoa: `${P} forbidden` })).status,
        (await del("/admin/specialties/1", tok)).status,
        (await get("/admin/doctors", tok)).status,
        (await post("/admin/doctors", tok, { ho_ten: `${P} BS forbidden`, chuyen_khoa_id: 1 })).status,
        (await put("/admin/doctors/1", tok, { ho_ten: `${P} BS forbidden` })).status,
      ];
      check(`Vai trò ${tag}: mọi API admin -> 403`, codes.every((c) => c === 403), JSON.stringify(codes));
    }
    check(
      "Bị từ chối thì không tạo dữ liệu",
      (await countLike("ChuyenKhoa", "ten_chuyen_khoa", `${P}%`)) === 0 && (await countLike("BacSi", "ho_ten", `${P}%`)) === 0
    );

    // ================= 2. Chuyên khoa: tạo =================
    const nameA = `${P} Khoa A`;
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: `  ${nameA}  `, mo_ta: "  Mo ta A  " });
    check("Tạo chuyên khoa -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const A = r.data?.data?.id;
    check(
      "Tên và mô tả được trim, so_bac_si = 0, so_phong = 0",
      r.data?.data?.ten_chuyen_khoa === nameA && r.data.data.mo_ta === "Mo ta A" && r.data.data.so_bac_si === 0 && r.data.data.so_phong === 0
    );

    const badSpecialty = [
      [{}, "thiếu tên"],
      [{ ten_chuyen_khoa: "   " }, "tên toàn khoảng trắng"],
      [{ ten_chuyen_khoa: 123 }, "tên sai kiểu"],
      [{ ten_chuyen_khoa: "a".repeat(101) }, "tên quá dài"],
      [{ ten_chuyen_khoa: `${P} Khoa X`, mo_ta: 123 }, "mo_ta sai kiểu"],
      [[], "body là mảng"],
    ];
    for (const [body, tag] of badSpecialty) {
      r = await post("/admin/specialties", ad, body);
      check(`Tạo chuyên khoa - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    for (const [name, tag] of [
      [nameA, "trùng y hệt"],
      [nameA.toLowerCase(), "trùng khác hoa thường"],
      [`  ${nameA}  `, "trùng có khoảng trắng thừa"],
    ]) {
      r = await post("/admin/specialties", ad, { ten_chuyen_khoa: name });
      check(`Tạo chuyên khoa - ${tag} -> 409 DUPLICATE_NAME`, r.status === 409 && r.data.code === "DUPLICATE_NAME", `(nhận ${r.status})`);
    }
    check("Input lỗi/trùng không tạo thêm dữ liệu", (await countLike("ChuyenKhoa", "ten_chuyen_khoa", `${P}%`)) === 1);

    // ================= 3. Chuyên khoa: đọc =================
    r = await get("/admin/specialties", ad);
    const itemA = (r.data?.data?.items || []).find((x) => x.id === A);
    check(
      "Danh sách chuyên khoa có item vừa tạo, đủ field",
      r.status === 200 && itemA?.ten_chuyen_khoa === nameA && itemA.so_bac_si === 0 && "so_phong" in itemA
    );
    r = await get(`/admin/specialties/${A}`, ad);
    check("Chi tiết chuyên khoa -> 200", r.status === 200 && r.data?.data?.id === A, `(nhận ${r.status})`);
    r = await get("/admin/specialties/999999999", ad);
    check("Chi tiết chuyên khoa không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get("/admin/specialties/abc", ad);
    check("Chi tiết id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ================= 4. Chuyên khoa: sửa =================
    const nameA2 = `${P} Khoa A2`;
    r = await put(`/admin/specialties/${A}`, ad, { ten_chuyen_khoa: nameA2 });
    check("Sửa tên chuyên khoa -> 200", r.status === 200 && r.data?.data?.ten_chuyen_khoa === nameA2, `(nhận ${r.status})`);
    check("Không gửi mo_ta -> giữ nguyên mo_ta", r.data?.data?.mo_ta === "Mo ta A");
    const nameB = `${P} Khoa B`;
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: nameB });
    const B = r.data?.data?.id;
    r = await put(`/admin/specialties/${B}`, ad, { ten_chuyen_khoa: nameA2.toUpperCase() });
    check("Sửa thành tên đã có (khác hoa thường) -> 409", r.status === 409, `(nhận ${r.status})`);
    r = await put(`/admin/specialties/${A}`, ad, { ten_chuyen_khoa: nameA2, mo_ta: null });
    check("Sửa giữ nguyên tên của chính nó + mo_ta null -> 200, xóa mô tả", r.status === 200 && r.data?.data?.mo_ta === null, `(nhận ${r.status})`);
    r = await put(`/admin/specialties/${A}`, ad, {});
    check("Sửa thiếu tên -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await put("/admin/specialties/999999999", ad, { ten_chuyen_khoa: `${P} Khoa Z` });
    check("Sửa chuyên khoa không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await put("/admin/specialties/abc", ad, { ten_chuyen_khoa: `${P} Khoa Z` });
    check("Sửa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    const dbA = (await pool.query(`SELECT ten_chuyen_khoa FROM "ChuyenKhoa" WHERE id=$1`, [A])).rows[0];
    check("DB: tên chuyên khoa đã đổi", dbA.ten_chuyen_khoa === nameA2);

    // ================= 5. Bác sĩ: tạo =================
    r = await post("/admin/doctors", ad, { ho_ten: `  ${P} BS One  `, chuyen_khoa_id: A, cap_bac: "Bac si CKI", muc_phi: 150000, tai_khoan_id: 1 });
    check("Tạo bác sĩ -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const D1 = r.data?.data?.id;
    check(
      "Bác sĩ có đủ họ tên, chuyên khoa, cấp bậc, mức phí (số)",
      r.data?.data?.ho_ten === `${P} BS One` && r.data.data.chuyen_khoa?.id === A && r.data.data.cap_bac === "Bac si CKI" && r.data.data.muc_phi === 150000
    );
    const dbD1 = (await pool.query(`SELECT tai_khoan_id FROM "BacSi" WHERE id=$1`, [D1])).rows[0];
    check("Client gửi tai_khoan_id bị bỏ qua (không tạo/gắn tài khoản)", dbD1.tai_khoan_id === null && r.data.data.co_tai_khoan === false);
    r = await post("/admin/doctors", ad, { ho_ten: `${P} BS Two`, chuyen_khoa_id: A });
    check(
      "Tạo bác sĩ chỉ có họ tên + chuyên khoa -> 201, cấp bậc/phí = null",
      r.status === 201 && r.data?.data?.cap_bac === null && r.data.data.muc_phi === null,
      `(nhận ${r.status})`
    );
    const D2 = r.data?.data?.id;

    const doctorsBefore = await countLike("BacSi", "ho_ten", `${P} BS %`);
    const badDoctor = [
      [{ chuyen_khoa_id: A }, "thiếu họ tên"],
      [{ ho_ten: "   ", chuyen_khoa_id: A }, "họ tên toàn khoảng trắng"],
      [{ ho_ten: 123, chuyen_khoa_id: A }, "họ tên sai kiểu"],
      [{ ho_ten: `${P} BS ${"a".repeat(100)}`, chuyen_khoa_id: A }, "họ tên quá dài"],
      [{ ho_ten: `${P} BS X` }, "thiếu chuyên khoa"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: "abc" }, "chuyen_khoa_id sai định dạng"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: 999999999 }, "chuyên khoa không tồn tại (FK)"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, cap_bac: 123 }, "cap_bac sai kiểu"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, cap_bac: "a".repeat(101) }, "cap_bac quá dài"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, muc_phi: -1 }, "muc_phi âm"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, muc_phi: "abc" }, "muc_phi không phải số"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, muc_phi: 1.234 }, "muc_phi quá 2 chữ số thập phân"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, muc_phi: 99999999999 }, "muc_phi quá lớn"],
      [{ ho_ten: `${P} BS X`, chuyen_khoa_id: A, muc_phi: true }, "muc_phi sai kiểu"],
    ];
    for (const [body, tag] of badDoctor) {
      r = await post("/admin/doctors", ad, body);
      check(`Tạo bác sĩ - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("Input lỗi không tạo thêm bác sĩ", (await countLike("BacSi", "ho_ten", `${P} BS %`)) === doctorsBefore);

    // ================= 6. Bác sĩ: danh sách + lọc =================
    r = await get(`/admin/doctors?chuyen_khoa_id=${A}`, ad);
    const idsA = (r.data?.data?.items || []).map((x) => x.id);
    check("Lọc theo chuyên khoa -> đúng 2 bác sĩ", r.status === 200 && idsA.length === 2 && idsA.includes(D1) && idsA.includes(D2), JSON.stringify(idsA));
    r = await get(`/admin/doctors?chuyen_khoa_id=${B}`, ad);
    check("Chuyên khoa chưa có bác sĩ -> 200, danh sách rỗng", r.status === 200 && Array.isArray(r.data?.data?.items) && r.data.data.items.length === 0, `(nhận ${r.status})`);
    r = await get(`/admin/doctors?q=${encodeURIComponent(`${P} BS One`)}`, ad);
    check("Tìm theo tên -> đúng bác sĩ", (r.data?.data?.items || []).length === 1 && r.data.data.items[0].id === D1);
    r = await get("/admin/doctors?q=%25", ad);
    check("q=% được coi là ký tự thường, không khớp tất cả", r.status === 200 && (r.data?.data?.items || []).length === 0, `(nhận ${r.status})`);
    r = await get("/admin/doctors?chuyen_khoa_id=abc", ad);
    check("chuyen_khoa_id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get("/admin/doctors?limit=0", ad);
    check("limit=0 -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`/admin/doctors/${D1}`, ad);
    check("Chi tiết bác sĩ -> 200", r.status === 200 && r.data?.data?.id === D1, `(nhận ${r.status})`);
    r = await get("/admin/doctors/999999999", ad);
    check("Chi tiết bác sĩ không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);

    // ================= 7. Bác sĩ: sửa (D1: khoa A -> khoa B) =================
    r = await put(`/admin/doctors/${D1}`, ad, { cap_bac: "Thac si" });
    check(
      "Sửa cấp bậc -> 200, họ tên/phí/chuyên khoa giữ nguyên",
      r.status === 200 && r.data?.data?.cap_bac === "Thac si" && r.data.data.muc_phi === 150000 && r.data.data.chuyen_khoa?.id === A && r.data.data.ho_ten === `${P} BS One`
    );
    r = await put(`/admin/doctors/${D1}`, ad, { muc_phi: "250000.50" });
    check("Sửa mức phí (chuỗi số) -> 200", r.status === 200 && r.data?.data?.muc_phi === 250000.5, `(nhận ${r.status})`);
    r = await put(`/admin/doctors/${D1}`, ad, { chuyen_khoa_id: B });
    check("Sửa chuyên khoa (A -> B) -> 200", r.status === 200 && r.data?.data?.chuyen_khoa?.id === B, `(nhận ${r.status})`);
    r = await put(`/admin/doctors/${D1}`, ad, { ho_ten: `${P} BS One Moi` });
    check("Sửa họ tên -> 200", r.status === 200 && r.data?.data?.ho_ten === `${P} BS One Moi`, `(nhận ${r.status})`);
    r = await put(`/admin/doctors/${D1}`, ad, { cap_bac: null, muc_phi: null });
    check("Gửi null -> xóa cấp bậc và mức phí", r.status === 200 && r.data?.data?.cap_bac === null && r.data.data.muc_phi === null, `(nhận ${r.status})`);
    const dbD = (await pool.query(`SELECT ho_ten, chuyen_khoa_id, cap_bac, muc_phi FROM "BacSi" WHERE id=$1`, [D1])).rows[0];
    check("DB: dữ liệu bác sĩ đúng sau các lần sửa", dbD.ho_ten === `${P} BS One Moi` && dbD.chuyen_khoa_id === B && dbD.cap_bac === null && dbD.muc_phi === null);
    for (const [body, tag] of [
      [{}, "body rỗng"],
      [{ ho_ten: "   " }, "họ tên toàn khoảng trắng"],
      [{ chuyen_khoa_id: 999999999 }, "chuyên khoa không tồn tại"],
      [{ chuyen_khoa_id: null }, "chuyen_khoa_id null"],
      [{ muc_phi: -5 }, "muc_phi âm"],
    ]) {
      r = await put(`/admin/doctors/${D1}`, ad, body);
      check(`Sửa bác sĩ - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await put("/admin/doctors/999999999", ad, { cap_bac: "x" });
    check("Sửa bác sĩ không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await put("/admin/doctors/abc", ad, { cap_bac: "x" });
    check("Sửa bác sĩ id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ================= 8. Chuyên khoa: xóa =================
    // Trạng thái lúc này: khoa A có D2 (1 bác sĩ), khoa B có D1 (1 bác sĩ)
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: `${P} Khoa C` });
    const C = r.data?.data?.id;
    r = await del(`/admin/specialties/${C}`, ad);
    check("Xóa chuyên khoa chưa có liên kết -> 200", r.status === 200, `(nhận ${r.status})`);
    check("DB: chuyên khoa đã bị xóa", Number((await pool.query(`SELECT COUNT(*) FROM "ChuyenKhoa" WHERE id=$1`, [C])).rows[0].count) === 0);
    r = await del(`/admin/specialties/${C}`, ad);
    check("Xóa lại chuyên khoa đã xóa -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await del("/admin/specialties/abc", ad);
    check("Xóa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // 8.1 Có bác sĩ (khoa A còn D2)
    r = await del(`/admin/specialties/${A}`, ad);
    check(
      "Xóa chuyên khoa đang có bác sĩ -> 409 HAS_REFERENCES (so_bac_si = 1)",
      r.status === 409 && r.data.code === "HAS_REFERENCES" && r.data.data?.so_bac_si === 1,
      `(nhận ${r.status}) ${JSON.stringify(r.data?.data)}`
    );
    check("  -> chuyên khoa và bác sĩ vẫn còn", (await get(`/admin/specialties/${A}`, ad)).status === 200 && (await get(`/admin/doctors/${D2}`, ad)).status === 200);

    // 8.2 Có phòng khám (không có bác sĩ)
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: `${P} Khoa D` });
    const Dk = r.data?.data?.id;
    await mkRoom("Phong D", Dk);
    r = await del(`/admin/specialties/${Dk}`, ad);
    check(
      "Xóa chuyên khoa đang có phòng khám -> 409 HAS_REFERENCES (so_phong = 1, so_bac_si = 0)",
      r.status === 409 && r.data.code === "HAS_REFERENCES" && r.data.data?.so_phong === 1 && r.data.data?.so_bac_si === 0,
      `(nhận ${r.status}) ${JSON.stringify(r.data?.data)}`
    );

    // 8.3 Có lịch hẹn liên kết
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: `${P} Khoa E` });
    const E = r.data?.data?.id;
    const bnE = (await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 1`])).rows[0].id;
    await pool.query(
      `INSERT INTO "DatLichKham" (ma_dat_lich, benh_nhan_id, chuyen_khoa_id, ngay_kham, trang_thai) VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'DA_HUY')`,
      [`${P}-1`, bnE, E]
    );
    r = await del(`/admin/specialties/${E}`, ad);
    check(
      "Xóa chuyên khoa đang có lịch hẹn liên kết -> 409 HAS_REFERENCES (so_lich_hen = 1)",
      r.status === 409 && r.data.code === "HAS_REFERENCES" && r.data.data?.so_lich_hen === 1,
      `(nhận ${r.status}) ${JSON.stringify(r.data?.data)}`
    );

    // 8.4 Hết liên kết bằng cách CHUYỂN bác sĩ sang khoa khác qua API (hệ thống không cho xóa bác sĩ)
    r = await post("/admin/specialties", ad, { ten_chuyen_khoa: `${P} Khoa F` });
    const F = r.data?.data?.id;
    r = await post("/admin/doctors", ad, { ho_ten: `${P} BS Temp`, chuyen_khoa_id: F });
    const DT = r.data?.data?.id;
    r = await del(`/admin/specialties/${F}`, ad);
    check("Chuyên khoa F có bác sĩ -> bị chặn 409", r.status === 409, `(nhận ${r.status})`);
    r = await put(`/admin/doctors/${DT}`, ad, { chuyen_khoa_id: B });
    check("Chuyển bác sĩ F -> khoa B bằng API sửa -> 200", r.status === 200 && r.data?.data?.chuyen_khoa?.id === B, `(nhận ${r.status})`);
    r = await del(`/admin/specialties/${F}`, ad);
    check("Hết liên kết thì xóa chuyên khoa F được -> 200", r.status === 200, `(nhận ${r.status})`);
    r = await get(`/admin/doctors/${DT}`, ad);
    check("Bác sĩ vẫn còn nguyên sau khi xóa chuyên khoa cũ của họ", r.status === 200 && r.data?.data?.chuyen_khoa?.id === B, `(nhận ${r.status})`);

    // 8.5 Khoa B nay có D1 và DT
    r = await del(`/admin/specialties/${B}`, ad);
    check(
      "Xóa chuyên khoa B (có 2 bác sĩ được chuyển sang) -> 409 (so_bac_si = 2)",
      r.status === 409 && r.data.code === "HAS_REFERENCES" && r.data.data?.so_bac_si === 2,
      `(nhận ${r.status}) ${JSON.stringify(r.data?.data)}`
    );

    // ================= 9. Đồng thời =================
    const raceName = `${P} Khoa Race`;
    const rsC = await Promise.all([1, 2, 3, 4].map(() => post("/admin/specialties", ad, { ten_chuyen_khoa: raceName })));
    check(
      "Tạo trùng tên đồng thời: đúng 1 thành công, 3 bị 409",
      rsC.filter((x) => x.status === 201).length === 1 && rsC.filter((x) => x.status === 409).length === 3,
      JSON.stringify(rsC.map((x) => x.status))
    );
    check("Đồng thời: DB chỉ có 1 chuyên khoa tên đó", (await countLike("ChuyenKhoa", "LOWER(ten_chuyen_khoa)", raceName.toLowerCase())) === 1);

    // ================= 10. Booking: dữ liệu admin sửa phải phản ánh đúng =================
    const S1n = `${P} Khoa S1`, S2n = `${P} Khoa S2`;
    const S1 = (await post("/admin/specialties", ad, { ten_chuyen_khoa: S1n })).data?.data?.id;
    const S2 = (await post("/admin/specialties", ad, { ten_chuyen_khoa: S2n })).data?.data?.id;
    const bkName = `${P} BS Book`;
    const bk = (await post("/admin/doctors", ad, { ho_ten: bkName, chuyen_khoa_id: S1, cap_bac: "Cap1", muc_phi: 100000 })).data?.data?.id;
    const room = await mkRoom("Phong Book", S1);
    const slot1 = await mkSlot(bk, room, 3);
    const slot2 = await mkSlot(bk, room, 4);

    r = await get(`/master/chuyen-khoa`, ptTok);
    check("Master: /master/chuyen-khoa trả chuyên khoa mới tạo từ admin", r.status === 200 && JSON.stringify(r.data).includes(S1n), `(nhận ${r.status})`);
    const m1 = await get(`/master/bac-si`, ptTok);
    const m2 = await get(`/master/bac-si?chuyen_khoa_id=${S1}`, ptTok);
    check("Master: /master/bac-si trả bác sĩ mới tạo từ admin", JSON.stringify(m1.data).includes(bkName) || JSON.stringify(m2.data).includes(bkName), `(nhận ${m1.status}/${m2.status})`);

    r = await get(`/slots?bac_si_id=${bk}&ngay=${slot1.ngay}`, ptTok);
    check("Slot (C2-04): thấy lịch của bác sĩ vừa tạo từ admin", r.status === 200 && JSON.stringify(r.data).includes(`"lich_kham_id":${slot1.id}`), `(nhận ${r.status})`);

    r = await post("/appointments", ptTok, { lich_kham_id: slot1.id });
    check("Booking (C2-06) lần 1 -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const a1 = r.data?.data;
    check(
      "Booking lần 1: đúng bác sĩ, cấp bậc, chuyên khoa, phí cũ",
      a1?.doctor?.ho_ten === bkName && a1.doctor.cap_bac === "Cap1" && a1.specialty?.id === S1 && Number(a1.appointment?.phi_kham) === 100000,
      JSON.stringify({ d: a1?.doctor, s: a1?.specialty, phi: a1?.appointment?.phi_kham })
    );

    r = await put(`/admin/doctors/${bk}`, ad, { chuyen_khoa_id: S2, cap_bac: "Cap2", muc_phi: 250000 });
    check("Admin đổi chuyên khoa/cấp bậc/phí của bác sĩ -> 200", r.status === 200, `(nhận ${r.status})`);

    r = await post("/appointments", ptTok, { lich_kham_id: slot2.id });
    check("Booking lần 2 -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const a2 = r.data?.data;
    check(
      "Giá và thông tin mới áp dụng cho lượt đặt tiếp theo (chuyên khoa S2, Cap2, 250000)",
      a2?.specialty?.id === S2 && a2.doctor?.cap_bac === "Cap2" && Number(a2.appointment?.phi_kham) === 250000,
      JSON.stringify({ s: a2?.specialty, c: a2?.doctor?.cap_bac, phi: a2?.appointment?.phi_kham })
    );
    const old = (await pool.query(`SELECT phi_kham, chuyen_khoa_id FROM "DatLichKham" WHERE ma_dat_lich = $1`, [a1?.appointment?.ma_dat_lich])).rows[0];
    check("Lịch đã đặt trước đó giữ nguyên giá và chuyên khoa cũ", Number(old?.phi_kham) === 100000 && old.chuyen_khoa_id === S1, JSON.stringify(old));

    // ================= 11. Regression =================
    r = await get("/health");
    check("Regression /health -> 200", r.status === 200);
    r = await get("/auth/me", ptTok);
    check("Regression /auth/me -> 200", r.status === 200);
  } catch (e) {
    fail++;
    console.error("SCRIPT LỖI:", e);
  } finally {
    await cleanup();
    console.log(`\nKẾT QUẢ: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
})();
