// Test C5-03: nộp kết quả xét nghiệm (upload file) và hoàn tất chỉ định DANG_XU_LY -> DA_XONG
// Chạy: bật server (npm run dev) rồi `npm run api:test-c5-03`. Script tự tạo và tự dọn dữ liệu + file test.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { UPLOAD_ROOT, RESULT_DIR } = require("../src/utils/labResultFile");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `ZZR${sfx}`;
let pass = 0, fail = 0, n = 0, pwHash, roleXN, roleBS;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
};

const json = async (res) => ({ status: res.status, data: await res.json().catch(() => ({})), res });
const auth = (t) => (t ? { Authorization: `Bearer ${t}` } : {});
const api = async (method, p, body, t) =>
  json(await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", ...auth(t) }, body: body ? JSON.stringify(body) : undefined }));
const get = (p, t) => api("GET", p, null, t);

// ---- file mẫu (chữ ký byte hợp lệ) ----
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"), Buffer.alloc(200, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 9)]);
const TXT = Buffer.from("day la file text, khong phai pdf hay anh. ".repeat(10));
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(300, 1)]);

// POST multipart: opts { field, filename, type, moTa, noFile }
const upload = async (orderId, token, buf, opts = {}) => {
  const fd = new FormData();
  if (!opts.noFile) fd.append(opts.field || "file", new Blob([buf], { type: opts.type || "application/octet-stream" }), opts.filename || "kq.pdf");
  if (opts.moTa !== undefined) fd.append("mo_ta", opts.moTa);
  return json(await fetch(`${BASE}/lab/orders/${orderId}/result`, { method: "POST", headers: auth(token), body: fd }));
};

const mkRoom = async (name) =>
  (await pool.query(`INSERT INTO "PhongKham" (ten_phong, loai_phong) VALUES ($1,'Xet nghiem') RETURNING id`, [`${P} ${name}`])).rows[0].id;

const mkUser = async (roleId, tag, roomId = null) => {
  const username = `zzr${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai, phong_kham_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE, roomId]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkDoctor = async (tag, ck) => {
  const u = await mkUser(roleBS, `d_${tag}`);
  const bs = (
    await pool.query(
      `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
      [u.id, `${P} BS ${tag}`, ck]
    )
  ).rows[0].id;
  return { ...u, bsId: bs };
};

