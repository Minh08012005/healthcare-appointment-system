// Test C4-04: API lưu/cập nhật kết quả khám  PUT /api/examinations/:hoSoId/result
// Chạy: bật server (npm run dev) rồi `node scripts/test-c4-04.js`. Script tự tạo và tự dọn dữ liệu test.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const HS_DANG_KHAM = "DANG_KHAM";
const HS_DONE = "HOAN_THANH";
const sfx = Date.now().toString().slice(-6);
const P = `ZZF${sfx}`;
let pass = 0, fail = 0, n = 0, roleBS, roleLT, ck, pwHash;

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
const put = (id, body, token) => api("PUT", `/examinations/${id}/result`, body, token);
const get = (id, token) => api("GET", `/examinations/${id}`, undefined, token);

const mkUser = async (roleId, tag) => {
  const username = `zzf${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkDoctor = async (tag, withBsRecord = true) => {
  const u = await mkUser(roleBS, `d_${tag}`);
  let bsId = null;
  if (withBsRecord) {
    bsId = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [u.id, `${P} BS ${tag}`, ck]
      )
    ).rows[0].id;
  }
  return { bsId, token: u.token };
};

const mkPatient = async (tag) =>
  (
    await pool.query(
      `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, ma_bhyt, dia_chi) VALUES ($1,'1990-05-20','Nam',$2,'Ha Noi') RETURNING id`,
      [`${P} BN ${tag}`, `${P}${++n}`]
    )
  ).rows[0].id;

// o: { hdBs, hsBs, hsState }
const mkVisit = async (roomId, bnId, o) => {
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
       VALUES ($1,$2,$3,$4,'ONLINE',$5,1,0,NOW()) RETURNING id`,
      [bnId, ++n, roomId, o.hdBs ?? null, o.hsState === HS_DANG_KHAM ? "DANG_KHAM" : "DA_XONG"]
    )
  ).rows[0].id;
  return (
    await pool.query(
      `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,$4) RETURNING id`,
      [hd, bnId, o.hsBs ?? null, o.hsState || HS_DANG_KHAM]
    )
  ).rows[0].id;
};

const countKq = async (hs) =>
  Number((await pool.query(`SELECT COUNT(*) AS c FROM "KetQuaKham" WHERE ho_so_id = $1`, [hs])).rows[0].c);

