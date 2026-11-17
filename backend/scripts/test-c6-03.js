const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `ZZC${sfx}`;
const U = (t) => `zzc${sfx}_${t}`;
let pass = 0, fail = 0, pwHash;

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
const patch = (p, t, b) => api("PATCH", p, b === undefined ? {} : b, t);
const login = (username, password = "123456") => api("POST", "/auth/login", { username, password });
const loginOk = (r) => r.status === 200 && !!r.data?.data?.token;

const mkUser = async (roleName, tag) => {
  const roleId = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [roleName])).rows[0].id;
  const username = U(tag);
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const l = await login(username);
  return { id: r.rows[0].id, username, token: l.data?.data?.token };
};

const countAcc = async () =>
  Number((await pool.query(`SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzc${sfx}_%`])).rows[0].count);

const cleanup = async () => {
  try {
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1)`,
      [`zzc${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzc${sfx}_%`]);
    const l = {
      tk: await countAcc(),
      bs: Number((await pool.query(`SELECT COUNT(*) FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`])).rows[0].count),
    };
    console.log(`\nDọn dữ liệu xong. Còn sót: TaiKhoan=${l.tk}, BacSi=${l.bs} (phải = 0)`);
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    const adU = await mkUser("Quản trị viên", "ad");
    const ad = adU.token;
    const docU = await mkUser("Bác sĩ", "doc");
    const ltU = await mkUser("Lễ tân", "lt");
    const xnU = await mkUser("Xét nghiệm", "xn");
    const ptName = U("pt");
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await login(ptName)).data.data.token;

    // ================= 1. Xác thực và vai trò =================
    let r = await get("/admin/accounts");
    check("GET /admin/accounts - không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    for (const [tag, tok] of [["bệnh nhân", ptTok], ["bác sĩ", docU.token], ["lễ tân", ltU.token], ["xét nghiệm", xnU.token]]) {
      const codes = [
        (await get("/admin/accounts", tok)).status,
        (await get(`/admin/accounts/${docU.id}`, tok)).status,
        (await post("/admin/accounts", tok, { ten_dang_nhap: U("forbid"), password: "123456", vai_tro: "Lễ tân" })).status,
        (await put(`/admin/accounts/${docU.id}`, tok, { password: "654321" })).status,
        (await patch(`/admin/accounts/${docU.id}/status`, tok, { trang_thai: "BiKhoa" })).status,
      ];
      check(`Vai trò ${tag}: mọi API admin/accounts -> 403`, codes.every((c) => c === 403), JSON.stringify(codes));
    }
    check("Bị từ chối thì không tạo/sửa dữ liệu", !(await login(U("forbid"))).data?.data?.token && loginOk(await login(docU.username)));

    // ================= 2. Tạo tài khoản =================
    const mk = async (role, tag, extra = {}) => post("/admin/accounts", ad, { ten_dang_nhap: U(tag), password: "123456", vai_tro: role, ...extra });

    r = await mk("Bác sĩ", "newdoc");
    check("Tạo tài khoản Bác sĩ -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const accDoc = r.data?.data;
    check("Response đủ id, ten_dang_nhap, vai_tro, trang_thai = HoatDong, không lộ mật khẩu", accDoc?.id > 0 && accDoc.ten_dang_nhap === U("newdoc") && accDoc.vai_tro === "Bác sĩ" && accDoc.trang_thai === "HoatDong" && !JSON.stringify(r.data).includes("mat_khau") && !JSON.stringify(r.data).includes("password"), JSON.stringify(accDoc));
    r = await mk("Lễ tân", "newlt");
    check("Tạo tài khoản Lễ tân -> 201", r.status === 201, `(nhận ${r.status})`);
    const accLt = r.data?.data;
    r = await mk("Xét nghiệm", "newxn");
    check("Tạo tài khoản Xét nghiệm -> 201", r.status === 201, `(nhận ${r.status})`);
    const accXn = r.data?.data;

    const dbRow = (await pool.query(`SELECT mat_khau, trang_thai FROM "TaiKhoan" WHERE id = $1`, [accDoc?.id])).rows[0];
    check("DB: mật khẩu được hash bcrypt, không lưu plain text", !!dbRow && dbRow.mat_khau !== "123456" && /^\$2[aby]\$/.test(dbRow.mat_khau) && (await bcrypt.compare("123456", dbRow.mat_khau)));
    for (const [tag, u] of [["Bác sĩ", U("newdoc")], ["Lễ tân", U("newlt")], ["Xét nghiệm", U("newxn")]]) {
      r = await login(u);
      check(`Account ${tag} mới tạo đăng nhập được`, loginOk(r), `(nhận ${r.status})`);
    }
    r = await post("/admin/accounts", ad, { ten_dang_nhap: `  ${U("trim")}  `, password: "123456", vai_tro: " Lễ tân " });
    check("Username và vai_tro được trim -> 201", r.status === 201 && r.data?.data?.ten_dang_nhap === U("trim") && r.data.data.vai_tro === "Lễ tân", `(nhận ${r.status})`);

    // ---- Trùng username ----
    for (const [name, tag] of [[U("newdoc"), "trùng y hệt"], [U("newdoc").toUpperCase(), "trùng khác hoa thường"], [`  ${U("newdoc")}  `, "trùng có khoảng trắng thừa"]]) {
      r = await post("/admin/accounts", ad, { ten_dang_nhap: name, password: "123456", vai_tro: "Lễ tân" });
      check(`Username ${tag} -> 409 DUPLICATE_USERNAME`, r.status === 409 && r.data.code === "DUPLICATE_USERNAME", `(nhận ${r.status})`);
    }
    r = await post("/admin/accounts", ad, { ten_dang_nhap: docU.username, password: "123456", vai_tro: "Lễ tân" });
    check("Username trùng tài khoản có sẵn (không do API tạo) -> 409", r.status === 409, `(nhận ${r.status})`);
    const raceName = U("race");
    const rsC = await Promise.all([1, 2, 3, 4].map(() => post("/admin/accounts", ad, { ten_dang_nhap: raceName, password: "123456", vai_tro: "Lễ tân" })));
    check("Tạo trùng đồng thời: đúng 1 thành công, 3 bị 409", rsC.filter((x) => x.status === 201).length === 1 && rsC.filter((x) => x.status === 409).length === 3, JSON.stringify(rsC.map((x) => x.status)));

    // ---- Validate ----
    const before = await countAcc();
    const bad = [
      [{ password: "123456", vai_tro: "Lễ tân" }, "thiếu username"],
      [{ ten_dang_nhap: "ab", password: "123456", vai_tro: "Lễ tân" }, "username quá ngắn"],
      [{ ten_dang_nhap: U("x") + "a".repeat(60), password: "123456", vai_tro: "Lễ tân" }, "username quá dài"],
      [{ ten_dang_nhap: U("co khoang trang"), password: "123456", vai_tro: "Lễ tân" }, "username có khoảng trắng/ký tự lạ"],
      [{ ten_dang_nhap: 12345678, password: "123456", vai_tro: "Lễ tân" }, "username sai kiểu"],
      [{ ten_dang_nhap: U("b1"), vai_tro: "Lễ tân" }, "thiếu password"],
      [{ ten_dang_nhap: U("b2"), password: "123", vai_tro: "Lễ tân" }, "password quá ngắn"],
      [{ ten_dang_nhap: U("b3"), password: "a".repeat(73), vai_tro: "Lễ tân" }, "password quá dài (>72)"],
      [{ ten_dang_nhap: U("b4"), password: 123456, vai_tro: "Lễ tân" }, "password sai kiểu"],
      [{ ten_dang_nhap: U("b5"), password: "123456" }, "thiếu vai_tro"],
      [{ ten_dang_nhap: U("b6"), password: "123456", vai_tro: "Quản trị viên" }, "role Quản trị viên"],
      [{ ten_dang_nhap: U("b7"), password: "123456", vai_tro: "Bệnh nhân" }, "role Bệnh nhân"],
      [{ ten_dang_nhap: U("b8"), password: "123456", vai_tro: "Role Khong Co" }, "role không tồn tại"],
      [{ ten_dang_nhap: U("b9"), password: "123456", vai_tro: 3 }, "vai_tro sai kiểu"],
      [{ ten_dang_nhap: U("b10"), password: "123456", vai_tro: "Lễ tân", bac_si_id: 1 }, "bac_si_id với role không phải Bác sĩ"],
      [{ ten_dang_nhap: U("b11"), password: "123456", vai_tro: "Bác sĩ", bac_si_id: 999999999 }, "bac_si_id không tồn tại"],
      [{ ten_dang_nhap: U("b12"), password: "123456", vai_tro: "Bác sĩ", bac_si_id: "abc" }, "bac_si_id sai kiểu"],
      [[], "body là mảng"],
    ];
    for (const [body, tag] of bad) {
      r = await post("/admin/accounts", ad, body);
      check(`Tạo account - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("Input lỗi không tạo thêm tài khoản", (await countAcc()) === before);

    // ---- Liên kết hồ sơ bác sĩ ----
    const bsId = (await pool.query(`INSERT INTO "BacSi" (ho_ten, cap_bac) VALUES ($1,'Test') RETURNING id`, [`${P} BS Link`])).rows[0].id;
    r = await mk("Bác sĩ", "linkdoc", { bac_si_id: bsId });
    check("Tạo account Bác sĩ gắn hồ sơ bac_si_id -> 201, response có bac_si", r.status === 201 && r.data?.data?.bac_si?.id === bsId, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const linkedId = r.data?.data?.id;
    const dbBs = (await pool.query(`SELECT tai_khoan_id FROM "BacSi" WHERE id = $1`, [bsId])).rows[0];
    check("DB: BacSi.tai_khoan_id trỏ đúng tài khoản mới", dbBs.tai_khoan_id === linkedId);
    r = await mk("Bác sĩ", "linkdoc2", { bac_si_id: bsId });
    check("Gắn bác sĩ đã có tài khoản -> 409 BACSI_ALREADY_LINKED", r.status === 409 && r.data.code === "BACSI_ALREADY_LINKED", `(nhận ${r.status})`);
    check("  -> không tạo tài khoản rác", !(await pool.query(`SELECT 1 FROM "TaiKhoan" WHERE ten_dang_nhap = $1`, [U("linkdoc2")])).rowCount);

    // ================= 3. Danh sách + lọc =================
    r = await get(`/admin/accounts?q=${sfx}`, ad);
    const items = r.data?.data?.items || [];
    const idsAll = items.map((x) => x.id);
    check("Danh sách trả account nhân viên vừa tạo, đủ field", r.status === 200 && [accDoc.id, accLt.id, accXn.id, docU.id, ltU.id, xnU.id].every((i) => idsAll.includes(i)) && items.every((x) => x.id && x.ten_dang_nhap && x.vai_tro && x.trang_thai && "phong_kham_id" in x && "bac_si" in x), `(nhận ${r.status})`);
    check("Danh sách KHÔNG có tài khoản Quản trị viên và Bệnh nhân", !idsAll.includes(adU.id) && !items.some((x) => x.ten_dang_nhap === ptName));
    check("Danh sách không lộ mật khẩu", !JSON.stringify(r.data).includes("mat_khau") && !JSON.stringify(r.data).includes("$2"));
    check("Chỉ có 3 vai trò nhân viên", items.every((x) => ["Bác sĩ", "Lễ tân", "Xét nghiệm"].includes(x.vai_tro)));
    r = await get(`/admin/accounts?vai_tro=${encodeURIComponent("Lễ tân")}&q=${sfx}`, ad);
    check("Lọc theo vai_tro = Lễ tân", (r.data?.data?.items || []).length > 0 && r.data.data.items.every((x) => x.vai_tro === "Lễ tân") && r.data.data.items.some((x) => x.id === accLt.id));
    r = await get(`/admin/accounts?vai_tro=${encodeURIComponent("Xét nghiệm")}&q=${sfx}`, ad);
    check("Lọc theo vai_tro = Xét nghiệm", (r.data?.data?.items || []).every((x) => x.vai_tro === "Xét nghiệm") && r.data.data.items.some((x) => x.id === accXn.id));
    r = await get(`/admin/accounts?q=${U("newlt")}`, ad);
    check("Tìm theo username -> đúng 1 account", (r.data?.data?.items || []).length === 1 && r.data.data.items[0].id === accLt.id);
    r = await get("/admin/accounts?q=%25", ad);
    check("q=% được coi là ký tự thường, không khớp tất cả", r.status === 200 && (r.data?.data?.items || []).length === 0, `(nhận ${r.status})`);
    r = await get("/admin/accounts?vai_tro=Quan%20tri%20vien", ad);
    check("Lọc vai_tro không hợp lệ -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`/admin/accounts?vai_tro=${encodeURIComponent("Quản trị viên")}`, ad);
    check("Lọc vai_tro = Quản trị viên -> 400 (API này không quản lý admin)", r.status === 400, `(nhận ${r.status})`);
    r = await get("/admin/accounts?trang_thai=ABC", ad);
    check("Lọc trang_thai không hợp lệ -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get("/admin/accounts?limit=0", ad);
    check("limit=0 -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`/admin/accounts?q=${sfx}&limit=2`, ad);
    check("limit=2 -> tối đa 2 account", r.status === 200 && (r.data?.data?.items || []).length === 2, `(nhận ${r.status})`);
    r = await get(`/admin/accounts?q=${U("linkdoc")}`, ad);
    check("Account bác sĩ đã gắn hồ sơ hiện bac_si trong danh sách", r.data?.data?.items?.[0]?.bac_si?.id === bsId);

    // ---- Chi tiết ----
    r = await get(`/admin/accounts/${accDoc.id}`, ad);
    check("Chi tiết account -> 200", r.status === 200 && r.data?.data?.id === accDoc.id, `(nhận ${r.status})`);
    r = await get("/admin/accounts/999999999", ad);
    check("Chi tiết account không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get("/admin/accounts/abc", ad);
    check("Chi tiết id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get(`/admin/accounts/${adU.id}`, ad);
    check("Chi tiết tài khoản Quản trị viên -> 404 (ngoài phạm vi)", r.status === 404, `(nhận ${r.status})`);

    // ================= 4. Khóa / mở khóa =================
    r = await patch(`/admin/accounts/${accLt.id}/status`, ad, { trang_thai: "BiKhoa" });
    check("Khóa account -> 200, trang_thai = BiKhoa", r.status === 200 && r.data?.data?.trang_thai === "BiKhoa", `(nhận ${r.status})`);
    r = await login(U("newlt"));
    check("Account bị khóa -> login thất bại, không có token", !loginOk(r), `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    r = await login(U("newlt"), "sai-mat-khau");
    check("Account bị khóa + sai mật khẩu -> vẫn thất bại", !loginOk(r), `(nhận ${r.status})`);
    check("DB: trang_thai = BiKhoa", (await pool.query(`SELECT trang_thai FROM "TaiKhoan" WHERE id = $1`, [accLt.id])).rows[0].trang_thai === "BiKhoa");
    r = await get(`/admin/accounts?trang_thai=BiKhoa&q=${sfx}`, ad);
    check("Lọc trang_thai = BiKhoa chỉ có account bị khóa", (r.data?.data?.items || []).length === 1 && r.data.data.items[0].id === accLt.id, JSON.stringify((r.data?.data?.items || []).map((x) => x.id)));
    r = await patch(`/admin/accounts/${accLt.id}/status`, ad, { trang_thai: "BiKhoa" });
    check("Khóa lại account đã khóa -> 200 (idempotent)", r.status === 200 && r.data?.data?.trang_thai === "BiKhoa", `(nhận ${r.status})`);
    r = await patch(`/admin/accounts/${accLt.id}/status`, ad, { trang_thai: "HoatDong" });
    check("Mở khóa account -> 200, trang_thai = HoatDong", r.status === 200 && r.data?.data?.trang_thai === "HoatDong", `(nhận ${r.status})`);
    r = await login(U("newlt"));
    check("Mở khóa -> login lại được", loginOk(r), `(nhận ${r.status})`);

    for (const [body, tag] of [[{}, "thiếu trang_thai"], [{ trang_thai: "ABC" }, "trang_thai không hợp lệ"], [{ trang_thai: "hoatdong" }, "sai hoa thường"], [{ trang_thai: 1 }, "sai kiểu"]]) {
      r = await patch(`/admin/accounts/${accLt.id}/status`, ad, body);
      check(`Khóa/mở khóa - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await patch("/admin/accounts/999999999/status", ad, { trang_thai: "BiKhoa" });
    check("Khóa account không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await patch("/admin/accounts/abc/status", ad, { trang_thai: "BiKhoa" });
    check("Khóa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await patch(`/admin/accounts/${adU.id}/status`, ad, { trang_thai: "BiKhoa" });
    check("Admin tự khóa mình -> 400 CANNOT_LOCK_SELF", r.status === 400 && r.data.code === "CANNOT_LOCK_SELF", `(nhận ${r.status})`);
    check("  -> admin vẫn đăng nhập được", loginOk(await login(adU.username)));

    // Thông tin tham khảo (không tính PASS/FAIL): token cũ của account vừa bị khóa còn dùng được không?
    await patch(`/admin/accounts/${xnU.id}/status`, ad, { trang_thai: "BiKhoa" });
    const oldTok = await get("/auth/me", xnU.token);
    console.log(`INFO  Token đã cấp trước khi khóa: /auth/me -> ${oldTok.status} ${oldTok.status === 200 ? "(token cũ vẫn dùng được đến khi hết hạn, cân nhắc cho middleware kiểm tra trạng thái)" : "(đã bị chặn)"}`);
    await patch(`/admin/accounts/${xnU.id}/status`, ad, { trang_thai: "HoatDong" });

    // ================= 5. Sửa account =================
    r = await put(`/admin/accounts/${accXn.id}`, ad, { password: "newpass1" });
    check("Đổi mật khẩu -> 200", r.status === 200, `(nhận ${r.status})`);
    check("Mật khẩu cũ không còn đăng nhập được", !loginOk(await login(U("newxn"), "123456")));
    check("Mật khẩu mới đăng nhập được", loginOk(await login(U("newxn"), "newpass1")));
    const h2 = (await pool.query(`SELECT mat_khau FROM "TaiKhoan" WHERE id = $1`, [accXn.id])).rows[0].mat_khau;
    check("DB: mật khẩu mới cũng được hash", /^\$2[aby]\$/.test(h2) && h2 !== "newpass1");

    r = await put(`/admin/accounts/${accXn.id}`, ad, { ten_dang_nhap: U("newxn2") });
    check("Đổi username -> 200", r.status === 200 && r.data?.data?.ten_dang_nhap === U("newxn2") && r.data.data.vai_tro === "Xét nghiệm", `(nhận ${r.status})`);
    check("Đăng nhập bằng username mới được", loginOk(await login(U("newxn2"), "newpass1")));
    r = await put(`/admin/accounts/${accXn.id}`, ad, { ten_dang_nhap: U("newlt").toUpperCase() });
    check("Đổi username thành tên đã có (khác hoa thường) -> 409", r.status === 409 && r.data.code === "DUPLICATE_USERNAME", `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${accXn.id}`, ad, { ten_dang_nhap: U("newxn2") });
    check("Giữ nguyên username của chính nó -> 200", r.status === 200, `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${accLt.id}`, ad, { vai_tro: "Xét nghiệm" });
    check("Đổi vai trò Lễ tân -> Xét nghiệm -> 200", r.status === 200 && r.data?.data?.vai_tro === "Xét nghiệm", `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${accLt.id}`, ad, { vai_tro: "Quản trị viên" });
    check("Đổi vai trò thành Quản trị viên -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${linkedId}`, ad, { vai_tro: "Lễ tân" });
    check("Đổi vai trò account bác sĩ đã gắn hồ sơ -> 409 ROLE_LINKED", r.status === 409 && r.data.code === "ROLE_LINKED", `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${accLt.id}`, ad, { password: "newpass2", ten_dang_nhap: U("newlt2") });
    check("Sửa nhiều field cùng lúc -> 200", r.status === 200 && r.data?.data?.ten_dang_nhap === U("newlt2") && loginOk(await login(U("newlt2"), "newpass2")), `(nhận ${r.status})`);
    for (const [body, tag] of [[{}, "body rỗng"], [{ password: "123" }, "password quá ngắn"], [{ ten_dang_nhap: "a b" }, "username sai"], [{ vai_tro: "Role Khong Co" }, "role không hợp lệ"], [[], "body là mảng"]]) {
      r = await put(`/admin/accounts/${accXn.id}`, ad, body);
      check(`Sửa account - ${tag} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await put("/admin/accounts/999999999", ad, { password: "123456" });
    check("Sửa account không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await put("/admin/accounts/abc", ad, { password: "123456" });
    check("Sửa id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await put(`/admin/accounts/${adU.id}`, ad, { password: "hacked123" });
    check("Sửa tài khoản Quản trị viên qua API này -> 404", r.status === 404 && loginOk(await login(adU.username)), `(nhận ${r.status})`);

    // ================= 6. Regression =================
    r = await get("/health");
    check("Regression /health -> 200", r.status === 200);
    r = await get("/auth/me", ptTok);
    check("Regression /auth/me (bệnh nhân) -> 200", r.status === 200);
    check("Regression: bệnh nhân vẫn đăng ký và đăng nhập được", loginOk(await login(ptName)));
    check("Regression: tài khoản seed cũ vẫn đăng nhập được", loginOk(await login(docU.username)) && loginOk(await login(ltU.username)));
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