const mkVisit = async (roomId, bsId, tag) => {
  const bn = (
    await pool.query(
      `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, ma_bhyt, dia_chi) VALUES ($1,'1990-05-20','Nam',$2,'Ha Noi') RETURNING id`,
      [`${P} BN ${tag}`, `${P}${++n}`]
    )
  ).rows[0].id;
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
       VALUES ($1,$2,$3,$4,'ONLINE','DANG_KHAM',1,0,NOW()) RETURNING id`,
      [bn, n, roomId, bsId]
    )
  ).rows[0].id;
  return (
    await pool.query(
      `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'DANG_KHAM') RETURNING id`,
      [hd, bn, bsId]
    )
  ).rows[0].id;
};

const mkOrder = async (hsId, roomId, state, staffId = null) => {
  const r = await pool.query(
    `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, trang_thai, ten_xet_nghiem, ghi_chu, nhan_vien_xu_ly_id, thoi_gian_bat_dau)
     VALUES ($1,$2,$3,$4,'ghi chu',$5::int, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() - interval '5 minutes' END) RETURNING id`,
    [hsId, roomId, state, `${P} XN ${++n}`, staffId]
  );
  return r.rows[0].id;
};

const dbOrder = async (id) =>
  (
    await pool.query(
      `SELECT trang_thai, thoi_gian_hoan_thanh, nhan_vien_xu_ly_id,
              (thoi_gian_hoan_thanh > NOW() - interval '30 seconds') AS vua_xong
       FROM "ChiDinhXetNghiem" WHERE id = $1`,
      [id]
    )
  ).rows[0];
const dbKq = async (id) => (await pool.query(`SELECT * FROM "KetQuaXetNghiem" WHERE chi_dinh_id = $1`, [id])).rows;
const filesInDir = () => (fs.existsSync(RESULT_DIR) ? fs.readdirSync(RESULT_DIR).length : 0);

const cleanup = async () => {
  try {
    const orders = `SELECT id FROM "ChiDinhXetNghiem" WHERE ten_xet_nghiem LIKE $1`;
    const files = await pool.query(`SELECT file_ket_qua FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    for (const f of files.rows) {
      if (/^lab-results\/[\w.-]+$/.test(f.file_ket_qua || "")) fs.rmSync(path.join(UPLOAD_ROOT, f.file_ket_qua), { force: true });
    }
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    const hs = `SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`;
    await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hs}) OR ten_xet_nghiem LIKE $2`, [`${P} BN %`, `${P} XN %`]);
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (${hs})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzr${sfx}_%`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    console.log("\nĐã dọn dữ liệu và file test.");
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleXN = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Xét nghiệm'`)).rows[0].id;
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    const ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const roomA = await mkRoom("Phong A");
    const roomB = await mkRoom("Phong B");
    const staffA = await mkUser(roleXN, "xnA", roomA);
    const staffA2 = await mkUser(roleXN, "xnA2", roomA);
    const staffB = await mkUser(roleXN, "xnB", roomB);
    const staffNoRoom = await mkUser(roleXN, "xnNone", null);
    const docA = await mkDoctor("A", ck);
    const docB = await mkDoctor("B", ck);
    const hsA = await mkVisit(roomA, docA.bsId, "A");

    // ---- Xác thực / vai trò ----
    const o0 = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    let r = await upload(o0, null, PDF);
    check("Không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    r = await upload(o0, docA.token, PDF);
    check("Role Bác sĩ nộp kết quả -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await upload(o0, staffNoRoom.token, PDF);
    check("Nhân viên chưa gán phòng -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await upload(o0, staffB.token, PDF);
    check("Nhân viên phòng khác -> 403", r.status === 403, `(nhận ${r.status})`);
    check("Bị từ chối thì không tạo kết quả / không đổi trạng thái", (await dbKq(o0)).length === 0 && (await dbOrder(o0)).trang_thai === "DANG_XU_LY");

    // ---- id ----
    for (const bad of ["abc", "0", "-3", "99999999999"]) {
      r = await upload(bad, staffA.token, PDF);
      check(`id="${bad}" -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await upload(999999999, staffA.token, PDF);
    check("id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);

    // ---- Trạng thái ----
    const oCho = await mkOrder(hsA, roomA, "CHO_XU_LY");
    r = await upload(oCho, staffA.token, PDF);
    check("CHO_XU_LY (chưa start) -> 409 INVALID_STATE", r.status === 409 && r.data.code === "INVALID_STATE", `(nhận ${r.status})`);
    check("CHO_XU_LY không bị đổi / không tạo kết quả", (await dbOrder(oCho)).trang_thai === "CHO_XU_LY" && (await dbKq(oCho)).length === 0);

    // ---- File không hợp lệ (không để lại file rác) ----
    const filesBefore = filesInDir();
    r = await upload(o0, staffA.token, TXT, { filename: "gia.pdf", type: "application/pdf" });
    check("File text đổi đuôi .pdf -> 415", r.status === 415 && r.data.code === "INVALID_FILE_TYPE", `(nhận ${r.status})`);
    r = await upload(o0, staffA.token, EXE, { filename: "a.png", type: "image/png" });
    check("File exe giả ảnh -> 415", r.status === 415, `(nhận ${r.status})`);
    r = await upload(o0, staffA.token, Buffer.alloc(0), { filename: "rong.pdf" });
    check("File rỗng -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await upload(o0, staffA.token, null, { noFile: true });
    check("Thiếu file -> 400 FILE_REQUIRED", r.status === 400 && r.data.code === "FILE_REQUIRED", `(nhận ${r.status})`);
    r = await upload(o0, staffA.token, PDF, { field: "tep" });
    check("Sai tên field file -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await upload(o0, staffA.token, PDF, { moTa: "x".repeat(10001) });
    check("mo_ta quá dài -> 400", r.status === 400, `(nhận ${r.status})`);
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(10 * 1024 * 1024 + 10, 0x20)]);
    r = await upload(o0, staffA.token, big);
    check("File > 10MB -> 413 FILE_TOO_LARGE", r.status === 413 && r.data.code === "FILE_TOO_LARGE", `(nhận ${r.status})`);
    r = await api("POST", `/lab/orders/${o0}/result`, { mo_ta: "json" }, staffA.token);
    check("Gửi JSON thay vì multipart -> 400", r.status === 400, `(nhận ${r.status})`);
    check("Mọi request lỗi: không tạo kết quả, không đổi trạng thái", (await dbKq(o0)).length === 0 && (await dbOrder(o0)).trang_thai === "DANG_XU_LY");
    check("Mọi request lỗi: không để file mồ côi trên đĩa", filesInDir() === filesBefore, `(trước ${filesBefore}, sau ${filesInDir()})`);

    // ---- Nộp PDF thành công ----
    r = await upload(o0, staffA2.token, PDF, { moTa: "  Hb 13.5 g/dL, binh thuong  ", filename: "../../etc/passwd.pdf" });
    check("Upload PDF hợp lệ -> 201", r.status === 201, `(nhận ${r.status} ${r.data.message || ""})`);
    const kq = r.data?.data?.ket_qua, cd = r.data?.data?.chi_dinh;
    check("Chỉ định -> DA_XONG", cd?.trang_thai === "DA_XONG" && (await dbOrder(o0)).trang_thai === "DA_XONG");
    check("Ghi thoi_gian_hoan_thanh", !!cd?.thoi_gian_hoan_thanh && (await dbOrder(o0)).vua_xong === true);
    check("Giữ nhan_vien_xu_ly_id lúc start", (await dbOrder(o0)).nhan_vien_xu_ly_id === staffA.id);
    const rows = await dbKq(o0);
    check("Tạo đúng 1 KetQuaXetNghiem gắn đúng chi_dinh_id", rows.length === 1 && rows[0].chi_dinh_id === o0 && kq?.chi_dinh_id === o0);
    check("mo_ta được trim và lưu", rows[0]?.mo_ta === "Hb 13.5 g/dL, binh thuong" && kq?.mo_ta === rows[0]?.mo_ta);
    check("file_ket_qua là tên do server sinh (không dùng tên client)", /^lab-results\/kqxn-\d+-\d+-[0-9a-f]{12}\.pdf$/.test(rows[0]?.file_ket_qua || ""), `(${rows[0]?.file_ket_qua})`);
    check("File có trên đĩa", fs.existsSync(path.join(UPLOAD_ROOT, rows[0]?.file_ket_qua || "x")));

    // ---- Mở lại file ----
    let f = await fetch(BASE + `/lab/orders/${o0}/result/file`, { headers: auth(staffA.token) });
    let body = Buffer.from(await f.arrayBuffer());
    check("Nhân viên cùng phòng mở lại file: đúng nội dung + Content-Type", f.status === 200 && body.equals(PDF) && f.headers.get("content-type") === "application/pdf");
    check("File có nosniff", f.headers.get("x-content-type-options") === "nosniff");
    f = await fetch(BASE + `/lab/orders/${o0}/result/file`, { headers: auth(staffB.token) });
    check("Nhân viên phòng khác mở file -> 403", f.status === 403, `(nhận ${f.status})`);
    f = await fetch(BASE + `/lab/orders/${o0}/result/file`);
    check("Không đăng nhập mở file -> 401", f.status === 401, `(nhận ${f.status})`);
    f = await fetch(BASE + `/lab-orders/${o0}/result/file`, { headers: auth(docA.token) });
    body = Buffer.from(await f.arrayBuffer());
    check("Bác sĩ chủ hồ sơ mở lại file -> đúng nội dung", f.status === 200 && body.equals(PDF));
    f = await fetch(BASE + `/lab-orders/${o0}/result/file`, { headers: auth(docB.token) });
    check("Bác sĩ khác mở file -> 403", f.status === 403, `(nhận ${f.status})`);
    f = await fetch(BASE + `/lab-orders/${oCho}/result/file`, { headers: auth(docA.token) });
    check("Chỉ định chưa có kết quả -> 404", f.status === 404, `(nhận ${f.status})`);

    // ---- Contract đọc kết quả ----
    r = await get(`/lab/orders/${o0}/result`, staffA.token);
    check("GET result (nhân viên) trả chi_dinh + ket_qua đầy đủ", r.status === 200 && r.data.data.chi_dinh.trang_thai === "DA_XONG" && r.data.data.ket_qua.file_url === `/api/lab/orders/${o0}/result/file` && r.data.data.ket_qua.file_type === "application/pdf" && !!r.data.data.chi_dinh.thoi_gian_hoan_thanh);
    r = await get(`/lab-orders/${o0}/result`, docA.token);
    check("GET result (bác sĩ) trả ket_qua + file_url của bác sĩ", r.status === 200 && r.data.data.ket_qua?.file_url === `/api/lab-orders/${o0}/result/file` && r.data.data.ket_qua.mo_ta === "Hb 13.5 g/dL, binh thuong");
    r = await get(`/lab-orders/${oCho}/result`, docA.token);
    check("GET result chỉ định chưa xong -> ket_qua null", r.status === 200 && r.data.data.ket_qua === null && r.data.data.chi_dinh.trang_thai === "CHO_XU_LY");
    r = await get(`/lab-orders/${o0}/result`, staffA.token);
    check("Nhân viên XN gọi API bác sĩ -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get(`/lab-orders?ho_so_id=${hsA}`, docA.token);
    const item = (r.data?.data?.chi_dinh || []).find((x) => x.id === o0);
    check("API list chỉ định của bác sĩ (C4-06) trả thêm ket_qua + thoi_gian_hoan_thanh", r.status === 200 && item?.trang_thai === "DA_XONG" && !!item.thoi_gian_hoan_thanh && item.ket_qua?.file_url === `/api/lab-orders/${o0}/result/file`);
    const itemCho = (r.data?.data?.chi_dinh || []).find((x) => x.id === oCho);
    check("API list: chỉ định chưa xong có ket_qua = null", itemCho && itemCho.ket_qua === null);

    // ---- Không upload lại / không sửa sau DA_XONG ----
    const stored = rows[0].file_ket_qua;
    r = await upload(o0, staffA.token, PNG, { filename: "lai.png", moTa: "sua" });
    check("DA_XONG upload lại -> 409", r.status === 409 && r.data.code === "INVALID_STATE", `(nhận ${r.status})`);
    const after = await dbKq(o0);
    check("Kết quả không bị sửa (file, mo_ta giữ nguyên) & không thêm dòng", after.length === 1 && after[0].file_ket_qua === stored && after[0].mo_ta === "Hb 13.5 g/dL, binh thuong");

    // ---- Ảnh PNG / JPG ----
    const oPng = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    r = await upload(oPng, staffA.token, PNG, { filename: "xq.png", type: "image/png" });
    check("Upload PNG hợp lệ -> 201 (không có mo_ta -> null)", r.status === 201 && r.data.data.ket_qua.file_type === "image/png" && r.data.data.ket_qua.mo_ta === null, `(nhận ${r.status})`);
    f = await fetch(BASE + `/lab/orders/${oPng}/result/file`, { headers: auth(staffA.token) });
    check("Mở lại PNG đúng nội dung + Content-Type", f.status === 200 && Buffer.from(await f.arrayBuffer()).equals(PNG) && f.headers.get("content-type") === "image/png");
    const oJpg = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    r = await upload(oJpg, staffA.token, JPG, { filename: "sa.jpg", type: "image/jpeg", moTa: "" });
    check("Upload JPG hợp lệ -> 201 (mo_ta rỗng -> null)", r.status === 201 && r.data.data.ket_qua.file_type === "image/jpeg" && (await dbKq(oJpg))[0].mo_ta === null, `(nhận ${r.status})`);

    // ---- Không duplicate: 8 request song song ----
    const oRace = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    const filesBeforeRace = filesInDir();
    const results = await Promise.all(Array.from({ length: 8 }, () => upload(oRace, staffA.token, PDF)));
    const created = results.filter((x) => x.status === 201).length;
    const conflict = results.filter((x) => x.status === 409).length;
    check("8 request song song -> đúng 1 thành công, còn lại 409", created === 1 && conflict === 7, `(201=${created}, 409=${conflict})`);
    check("Không tạo duplicate KetQuaXetNghiem", (await dbKq(oRace)).length === 1);
    check("Request thua không để lại file mồ côi", filesInDir() === filesBeforeRace + 1, `(+${filesInDir() - filesBeforeRace})`);

    // ---- Kết quả đã tồn tại sẵn (dữ liệu lệch) -> không tạo trùng, không để file mồ côi ----
    const oDup = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    await pool.query(`INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta) VALUES ($1,NULL,'cu')`, [oDup]);
    const filesBeforeDup = filesInDir();
    r = await upload(oDup, staffA.token, PDF);
    check("Đã có sẵn KetQuaXetNghiem -> 409 DUPLICATE_RESULT", r.status === 409 && r.data.code === "DUPLICATE_RESULT", `(nhận ${r.status})`);
    check("DUPLICATE_RESULT: rollback trạng thái + xóa file vừa ghi", (await dbOrder(oDup)).trang_thai === "DANG_XU_LY" && filesInDir() === filesBeforeDup);

    // ---- Lỗi DB sau khi ghi file -> rollback + xóa file ----
    // Gắn trigger làm UPDATE trạng thái thất bại để mô phỏng DB lỗi sau khi file đã ghi
    const oFail = await mkOrder(hsA, roomA, "DANG_XU_LY", staffA.id);
    await pool.query(`CREATE OR REPLACE FUNCTION zz_fail_${sfx}() RETURNS trigger AS $$ BEGIN IF NEW.trang_thai = 'DA_XONG' AND NEW.ten_xet_nghiem LIKE '${P}%' AND NEW.id = ${oFail} THEN RAISE EXCEPTION 'loi gia lap'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
    await pool.query(`CREATE TRIGGER zz_fail_${sfx} BEFORE UPDATE ON "ChiDinhXetNghiem" FOR EACH ROW EXECUTE FUNCTION zz_fail_${sfx}()`);
    const filesBeforeFail = filesInDir();
    r = await upload(oFail, staffA.token, PDF);
    await pool.query(`DROP TRIGGER zz_fail_${sfx} ON "ChiDinhXetNghiem"`);
    await pool.query(`DROP FUNCTION zz_fail_${sfx}()`);
    check("DB lỗi giữa chừng -> 500", r.status === 500, `(nhận ${r.status})`);
    check("DB lỗi: rollback (không có kết quả, vẫn DANG_XU_LY) và xóa file", (await dbKq(oFail)).length === 0 && (await dbOrder(oFail)).trang_thai === "DANG_XU_LY" && filesInDir() === filesBeforeFail);
    r = await upload(oFail, staffA.token, PDF);
    check("Sau lỗi vẫn nộp lại được bình thường", r.status === 201, `(nhận ${r.status})`);

    // ---- Chống path traversal khi đọc file ----
    const oTrav = await mkOrder(hsA, roomA, "DA_XONG", staffA.id);
    await pool.query(`INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua) VALUES ($1,'../.env')`, [oTrav]);
    f = await fetch(BASE + `/lab/orders/${oTrav}/result/file`, { headers: auth(staffA.token) });
    check("file_ket_qua lạ (../.env) không được phục vụ -> 404", f.status === 404, `(nhận ${f.status})`);

    // ---- closeExamination (C4-08) vẫn đúng ----
    const hsC = await mkVisit(roomA, docA.bsId, "C");
    const oC = await mkOrder(hsC, roomA, "DANG_XU_LY", staffA.id);
    r = await api("POST", `/examinations/${hsC}/close`, null, docA.token);
    check("close khi chỉ định còn DANG_XU_LY -> 409 LAB_ORDER_PENDING", r.status === 409 && r.data.code === "LAB_ORDER_PENDING", `(nhận ${r.status})`);
    r = await upload(oC, staffA.token, PDF);
    check("Nộp kết quả không đóng hồ sơ (HoSoBenhAn vẫn DANG_KHAM)", r.status === 201 && (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id=$1`, [hsC])).rows[0].trang_thai === "DANG_KHAM");
    r = await api("POST", `/examinations/${hsC}/close`, null, docA.token);
    check("Sau khi mọi chỉ định DA_XONG -> close thành công", r.status === 200, `(nhận ${r.status})`);
  } catch (e) {
    fail++;
    console.error("LỖI test:", e);
  } finally {
    await cleanup();
    console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exitCode = fail ? 1 : 0;
  }
})();