const cleanup = async () => {
  try {
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat}))`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [`${P} BN %`, `zzf${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzf${sfx}_%`]);
    console.log("\nĐã dọn dữ liệu test.");
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    roleLT = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`)).rows[0].id;
    ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;
    const room = (
      await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} R1`, ck])
    ).rows[0].id;

    const docA = await mkDoctor("A");
    const docB = await mkDoctor("B");
    const docNoBs = await mkDoctor("nobs", false);
    const lt = await mkUser(roleLT, "lt");
    const ptName = `zzf${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    const hsA = await mkVisit(room, await mkPatient("A"), { hdBs: docA.bsId, hsBs: docA.bsId });
    const hsOff = await mkVisit(room, await mkPatient("OFF"), { hdBs: docA.bsId, hsBs: null }); // chủ qua HangDoi
    const hsDone = await mkVisit(room, await mkPatient("DONE"), { hdBs: docA.bsId, hsBs: docA.bsId, hsState: HS_DONE });
    const hsB = await mkVisit(room, await mkPatient("B"), { hdBs: docB.bsId, hsBs: docB.bsId });

    // ---- Xác thực / vai trò ----
    let r = await put(hsA, { chan_doan: "x" });
    check("Không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    r = await put(hsA, { chan_doan: "x" }, ptTok);
    check("Bệnh nhân -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await put(hsA, { chan_doan: "x" }, lt.token);
    check("Lễ tân -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await put(hsA, { chan_doan: "x" }, docNoBs.token);
    check("Tài khoản bác sĩ chưa gắn hồ sơ BacSi -> 403", r.status === 403, `(nhận ${r.status})`);

    // ---- ho_so_id ----
    for (const bad of ["abc", "0", "-5", "1.5", "99999999999"]) {
      r = await put(bad, { chan_doan: "x" }, docA.token);
      check(`ho_so_id="${bad}" -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await put(999999999, { chan_doan: "x" }, docA.token);
    check("ho_so_id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);

    // ---- Validate body ----
    for (const [label, body] of [
      ["body rỗng {}", {}],
      ["body không có trường hợp lệ", { abc: "x" }],
      ["trường không phải chuỗi", { chan_doan: 123 }],
      ["chuỗi quá dài", { loi_dan: "a".repeat(10001) }],
      ["body là mảng", ["x"]],
    ]) {
      r = await put(hsA, body, docA.token);
      check(`${label} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    check("Body sai không tạo KetQuaKham", (await countKq(hsA)) === 0);

    // ---- Quyền sở hữu ----
    r = await put(hsB, { chan_doan: "x" }, docA.token);
    check("Bác sĩ A sửa hồ sơ của bác sĩ B -> 403", r.status === 403, `(nhận ${r.status})`);
    check("Bị từ chối thì không ghi dữ liệu", (await countKq(hsB)) === 0);

    // ---- Trạng thái hồ sơ ----
    r = await put(hsDone, { chan_doan: "x" }, docA.token);
    check("Hồ sơ không còn DANG_KHAM -> 409", r.status === 409, `(nhận ${r.status})`);
    check("Hồ sơ đã đóng không bị ghi", (await countKq(hsDone)) === 0);

    // ---- Lưu lần đầu (triệu chứng) ----
    r = await put(hsA, { trieu_chung_ghi_nhan: "  Ho keo dai, sot nhe  " }, docA.token);
    check("Lưu triệu chứng -> 201", r.status === 201, `(nhận ${r.status})`);
    check("Trim chuỗi + trả đúng dữ liệu", r.data?.data?.ket_qua_kham?.trieu_chung_ghi_nhan === "Ho keo dai, sot nhe");
    check("Các trường chưa gửi = null", r.data?.data?.ket_qua_kham?.chan_doan === null);
    const kqId = r.data?.data?.ket_qua_kham?.id;

    // ---- Lưu lần hai (cập nhật từng phần, không tạo trùng) ----
    r = await put(hsA, { chan_doan: "Viem phe quan", loi_dan: "Nghi ngoi, uong nhieu nuoc", don_thuoc: "Paracetamol 500mg" }, docA.token);
    check("Lưu chẩn đoán/lời dặn/đơn thuốc -> 200", r.status === 200, `(nhận ${r.status})`);
    check("Cập nhật đúng record cũ (cùng id)", r.data?.data?.ket_qua_kham?.id === kqId);
    check("Cập nhật từng phần: giữ nguyên triệu chứng", r.data?.data?.ket_qua_kham?.trieu_chung_ghi_nhan === "Ho keo dai, sot nhe");
    check("Không tạo record trùng", (await countKq(hsA)) === 1);

    // ---- Xoá nội dung 1 trường ----
    r = await put(hsA, { loi_dan: "   " }, docA.token);
    check("Chuỗi rỗng -> xoá nội dung (null)", r.status === 200 && r.data?.data?.ket_qua_kham?.loi_dan === null);
    r = await put(hsA, { loi_dan: "Tai kham sau 1 tuan" }, docA.token);

    // ---- Đọc lại qua API C4-02 ----
    r = await get(hsA, docA.token);
    const kq = r.data?.data?.ket_qua_kham;
    check(
      "Đọc lại qua GET C4-02 đúng dữ liệu",
      r.status === 200 &&
        kq?.id === kqId &&
        kq.trieu_chung_ghi_nhan === "Ho keo dai, sot nhe" &&
        kq.chan_doan === "Viem phe quan" &&
        kq.loi_dan === "Tai kham sau 1 tuan" &&
        kq.don_thuoc === "Paracetamol 500mg"
    );

    // ---- Đồng thời: 10 request song song vào hồ sơ chưa có kết quả ----
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => put(hsOff, { chan_doan: `Song song ${i}` }, docA.token)));
    check("Hồ sơ Offline (chủ qua HangDoi) lưu được", results.every((x) => x.status === 200 || x.status === 201));
    check("10 request song song -> chỉ 1 KetQuaKham", (await countKq(hsOff)) === 1, `(có ${await countKq(hsOff)})`);

    // ---- Dòng trùng có sẵn từ trước: cập nhật dòng mới nhất, không tạo thêm ----
    await pool.query(`INSERT INTO "KetQuaKham" (ho_so_id, chan_doan) VALUES ($1,'cu1'),($1,'cu2')`, [hsB]);
    r = await put(hsB, { chan_doan: "moi" }, docB.token);
    const latest = (await pool.query(`SELECT chan_doan FROM "KetQuaKham" WHERE ho_so_id=$1 ORDER BY id DESC LIMIT 1`, [hsB])).rows[0];
    check("Có sẵn nhiều dòng: sửa dòng mới nhất, không thêm dòng", r.status === 200 && latest.chan_doan === "moi" && (await countKq(hsB)) === 2);

    // ---- Hồ sơ không đổi trạng thái ----
    const st = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id=$1`, [hsA])).rows[0].trang_thai;
    check("Lưu kết quả không đổi trạng thái hồ sơ", st === HS_DANG_KHAM);
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