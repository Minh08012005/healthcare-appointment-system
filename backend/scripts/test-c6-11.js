// Test C6-11: Bệnh nhân xem Lịch sử khám (UC-037)
//   GET /api/patient/medical-records                                      (danh sách, chỉ DA_XONG của chính mình)
//   GET /api/patient/medical-records/:id                                  (chi tiết, kiểm quyền sở hữu ở Backend)
//   GET /api/patient/medical-records/:id/lab-orders/:chiDinhId/result/file (mở file xét nghiệm của chính mình)
// Chạy: bật server (npm run dev) rồi `npm run api:test-c6-11`. Script tự tạo và tự dọn dữ liệu + file test (tiền tố ZZH).
// Dữ liệu thật của bệnh nhân khác KHÔNG bị ảnh hưởng: script chỉ tạo/xóa các dòng của chính nó.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { UPLOAD_ROOT } = require("../src/utils/labResultFile");

const BASE = "http://localhost:3000/api";
const ORIGIN = BASE.replace("/api", "");
const sfx = Date.now().toString().slice(-6);
const P = `ZZH${sfx}`;
const NOT_FOUND = "Không tìm thấy hồ sơ khám";
const SECRET_DX = "CHAN-DOAN-BI-MAT-CUA-BN2";
const SECRET_LAB = "KET-QUA-XN-BI-MAT-CUA-BN2";
let pass = 0, fail = 0, n = 0, pwHash, roleXN, roleBS, roleBN;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};
const auth = (t) => (t ? { Authorization: `Bearer ${t}` } : {});
const json = async (res) => ({ status: res.status, data: await res.json().catch(() => ({})), res });
const api = async (method, p, body, t) =>
  json(await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", ...auth(t) }, body: body ? JSON.stringify(body) : undefined }));
const get = (p, t) => api("GET", p, null, t);
const list = (t) => get("/patient/medical-records", t);
const detail = (id, t) => get(`/patient/medical-records/${id}`, t);
const fileOf = (hs, cd, t) => fetch(`${BASE}/patient/medical-records/${hs}/lab-orders/${cd}/result/file`, { headers: auth(t) });

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"), Buffer.alloc(200, 0x20)]);
const upload = async (orderId, token, moTa) => {
  const fd = new FormData();
  fd.append("file", new Blob([PDF], { type: "application/pdf" }), "kq.pdf");
  if (moTa !== undefined) fd.append("mo_ta", moTa);
  return json(await fetch(`${BASE}/lab/orders/${orderId}/result`, { method: "POST", headers: auth(token), body: fd }));
};

const mkUser = async (roleId, tag, roomId = null) => {
  const username = `zzh${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai, phong_kham_id) VALUES ($1,$2,$3,'HoatDong',$4) RETURNING id`,
    [username, pwHash, roleId, roomId]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};
const mkDoctor = async (tag, name, ck) => {
  const u = await mkUser(roleBS, `d_${tag}`);
  const bs = (await pool.query(`INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Bác sĩ chuyên khoa I') RETURNING id`, [u.id, `${P} BS ${name}`, ck])).rows[0].id;
  return { ...u, bsId: bs };
};
// Bệnh nhân CÓ tài khoản (đăng ký như luồng Online)
const mkPatient = async (tag) => {
  const username = `zzh${sfx}_p_${tag}`;
  await api("POST", "/auth/register", { username, password: "123456", ho_ten: `${P} BN ${tag}` });
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  const bn = (await pool.query(`SELECT bn.id FROM "BenhNhan" bn JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id WHERE tk.ten_dang_nhap = $1`, [username])).rows[0].id;
  return { bnId: bn, token: login.data?.data?.token };
};
// Một lượt khám: HangDoi + HoSoBenhAn. state = CHO_KHAM | DANG_KHAM | DA_XONG
const mkRecord = async (roomId, bsId, bnId, state, ngay) => {
  const hd = (await pool.query(
    `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
     VALUES ($1,$2,$3,$4,'ONLINE',$5,1,0,NOW()) RETURNING id`, [bnId, ++n, roomId, bsId, state])).rows[0].id;
  return (await pool.query(
    `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai) VALUES ($1,$2,$3,$4::date,$5) RETURNING id`,
    [hd, bnId, bsId, ngay, state])).rows[0].id;
};
const mkResult = (hsId, tc, cd, ld, dt) =>
  pool.query(`INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc) VALUES ($1,$2,$3,$4,$5)`, [hsId, tc, cd, ld, dt]);
const mkOrder = async (hsId, labRoom, state, ten) =>
  (await pool.query(
    `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, trang_thai, ten_xet_nghiem, ghi_chu) VALUES ($1,$2,$3,$4,'ghi chu') RETURNING id`,
    [hsId, labRoom, state, `${P} XN ${ten}`])).rows[0].id;

const cleanup = async () => {
  try {
    const orders = `SELECT id FROM "ChiDinhXetNghiem" WHERE ten_xet_nghiem LIKE $1`;
    const files = await pool.query(`SELECT file_ket_qua FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    for (const f of files.rows) if (/^lab-results\/[\w.-]+$/.test(f.file_ket_qua || "")) fs.rmSync(path.join(UPLOAD_ROOT, f.file_ket_qua), { force: true });
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    const hs = `SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`;
    // Bảng ThongBao (C5-05) có thể chưa tồn tại trên DB này
    const hasTb = (await pool.query(`SELECT to_regclass('public."ThongBao"') AS t`)).rows[0].t;
    if (hasTb) await pool.query(`DELETE FROM "ThongBao" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (${orders})`, [`${P} XN %`]);
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hs}) OR ten_xet_nghiem LIKE $2`, [`${P} BN %`, `${P} XN %`]);
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (${hs})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzh${sfx}_%`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(`DELETE FROM "ChuyenKhoa" WHERE ten_chuyen_khoa LIKE $1`, [`${P} %`]);
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
    roleBN = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bệnh nhân'`)).rows[0].id;
    const ckNoi = (await pool.query(`INSERT INTO "ChuyenKhoa" (ten_chuyen_khoa) VALUES ($1) RETURNING id`, [`${P} Nội tổng quát`])).rows[0].id;
    const mkRoom = async (name, loai, ck) => (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,$3) RETURNING id`, [`${P} ${name}`, ck, loai])).rows[0].id;
    const clinic = await mkRoom("Phòng khám", "Phòng khám", ckNoi);
    const lab = await mkRoom("Phòng XN", "Xet nghiem", ckNoi);

    const docA = await mkDoctor("A", "An", ckNoi);
    const docB = await mkDoctor("B", "Bình", ckNoi);
    const staff = await mkUser(roleXN, "xn", lab);
    const p1 = await mkPatient("P1");
    const p2 = await mkPatient("P2");
    const p3 = await mkPatient("P3"); // bệnh nhân chưa có lần khám nào
    const orphan = await mkUser(roleBN, "orphan"); // tài khoản Bệnh nhân nhưng chưa có hồ sơ BenhNhan
    check("Có token bác sĩ A/B, nhân viên XN, bệnh nhân P1/P2/P3", !!(docA.token && docB.token && staff.token && p1.token && p2.token && p3.token && orphan.token));

    // ---------- Đăng nhập / vai trò ----------
    check("Không đăng nhập -> 401 (danh sách, chi tiết, file)",
      (await list()).status === 401 && (await detail(1)).status === 401 && (await fileOf(1, 1)).status === 401);
    check("Bác sĩ / nhân viên XN gọi API bệnh nhân -> 403",
      (await list(docA.token)).status === 403 && (await detail(1, docA.token)).status === 403 && (await list(staff.token)).status === 403 &&
      (await fileOf(1, 1, docA.token)).status === 403);
    check("Tài khoản bệnh nhân chưa gắn hồ sơ BenhNhan -> 403", (await list(orphan.token)).status === 403);

    // ---------- List: chưa có lịch sử ----------
    const l0 = await list(p1.token);
    check("Chưa có lịch sử -> 200, data = [] (không phải lỗi)", l0.status === 200 && l0.data.success === true && Array.isArray(l0.data.data) && l0.data.data.length === 0, JSON.stringify(l0.data));

    // Dữ liệu list: P1 có 3 hồ sơ DA_XONG + CHO_KHAM + DANG_KHAM; P2 có 1 hồ sơ DA_XONG
    const hsOld = await mkRecord(clinic, docA.bsId, p1.bnId, "DA_XONG", "2026-01-10");
    const hsNew = await mkRecord(clinic, docA.bsId, p1.bnId, "DA_XONG", "2026-03-05");
    const hsSame = await mkRecord(clinic, docB.bsId, p1.bnId, "DA_XONG", "2026-03-05"); // cùng ngày, id lớn hơn
    const hsCho = await mkRecord(clinic, docA.bsId, p1.bnId, "CHO_KHAM", "2026-04-01");
    const hsDang = await mkRecord(clinic, docA.bsId, p1.bnId, "DANG_KHAM", "2026-04-02");
    const hsP2 = await mkRecord(clinic, docA.bsId, p2.bnId, "DA_XONG", "2026-02-01");
    await mkResult(hsOld, "Ho kéo dài", "Viêm họng cấp", "Uống nhiều nước", "Paracetamol 500mg");
    await mkResult(hsNew, "Đau đầu", "Thiếu ngủ", "Nghỉ ngơi\nngủ đủ giấc", "Vitamin B1\nVitamin C");
    await mkResult(hsP2, "Triệu chứng của BN2", SECRET_DX, "Lời dặn BN2", "Thuốc BN2");
    // hsSame cố ý KHÔNG có KetQuaKham

    const l1 = await list(p1.token);
    const ids = (l1.data.data || []).map((x) => x.ho_so_id);
    check("Chỉ hồ sơ DA_XONG của P1 xuất hiện (đúng 3 hồ sơ)", l1.status === 200 && ids.length === 3 && ids.includes(hsOld) && ids.includes(hsNew) && ids.includes(hsSame), JSON.stringify(ids));
    check("CHO_KHAM không xuất hiện", !ids.includes(hsCho));
    check("DANG_KHAM không xuất hiện", !ids.includes(hsDang));
    check("Mới nhất trước (ngày giảm dần, cùng ngày thì id lớn trước)", ids[0] === hsSame && ids[1] === hsNew && ids[2] === hsOld, JSON.stringify(ids));
    const it = (l1.data.data || []).find((x) => x.ho_so_id === hsNew) || {};
    check("Mỗi lần khám có ngày khám, bác sĩ, chuyên khoa, số xét nghiệm",
      it.ngay_kham === "2026-03-05" && it.doctor?.ho_ten === `${P} BS An` && it.chuyen_khoa?.ten_chuyen_khoa === `${P} Nội tổng quát` && it.so_xet_nghiem === 0, JSON.stringify(it));
    check("Bệnh nhân khác (P2) không nhìn thấy hồ sơ của P1, P1 không thấy hồ sơ của P2",
      !ids.includes(hsP2) && (await list(p2.token)).data.data.map((x) => x.ho_so_id).join() === String(hsP2));
    check("Danh sách không lộ nội dung khám (chẩn đoán...) của ai", !JSON.stringify(l1.data).includes(SECRET_DX) && !(("chan_doan") in it));
    check("P3 (chưa khám lần nào) vẫn nhận danh sách rỗng", (await list(p3.token)).data.data.length === 0);

    // ---------- Detail: đúng dữ liệu ----------
    const d1 = await detail(hsNew, p1.token);
    const dd = d1.data.data || {};
    check("Chi tiết hồ sơ của chính mình -> 200", d1.status === 200 && d1.data.success === true, JSON.stringify(d1.data));
    check("Đúng ngày khám, bác sĩ, chuyên khoa", dd.ho_so?.id === hsNew && dd.ho_so?.ngay_kham === "2026-03-05" && dd.doctor?.ho_ten === `${P} BS An` && dd.doctor?.cap_bac === "Bác sĩ chuyên khoa I" && dd.chuyen_khoa?.ten_chuyen_khoa === `${P} Nội tổng quát`, JSON.stringify(dd));
    check("Đúng triệu chứng, chẩn đoán, lời dặn, đơn thuốc (giữ xuống dòng)",
      dd.ket_qua_kham?.trieu_chung === "Đau đầu" && dd.ket_qua_kham?.chan_doan === "Thiếu ngủ" && dd.ket_qua_kham?.loi_dan === "Nghỉ ngơi\nngủ đủ giấc" && dd.ket_qua_kham?.don_thuoc === "Vitamin B1\nVitamin C", JSON.stringify(dd.ket_qua_kham));
    check("Không có chỉ định xét nghiệm -> xet_nghiem = [] (không phải lỗi)", Array.isArray(dd.xet_nghiem) && dd.xet_nghiem.length === 0);
    const dSame = (await detail(hsSame, p1.token)).data.data || {};
    check("Hồ sơ chưa có KetQuaKham vẫn 200, các mục kết quả = null, vẫn có bác sĩ B",
      dSame.doctor?.ho_ten === `${P} BS Bình` && dSame.ket_qua_kham?.chan_doan === null && dSame.ket_qua_kham?.don_thuoc === null && dSame.ket_qua_kham?.trieu_chung === null, JSON.stringify(dSame));

    // ---------- Ownership ----------
    const dNone = await detail(2147483000, p1.token);
    const dOther = await detail(hsP2, p1.token);
    check("Bệnh nhân A nhập ID hồ sơ của B -> bị từ chối (404)", dOther.status === 404, JSON.stringify(dOther.data));
    check("Lỗi không lộ dữ liệu của B", !JSON.stringify(dOther.data).includes(SECRET_DX) && !JSON.stringify(dOther.data).includes("BN2") && !JSON.stringify(dOther.data).includes(`${P} BN P2`));
    check("Hồ sơ của người khác và hồ sơ không tồn tại trả CÙNG thông báo (không lộ hồ sơ có tồn tại)",
      dNone.status === 404 && dNone.data.message === NOT_FOUND && dOther.data.message === NOT_FOUND && JSON.stringify(dNone.data) === JSON.stringify(dOther.data));
    check("Hồ sơ của chính mình nhưng CHO_KHAM / DANG_KHAM -> 404 (chưa hoàn tất)",
      (await detail(hsCho, p1.token)).status === 404 && (await detail(hsDang, p1.token)).status === 404);
    check("Bệnh nhân B xem hồ sơ của A -> 404", (await detail(hsNew, p2.token)).status === 404 && (await detail(hsP2, p2.token)).status === 200);
    check("ID sai định dạng (abc, 0, -1, quá lớn) -> 400",
      (await detail("abc", p1.token)).status === 400 && (await detail(0, p1.token)).status === 400 && (await detail(-1, p1.token)).status === 400 && (await detail("99999999999", p1.token)).status === 400);

    // ---------- Xét nghiệm + file ----------
    // Hồ sơ DANG_KHAM đi qua luồng thật: tạo chỉ định, phòng XN xử lý và nộp file, rồi Bác sĩ ĐÓNG hồ sơ (mục Integration bên dưới).
    // Ở đây dựng sẵn hồ sơ DA_XONG có xét nghiệm: 1 chỉ định có file, 1 chỉ định xong nhưng không file.
    const hsLab = await mkRecord(clinic, docA.bsId, p1.bnId, "DANG_KHAM", "2026-02-20");
    const oFile = await mkOrder(hsLab, lab, "CHO_XU_LY", "Công thức máu");
    const oNoFile = await mkOrder(hsLab, lab, "CHO_XU_LY", "Đường huyết");
    const st = await api("POST", `/lab/orders/${oFile}/start`, null, staff.token);
    const up = await upload(oFile, staff.token, "Bạch cầu bình thường");
    check("Phòng XN start + nộp file -> chỉ định DA_XONG (API thật C5)", st.status === 200 && up.status === 201, JSON.stringify([st.data, up.data]));
    await pool.query(`INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta) VALUES ($1, NULL, $2)`, [oNoFile, "Đường huyết 5.2 mmol/L"]);
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = 'DA_XONG', thoi_gian_hoan_thanh = NOW() WHERE id = $1`, [oNoFile]);
    await mkResult(hsLab, "Mệt mỏi", "Thiếu máu nhẹ", "Ăn nhiều sắt", "Sắt 60mg");
    // Trước khi hồ sơ DA_XONG: Bệnh nhân KHÔNG xem được kể cả file
    check("Hồ sơ chưa DA_XONG: không có trong danh sách, chi tiết 404, file 404 (dù chỉ định đã xong)",
      !(await list(p1.token)).data.data.some((x) => x.ho_so_id === hsLab) && (await detail(hsLab, p1.token)).status === 404 && (await fileOf(hsLab, oFile, p1.token)).status === 404);
    await pool.query(`UPDATE "HoSoBenhAn" SET trang_thai = 'DA_XONG' WHERE id = $1`, [hsLab]);

    const dl = await detail(hsLab, p1.token);
    const labs = dl.data.data?.xet_nghiem || [];
    const lf = labs.find((x) => x.id === oFile) || {};
    const ln = labs.find((x) => x.id === oNoFile) || {};
    check("Có xét nghiệm -> hiển thị đúng danh sách (2 chỉ định, đúng tên, trạng thái, mô tả)",
      dl.status === 200 && labs.length === 2 && lf.ten_xet_nghiem === `${P} XN Công thức máu` && lf.trang_thai === "DA_XONG" && lf.mo_ta === "Bạch cầu bình thường" && !!lf.thoi_gian_hoan_thanh &&
      ln.ten_xet_nghiem === `${P} XN Đường huyết` && ln.mo_ta === "Đường huyết 5.2 mmol/L", JSON.stringify(labs));
    check("Có file -> trả file_type + file_url của API bệnh nhân; không file -> file = null",
      lf.file?.file_type === "application/pdf" && lf.file?.file_url === `/api/patient/medical-records/${hsLab}/lab-orders/${oFile}/result/file` && ln.file === null, JSON.stringify([lf.file, ln.file]));
    check("KHÔNG lộ đường dẫn file thật trên đĩa (lab-results/, file_ket_qua)", !JSON.stringify(dl.data).includes("lab-results") && !JSON.stringify(dl.data).includes("file_ket_qua") && !JSON.stringify(dl.data).includes("kqxn-"));
    check("Danh sách đếm đúng số xét nghiệm", (await list(p1.token)).data.data.find((x) => x.ho_so_id === hsLab)?.so_xet_nghiem === 2);

    const f1 = await fileOf(hsLab, oFile, p1.token);
    const fb = Buffer.from(await f1.arrayBuffer());
    check("Bệnh nhân chủ hồ sơ mở được file (200, application/pdf, đúng nội dung, no-store)",
      f1.status === 200 && /application\/pdf/.test(f1.headers.get("content-type") || "") && fb.equals(PDF) && /no-store/.test(f1.headers.get("cache-control") || ""), `status=${f1.status}`);
    check("Mở file qua URL do API trả (có Authorization) cũng được", (await fetch(ORIGIN + lf.file.file_url, { headers: auth(p1.token) })).status === 200);

    // File thuộc bệnh nhân khác: mọi cách thay ID đều bị từ chối
    const hsLab2 = await mkRecord(clinic, docA.bsId, p2.bnId, "DA_XONG", "2026-02-25");
    const o2 = await mkOrder(hsLab2, lab, "DANG_XU_LY", "XN của BN2");
    const up2 = await upload(o2, staff.token, SECRET_LAB);
    check("Dựng file của P2 (phòng XN nộp kết quả)", up2.status === 201 || up2.status === 409, JSON.stringify(up2.data));
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = 'DA_XONG' WHERE id = $1`, [o2]);
    check("P2 mở được file của chính mình", (await fileOf(hsLab2, o2, p2.token)).status === 200);
    const x1 = await fileOf(hsLab2, o2, p1.token);
    check("P1 dùng đúng ID hồ sơ + chỉ định của P2 -> 404 (không tải được file người khác)", x1.status === 404, `status=${x1.status}`);
    check("P1 ghép hồ sơ của mình với chỉ định của P2 (chỉ định không thuộc hồ sơ) -> 404", (await fileOf(hsLab, o2, p1.token)).status === 404);
    check("P1 ghép hồ sơ của P2 với chỉ định của mình -> 404", (await fileOf(hsLab2, oFile, p1.token)).status === 404);
    check("P2 mở file của P1 -> 404", (await fileOf(hsLab, oFile, p2.token)).status === 404);
    const xr = await json(await fileOf(hsLab2, o2, p1.token));
    check("Lỗi file không lộ nội dung của người khác", !JSON.stringify(xr.data).includes(SECRET_LAB) && xr.data.message === "Không tìm thấy file kết quả");
    check("Chỉ định đã xong nhưng KHÔNG có file -> 404", (await fileOf(hsLab, oNoFile, p1.token)).status === 404);
    // Chỉ định chưa DA_XONG nhưng lỡ có dòng kết quả nháp: không lộ mô tả lẫn file
    const hsDraft = await mkRecord(clinic, docA.bsId, p1.bnId, "DA_XONG", "2026-02-22");
    const oDraft = await mkOrder(hsDraft, lab, "DANG_XU_LY", "Nháp");
    await pool.query(`INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta) VALUES ($1, NULL, $2)`, [oDraft, "MO-TA-NHAP-CHUA-XONG"]);
    const dDraft = await detail(hsDraft, p1.token);
    check("Chỉ định chưa DA_XONG -> hiện trạng thái nhưng KHÔNG lộ mô tả/file nháp",
      dDraft.data.data?.xet_nghiem?.[0]?.trang_thai === "DANG_XU_LY" && dDraft.data.data.xet_nghiem[0].mo_ta === null && dDraft.data.data.xet_nghiem[0].file === null && !JSON.stringify(dDraft.data).includes("MO-TA-NHAP"));
    check("ID sai định dạng ở API file -> 400", (await fileOf("abc", oFile, p1.token)).status === 400 && (await fileOf(hsLab, "0", p1.token)).status === 400);
    check("Không có route tĩnh nào lộ thư mục uploads", (await fetch(`${ORIGIN}/uploads/lab-results/`)).status === 404);

    // ---------- Integration: Doctor Close -> Patient History (luồng thật, không SQL) ----------
    const hsFlow = await mkRecord(clinic, docA.bsId, p1.bnId, "DANG_KHAM", "2026-05-01");
    const before = (await list(p1.token)).data.data.map((x) => x.ho_so_id);
    check("Trước khi đóng hồ sơ: lượt khám đang khám KHÔNG có trong lịch sử", !before.includes(hsFlow));
    const sv = await api("PUT", `/examinations/${hsFlow}/result`, { trieu_chung_ghi_nhan: "Sốt nhẹ", chan_doan: "Cảm cúm", loi_dan: "Uống thuốc đúng giờ", don_thuoc: "Oseltamivir" }, docA.token);
    const co = await api("POST", "/lab-orders", { ho_so_id: hsFlow, phong_kham_id: lab, ten_xet_nghiem: `${P} XN Test cúm`, ghi_chu: "gấp" }, docA.token);
    check("Bác sĩ lưu kết quả khám + tạo chỉ định xét nghiệm", (sv.status === 200 || sv.status === 201) && co.status === 201, JSON.stringify([sv.data, co.data]));
    const oFlow = co.data.data?.chi_dinh?.id;
    const earlyClose = await api("POST", `/examinations/${hsFlow}/close`, null, docA.token);
    check("Còn chỉ định chưa xong -> đóng hồ sơ bị chặn (409), lịch sử chưa có", earlyClose.status === 409 && !(await list(p1.token)).data.data.some((x) => x.ho_so_id === hsFlow));
    await api("POST", `/lab/orders/${oFlow}/start`, null, staff.token);
    const upF = await upload(oFlow, staff.token, "Âm tính với cúm A/B");
    const closed = await api("POST", `/examinations/${hsFlow}/close`, null, docA.token);
    check("Phòng XN nộp kết quả, Bác sĩ Close Examination thành công -> hồ sơ DA_XONG", upF.status === 201 && closed.status === 200 && closed.data.data?.trang_thai === "DA_XONG", JSON.stringify([upF.data, closed.data]));
    const after = await list(p1.token);
    const idsAfter = after.data.data.map((x) => x.ho_so_id);
    check("Bệnh nhân refresh lịch sử -> record mới xuất hiện và đứng đầu (ngày khám mới nhất)", idsAfter[0] === hsFlow && idsAfter.length === before.length + 1, JSON.stringify(idsAfter));
    const df = (await detail(hsFlow, p1.token)).data.data || {};
    check("Chi tiết record mới: đúng kết quả khám + xét nghiệm + mô tả",
      df.ket_qua_kham?.chan_doan === "Cảm cúm" && df.ket_qua_kham?.don_thuoc === "Oseltamivir" && df.xet_nghiem?.[0]?.mo_ta === "Âm tính với cúm A/B" && df.xet_nghiem?.[0]?.trang_thai === "DA_XONG", JSON.stringify(df));
    const ff = await fileOf(hsFlow, oFlow, p1.token);
    check("Mở file xét nghiệm của record mới", ff.status === 200 && Buffer.from(await ff.arrayBuffer()).equals(PDF));
    check("P2 vẫn không thấy record mới của P1", !(await list(p2.token)).data.data.some((x) => x.ho_so_id === hsFlow) && (await detail(hsFlow, p2.token)).status === 404);

    // ---------- Không regression các API Patient hiện có ----------
    check("Booking / Appointment List của Bệnh nhân vẫn hoạt động (GET /appointments, /master/chuyen-khoa)",
      (await get("/appointments", p1.token)).status === 200 && (await get("/master/chuyen-khoa", p1.token)).status === 200);
    const hasTb = (await pool.query(`SELECT to_regclass('public."ThongBao"') AS t`)).rows[0].t;
    if (hasTb) check("Thông báo bệnh nhân (C5-05) vẫn hoạt động (GET /notifications)", (await get("/notifications", p1.token)).status === 200);
    else console.log("SKIP  Bảng ThongBao (C5-05) chưa có trên DB này -> bỏ qua kiểm tra thông báo");
  } catch (e) {
    console.error("LỖI khi chạy test:", e);
    fail++;
  } finally {
    await cleanup();
    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
    await pool.end();
    process.exit(fail === 0 ? 0 : 1);
  }
})();
