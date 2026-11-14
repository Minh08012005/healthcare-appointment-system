// Test C5-05: bác sĩ xem kết quả xét nghiệm + thông báo bệnh nhân khi chỉ định DA_XONG
//   GET /api/lab-orders?ho_so_id=   (kết quả chỉ hiện khi DA_XONG)
//   GET /api/lab-orders/:id/result[/file]   (đọc / mở file, chỉ bác sĩ chủ hồ sơ)
//   GET /api/notifications, PATCH /api/notifications/:id/read   (bệnh nhân)
// Chạy: bật server (npm run dev) rồi `npm run api:test-c5-05`. Script tự tạo và tự dọn dữ liệu + file test.
// Yêu cầu: đã chạy `npm run db:migrate:c5-05`.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { UPLOAD_ROOT } = require("../src/utils/labResultFile");

const BASE = "http://localhost:3000/api";
const sfx = Date.now().toString().slice(-6);
const P = `ZZN${sfx}`;
const MSG = "Đã có kết quả xét nghiệm, vui lòng quay lại phòng khám.";
const SECRET = "HONG-CAU-4.5-SECRET";
let pass = 0, fail = 0, n = 0, pwHash, roleXN, roleBS;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};
const auth = (t) => (t ? { Authorization: `Bearer ${t}` } : {});
const json = async (res) => ({ status: res.status, data: await res.json().catch(() => ({})), res });
const api = async (method, p, body, t) =>
  json(await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", ...auth(t) }, body: body ? JSON.stringify(body) : undefined }));
const get = (p, t) => api("GET", p, null, t);

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"), Buffer.alloc(200, 0x20)]);
const upload = async (orderId, token, moTa) => {
  const fd = new FormData();
  fd.append("file", new Blob([PDF], { type: "application/pdf" }), "kq.pdf");
  if (moTa !== undefined) fd.append("mo_ta", moTa);
  return json(await fetch(`${BASE}/lab/orders/${orderId}/result`, { method: "POST", headers: auth(token), body: fd }));
};

const mkUser = async (roleId, tag, roomId = null) => {
  const username = `zzn${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai, phong_kham_id) VALUES ($1,$2,$3,'HoatDong',$4) RETURNING id`,
    [username, pwHash, roleId, roomId]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};
const mkDoctor = async (tag, ck) => {
  const u = await mkUser(roleBS, `d_${tag}`);
  const bs = (await pool.query(`INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`, [u.id, `${P} BS ${tag}`, ck])).rows[0].id;
  return { ...u, bsId: bs };
};
// Bệnh nhân CÓ tài khoản (đăng ký như luồng Online)
const mkPatientAcc = async (tag) => {
  const username = `zzn${sfx}_p_${tag}`;
  await api("POST", "/auth/register", { username, password: "123456", ho_ten: `${P} BN ${tag}` });
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  const bn = (await pool.query(`SELECT bn.id FROM "BenhNhan" bn JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id WHERE tk.ten_dang_nhap = $1`, [username])).rows[0].id;
  return { bnId: bn, token: login.data?.data?.token };
};
// Bệnh nhân KHÔNG có tài khoản (tiếp nhận offline)
const mkPatientNoAcc = async (tag) =>
  (await pool.query(`INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, ma_bhyt) VALUES ($1,'1990-05-20','Nam',$2) RETURNING id`, [`${P} BN ${tag}`, `${P}${++n}`])).rows[0].id;
const mkVisit = async (roomId, bsId, bnId) => {
  const hd = (await pool.query(
    `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
     VALUES ($1,$2,$3,$4,'ONLINE','DANG_KHAM',1,0,NOW()) RETURNING id`, [bnId, ++n, roomId, bsId])).rows[0].id;
  return (await pool.query(
    `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
     VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'DANG_KHAM') RETURNING id`, [hd, bnId, bsId])).rows[0].id;
};
const mkOrder = async (hsId, labRoom, state, ten) =>
  (await pool.query(
    `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, trang_thai, ten_xet_nghiem, ghi_chu) VALUES ($1,$2,$3,$4,'ghi chu') RETURNING id`,
    [hsId, labRoom, state, `${P} XN ${ten}`])).rows[0].id;
const notiOf = async (chiDinhId) => (await pool.query(`SELECT * FROM "ThongBao" WHERE chi_dinh_id = $1`, [chiDinhId])).rows;

const cleanup = async () => {
  try {
    const orders = `SELECT id FROM "ChiDinhXetNghiem" WHERE ten_xet_nghiem LIKE $1`;
    const files = await pool.query(`SELECT file_ket_qua FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    for (const f of files.rows) if (/^lab-results\/[\w.-]+$/.test(f.file_ket_qua || "")) fs.rmSync(path.join(UPLOAD_ROOT, f.file_ket_qua), { force: true });
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    const hs = `SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`;
    await pool.query(`DELETE FROM "ThongBao" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hs}) OR ten_xet_nghiem LIKE $2`, [`${P} BN %`, `${P} XN %`]);
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (${hs})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzn${sfx}_%`]);
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
    const mkRoom = async (name, loai) => (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,$3) RETURNING id`, [`${P} ${name}`, ck, loai])).rows[0].id;
    const clinic = await mkRoom("Phòng khám", "Phòng khám");
    const lab = await mkRoom("Phòng XN", "Xet nghiem");

    const docA = await mkDoctor("A", ck);
    const docB = await mkDoctor("B", ck);
    const staff = await mkUser(roleXN, "xn", lab);
    const p1 = await mkPatientAcc("P1");
    const p2 = await mkPatientAcc("P2");
    const p3Id = await mkPatientNoAcc("P3");
    const H1 = await mkVisit(clinic, docA.bsId, p1.bnId);
    const H2 = await mkVisit(clinic, docA.bsId, p2.bnId);
    const H3 = await mkVisit(clinic, docA.bsId, p3Id);
    const H4 = await mkVisit(clinic, docB.bsId, p1.bnId);
    check("Có token bác sĩ A/B, nhân viên XN, bệnh nhân P1/P2", !!(docA.token && docB.token && staff.token && p1.token && p2.token));

    // ---------- Chỉ định chưa xong: không lộ kết quả ----------
    const o1 = await mkOrder(H1, lab, "CHO_XU_LY", "o1");
    const o2 = await mkOrder(H1, lab, "DANG_XU_LY", "o2");
    await pool.query(`INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta) VALUES ($1, NULL, $2)`, [o2, `${SECRET} chưa hoàn tất`]);
    const l0 = await get(`/lab-orders?ho_so_id=${H1}`, docA.token);
    const it = (l, id) => (l.data.data?.chi_dinh || []).find((x) => x.id === id);
    check("Danh sách của hồ sơ: đủ 2 chỉ định, đúng tên/phòng/trạng thái",
      l0.status === 200 && l0.data.data.tong === 2 && it(l0, o1)?.trang_thai === "CHO_XU_LY" && it(l0, o2)?.trang_thai === "DANG_XU_LY" && it(l0, o1)?.phong?.id === lab, JSON.stringify(l0.data));
    check("Chưa DA_XONG -> ket_qua = null (kể cả khi lỡ có dòng kết quả nháp)", it(l0, o1)?.ket_qua === null && it(l0, o2)?.ket_qua === null && !JSON.stringify(l0.data).includes(SECRET));
    check("Chưa DA_XONG -> chưa có thông báo", (await notiOf(o1)).length === 0 && (await notiOf(o2)).length === 0);
    await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id = $1`, [o2]);

    // ---------- Phòng XN hoàn tất chỉ định (API thật C5-02/C5-03) ----------
    const o3 = await mkOrder(H1, lab, "CHO_XU_LY", "o3");
    const st = await api("POST", `/lab/orders/${o3}/start`, null, staff.token);
    const up = await upload(o3, staff.token, `Chỉ số ${SECRET}`);
    check("Phòng XN start + nộp kết quả -> DA_XONG", st.status === 200 && up.status === 201 && up.data.data?.chi_dinh?.trang_thai === "DA_XONG", JSON.stringify([st.data, up.data]));

    // ---------- Bác sĩ đọc kết quả ----------
    const l1 = await get(`/lab-orders?ho_so_id=${H1}`, docA.token);
    const c3 = it(l1, o3);
    check("DA_XONG -> trả đúng kết quả (mo_ta, thời gian hoàn thành)",
      c3?.trang_thai === "DA_XONG" && c3.ket_qua?.mo_ta === `Chỉ số ${SECRET}` && !!c3.thoi_gian_hoan_thanh && l1.data.data.tong === 3, JSON.stringify(l1.data));
    check("ket_qua có file_url, file_type, file_ket_qua",
      c3?.ket_qua?.file_url === `/api/lab-orders/${o3}/result/file` && c3.ket_qua.file_type === "application/pdf" && /^lab-results\/kqxn-\d+-/.test(c3.ket_qua.file_ket_qua || ""));
    check("Chỉ định chưa xong vẫn ket_qua = null khi cạnh chỉ định đã xong", it(l1, o1)?.ket_qua === null && it(l1, o2)?.ket_qua === null);
    const fileRes = await fetch(BASE.replace("/api", "") + c3.ket_qua.file_url, { headers: auth(docA.token) });
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    check("Bác sĩ chủ hồ sơ mở được file (200, application/pdf, đúng nội dung)",
      fileRes.status === 200 && (fileRes.headers.get("content-type") || "").startsWith("application/pdf") && fileBuf.equals(PDF));
    const rr = await get(`/lab-orders/${o3}/result`, docA.token);
    check("GET /lab-orders/:id/result (C5-03) vẫn đúng", rr.status === 200 && rr.data.data?.ket_qua?.mo_ta === `Chỉ số ${SECRET}`);
    check("Chỉ định chưa có kết quả: mở file -> 404", (await fetch(`${BASE}/lab-orders/${o1}/result/file`, { headers: auth(docA.token) })).status === 404);

    // ---------- Quyền ----------
    check("Bác sĩ khác xem danh sách -> 403", (await get(`/lab-orders?ho_so_id=${H1}`, docB.token)).status === 403);
    check("Bác sĩ khác mở file kết quả -> 403", (await fetch(`${BASE}/lab-orders/${o3}/result/file`, { headers: auth(docB.token) })).status === 403);
    check("Bác sĩ khác đọc /result -> 403", (await get(`/lab-orders/${o3}/result`, docB.token)).status === 403);
    check("Nhân viên XN / bệnh nhân gọi danh sách của bác sĩ -> 403", (await get(`/lab-orders?ho_so_id=${H1}`, staff.token)).status === 403 && (await get(`/lab-orders?ho_so_id=${H1}`, p1.token)).status === 403);
    check("Bệnh nhân mở file kết quả qua API bác sĩ -> 403", (await fetch(`${BASE}/lab-orders/${o3}/result/file`, { headers: auth(p1.token) })).status === 403);
    check("Không token -> 401", (await get(`/lab-orders?ho_so_id=${H1}`, null)).status === 401 && (await fetch(`${BASE}/lab-orders/${o3}/result/file`)).status === 401);
    const o4 = await mkOrder(H4, lab, "CHO_XU_LY", "o4");
    check("Không lộ chỉ định hồ sơ khác: danh sách H1 không chứa chỉ định H4", !(l1.data.data.chi_dinh || []).some((x) => x.id === o4));
    check("Bác sĩ A đọc /result của chỉ định thuộc hồ sơ bác sĩ B -> 403", (await get(`/lab-orders/${o4}/result`, docA.token)).status === 403);

    // ---------- Thông báo bệnh nhân ----------
    const nt = await notiOf(o3);
    check("DA_XONG -> có đúng 1 thông báo, gắn đúng bệnh nhân/hồ sơ/chỉ định",
      nt.length === 1 && nt[0].benh_nhan_id === p1.bnId && nt[0].ho_so_id === H1 && nt[0].chi_dinh_id === o3 && nt[0].da_doc === false && nt[0].loai === "KET_QUA_XET_NGHIEM");
    check("Nội dung thông báo đúng", nt[0]?.noi_dung === MSG, nt[0]?.noi_dung);
    check("Thông báo không chứa mô tả / số liệu / tên file / tên xét nghiệm",
      !nt[0].noi_dung.includes(SECRET) && !/kqxn|\.pdf|XN o3|\d/.test(nt[0].noi_dung));
    const nl = await get("/notifications", p1.token);
    check("Bệnh nhân P1 nhận thông báo qua API (chua_doc = 1)", nl.status === 200 && nl.data.data?.chua_doc === 1 && nl.data.data.thong_bao.length === 1 && nl.data.data.thong_bao[0].noi_dung === MSG, JSON.stringify(nl.data));
    check("API thông báo không chứa kết quả xét nghiệm", !JSON.stringify(nl.data).includes(SECRET));
    const n2 = await get("/notifications", p2.token);
    check("Bệnh nhân khác (P2) không thấy thông báo của P1", n2.status === 200 && n2.data.data.thong_bao.length === 0 && n2.data.data.chua_doc === 0);
    check("Bác sĩ / không token gọi /notifications -> 403 / 401", (await get("/notifications", docA.token)).status === 403 && (await get("/notifications", null)).status === 401);

    // ---------- Không tạo trùng ----------
    const again = await upload(o3, staff.token, "nộp lại");
    check("Nộp lại kết quả (request gọi lại) -> 409", again.status === 409, JSON.stringify(again.data));
    check("Sau request gọi lại vẫn chỉ 1 thông báo", (await notiOf(o3)).length === 1);
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = 'DA_XONG' WHERE id = $1`, [o3]);
    check("Cập nhật lại DA_XONG -> DA_XONG không tạo thêm", (await notiOf(o3)).length === 1);
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = 'DANG_XU_LY' WHERE id = $1`, [o3]);
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = 'DA_XONG' WHERE id = $1`, [o3]);
    check("Chuyển DA_XONG lần thứ hai không tạo trùng (UNIQUE)", (await notiOf(o3)).length === 1);

    // ---------- Bệnh nhân không có tài khoản / nhiều chỉ định ----------
    const o5 = await mkOrder(H3, lab, "CHO_XU_LY", "o5");
    await api("POST", `/lab/orders/${o5}/start`, null, staff.token);
    const up5 = await upload(o5, staff.token, "xong");
    check("Bệnh nhân offline không có tài khoản: DA_XONG nhưng không tạo thông báo", up5.status === 201 && (await notiOf(o5)).length === 0);
    const o6 = await mkOrder(H1, lab, "CHO_XU_LY", "o6");
    await api("POST", `/lab/orders/${o6}/start`, null, staff.token);
    await upload(o6, staff.token, "xong 2");
    check("Chỉ định thứ hai của cùng bệnh nhân -> thông báo riêng (2 thông báo, 2 chưa đọc)",
      (await notiOf(o6)).length === 1 && (await get("/notifications", p1.token)).data.data.chua_doc === 2);
    check("Hồ sơ H2 (P2) chưa có chỉ định xong -> không có thông báo nào", (await get("/notifications", p2.token)).data.data.thong_bao.length === 0);

    // ---------- Đánh dấu đã đọc ----------
    const nid = nl.data.data.thong_bao[0].id;
    const mr = await api("PATCH", `/notifications/${nid}/read`, null, p1.token);
    check("P1 đánh dấu đã đọc -> da_doc = true", mr.status === 200 && mr.data.data?.thong_bao?.da_doc === true);
    check("chua_doc giảm còn 1; unread=1 chỉ trả thông báo chưa đọc",
      (await get("/notifications?unread=1", p1.token)).data.data.thong_bao.length === 1 && (await get("/notifications", p1.token)).data.data.chua_doc === 1);
    check("P2 đánh dấu thông báo của P1 -> 404", (await api("PATCH", `/notifications/${nid}/read`, null, p2.token)).status === 404);
    check("id thông báo sai -> 400; không token -> 401",
      (await api("PATCH", "/notifications/abc/read", null, p1.token)).status === 400 && (await api("PATCH", `/notifications/${nid}/read`, null, null)).status === 401);

    // ---------- Không đóng hồ sơ ----------
    const hsState = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id = ANY($1::int[]) ORDER BY id`, [[H1, H3]])).rows.map((r) => r.trang_thai);
    check("Hoàn tất xét nghiệm / thông báo không đóng hồ sơ (vẫn DANG_KHAM)", hsState.every((s) => s === "DANG_KHAM"));

    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
  } catch (e) {
    fail++;
    console.log("FAIL  Lỗi không mong đợi:", e.message);
    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
  } finally {
    await cleanup();
    await pool.end();
    process.exitCode = fail > 0 ? 1 : 0;
  }
})();
