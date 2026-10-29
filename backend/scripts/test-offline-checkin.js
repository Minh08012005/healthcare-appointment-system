// C3-04 — Test API tiếp nhận Offline: POST /api/reception/offline-checkin
// Chạy: backend đang chạy ở localhost:3000, rồi `npm run api:test-offline`.
// Script tự tạo dữ liệu test (tiền tố ZZ) và tự dọn sau khi chạy.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const sfx = Date.now().toString().slice(-7);
const PREFIX_CCCD = `ZZ${sfx}`;

let pass = 0;
let fail = 0;
const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const made = { usernames: [], phongId: null, bacSiId: null, bacSiSaiKhoaId: null };

async function setup() {
  const ck = await pool.query(
    `SELECT id, ten_chuyen_khoa FROM "ChuyenKhoa" ORDER BY id LIMIT 2`
  );
  if (ck.rowCount < 2) throw new Error("Cần ít nhất 2 chuyên khoa (chạy npm run db:seed)");
  made.ck1 = ck.rows[0].id;
  made.ck2 = ck.rows[1].id;

  // Phòng + bác sĩ riêng cho test để STT bắt đầu từ 1 và không đụng dữ liệu thật
  const room = await pool.query(
    `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong)
     VALUES ($1, $2, 'Phòng khám') RETURNING id`,
    [`ZZ Phòng test ${sfx}`, made.ck1]
  );
  made.phongId = room.rows[0].id;
  const bs1 = await pool.query(
    `INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, muc_phi, cap_bac)
     VALUES ($1, $2, 100000, 'Test') RETURNING id`,
    [`ZZ BS ${sfx}`, made.ck1]
  );
  made.bacSiId = bs1.rows[0].id;
  const bs2 = await pool.query(
    `INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, muc_phi, cap_bac)
     VALUES ($1, $2, 100000, 'Test') RETURNING id`,
    [`ZZ BS khác khoa ${sfx}`, made.ck2]
  );
  made.bacSiSaiKhoaId = bs2.rows[0].id;

  // Tài khoản Lễ tân (seed không có sẵn)
  const role = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`);
  if (role.rowCount === 0) throw new Error("Chưa có vai trò 'Lễ tân' (chạy npm run db:seed)");
  const lt = `zz_lt_${sfx}`;
  made.usernames.push(lt);
  await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai)
     VALUES ($1, $2, $3, 'HoatDong')`,
    [lt, await bcrypt.hash("123456", 10), role.rows[0].id]
  );
  const login = await api("POST", "/auth/login", { username: lt, password: "123456" });
  made.tokenLeTan = login.data?.data?.token;

  // Tài khoản bệnh nhân thường (đi qua register của luồng Online)
  const registerPatient = async (i, extra = {}) => {
    const username = `zz_bn_${sfx}_${i}`;
    made.usernames.push(username);
    await api("POST", "/auth/register", { username, password: "123456", ho_ten: `ZZ Online ${i}`, ...extra });
    const l = await api("POST", "/auth/login", { username, password: "123456" });
    const me = await api("GET", "/auth/me", null, l.data.data.token);
    return { token: l.data.data.token, benhNhanId: me.data.data.user.benh_nhan_id };
  };
  made.registerPatient = registerPatient;
}

const body = (n, over = {}) => ({
  patient: {
    ho_ten: `ZZ Khách ${n}`,
    so_cccd_ho_chieu: `${PREFIX_CCCD}${n}`,
    ngay_sinh: "1990-05-20",
    gioi_tinh: "Nam",
    dia_chi: "Hà Nội",
  },
  trieu_chung: "Đau đầu, sốt nhẹ",
  chuyen_khoa_id: made.ck1,
  phong_kham_id: made.phongId,
  ...over,
});

const post = (b, token = made.tokenLeTan) => api("POST", "/reception/offline-checkin", b, token);

async function run() {
  await setup();
  check("Có token Lễ tân", !!made.tokenLeTan);

  // ---- API danh sách phòng (cho Lễ tân chọn phòng) ----
  const rooms = await api("GET", `/master/phong-kham?chuyen_khoa_id=${made.ck1}`);
  const mine = (rooms.data.data || []).find((x) => x.id === made.phongId);
  check("GET /master/phong-kham?chuyen_khoa_id -> 200, có phòng và đúng chuyên khoa",
    rooms.status === 200 && !!mine && (rooms.data.data || []).every((x) => x.chuyen_khoa_id === made.ck1), `(HTTP ${rooms.status})`);
  check("Phòng trả về có id, ten_phong, loai_phong, ten_chuyen_khoa",
    !!mine && mine.ten_phong && mine.loai_phong && mine.ten_chuyen_khoa);
  check("GET /master/phong-kham (không lọc) -> 200", (await api("GET", "/master/phong-kham")).status === 200);
  check("chuyen_khoa_id sai -> 400", (await api("GET", "/master/phong-kham?chuyen_khoa_id=abc")).status === 400);

  // ---- Quyền truy cập ----
  check("Không token -> 401", (await post(body(0), null)).status === 401);
  const bn = await made.registerPatient(1);
  check("Token bệnh nhân -> 403", (await post(body(0), bn.token)).status === 403);

  // ---- Thiếu / sai dữ liệu -> 400 / 404 ----
  const bad = async (label, b, status) => {
    const r = await post(b);
    check(label, r.status === status, `(HTTP ${r.status}: ${r.data.message})`);
  };
  await bad("Thiếu patient.ho_ten -> 400", body(0, { patient: { so_cccd_ho_chieu: `${PREFIX_CCCD}0` } }), 400);
  await bad("Thiếu CCCD (khi không có benh_nhan_id) -> 400", body(0, { patient: { ho_ten: "ZZ A" } }), 400);
  await bad("Thiếu triệu chứng -> 400", body(0, { trieu_chung: "   " }), 400);
  await bad("Thiếu phong_kham_id -> 400", body(0, { phong_kham_id: undefined }), 400);
  await bad("Ngày sinh sai -> 400", body(0, { patient: { ho_ten: "ZZ A", so_cccd_ho_chieu: `${PREFIX_CCCD}0`, ngay_sinh: "2090-01-01" } }), 400);
  await bad("Triệu chứng > 1000 ký tự -> 400", body(0, { trieu_chung: "a".repeat(1001) }), 400);
  await bad("Phòng không tồn tại -> 404", body(0, { phong_kham_id: 2147483000 }), 404);
  await bad("Phòng không thuộc chuyên khoa đã chọn -> 400", body(0, { chuyen_khoa_id: made.ck2 }), 400);
  await bad("Bác sĩ không tồn tại -> 404", body(0, { bac_si_id: 2147483000 }), 404);
  await bad("Bác sĩ khác chuyên khoa với phòng -> 400", body(0, { bac_si_id: made.bacSiSaiKhoaId }), 400);
  await bad("benh_nhan_id không tồn tại -> 404", { benh_nhan_id: 2147483000, trieu_chung: "Ho", phong_kham_id: made.phongId }, 404);
  const none = await pool.query(`SELECT count(*)::int AS n FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE $1`, [`${PREFIX_CCCD}%`]);
  check("Request bị reject không tạo bệnh nhân nào", none.rows[0].n === 0);

  // ---- Bệnh nhân MỚI, có bác sĩ ----
  const r1 = await post(body(1, { bac_si_id: made.bacSiId }));
  check("Bệnh nhân mới -> 201", r1.status === 201, JSON.stringify(r1.data));
  const d1 = r1.data.data || {};
  check("patient.is_new = true", d1.patient?.is_new === true);
  check("queue OFFLINE + CHO_KHAM", d1.queue?.loai === "OFFLINE" && d1.queue?.trang_thai === "CHO_KHAM");
  check("STT đầu tiên của phòng = 1, hiển thị B1", d1.queue?.so_thu_tu === 1 && d1.queue?.stt_hien_thi === "B1", `(STT=${d1.queue?.stt_hien_thi})`);
  check("so_lan_goi = 0, so_lan_bo_luot = 0", d1.queue?.so_lan_goi === 0 && d1.queue?.so_lan_bo_luot === 0);
  check("Response có phòng/bác sĩ/chuyên khoa/triệu chứng",
    d1.room?.id === made.phongId && d1.doctor?.id === made.bacSiId && d1.specialty?.id === made.ck1 && d1.trieu_chung === "Đau đầu, sốt nhẹ");

  const q1 = await pool.query(`SELECT * FROM "HangDoi" WHERE id = $1`, [d1.queue?.id]);
  const row = q1.rows[0] || {};
  check("DB: HangDoi đúng bệnh nhân/phòng/bác sĩ",
    row.benh_nhan_id === d1.patient?.id && row.phong_kham_id === made.phongId && row.bac_si_id === made.bacSiId);
  check("DB: HangDoi.dat_lich_id = NULL, loai/trang_thai đúng",
    row.dat_lich_id === null && row.loai === "OFFLINE" && row.trang_thai === "CHO_KHAM");
  const hs = await pool.query(
    `SELECT h.id, k.trieu_chung_ghi_nhan FROM "HoSoBenhAn" h JOIN "KetQuaKham" k ON k.ho_so_id = h.id WHERE h.hang_doi_id = $1`,
    [d1.queue?.id]
  );
  check("DB: có HoSoBenhAn + triệu chứng gắn với HangDoi", hs.rowCount === 1 && hs.rows[0].trieu_chung_ghi_nhan === "Đau đầu, sốt nhẹ");

  // ---- STT tăng dần, không bác sĩ ----
  const r2 = await post(body(2));
  check("Bệnh nhân mới thứ 2 -> STT = 2 (B2), doctor = null",
    r2.status === 201 && r2.data.data.queue.so_thu_tu === 2 && r2.data.data.queue.stt_hien_thi === "B2" && r2.data.data.doctor === null && r2.data.data.queue.so_nguoi_cho_truoc === 1,
    JSON.stringify(r2.data));

  // ---- Tiếp nhận trùng ----
  const dup = await post(body(1));
  check("Tiếp nhận lại bệnh nhân đang trong hàng đợi -> 409", dup.status === 409, `(HTTP ${dup.status})`);

  // ---- Hàng Online (A) trong cùng phòng không làm nhảy STT hàng Offline (B) ----
  const onl = await made.registerPatient(3);
  await pool.query(
    `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, loai, trang_thai) VALUES ($1, 7, $2, 'ONLINE', 'CHO_KHAM')`,
    [onl.benhNhanId, made.phongId]
  );

  // ---- Bệnh nhân ĐÃ TỒN TẠI (có tài khoản Online) ----
  const old = await made.registerPatient(2, { so_cccd_ho_chieu: `${PREFIX_CCCD}9` });
  const r3 = await post(body(9, { patient: { ho_ten: "TÊN KHÁC", so_cccd_ho_chieu: `${PREFIX_CCCD}9`, dia_chi: "Địa chỉ mới", gioi_tinh: "Nữ" } }));
  const p3 = r3.data.data?.patient || {};
  check("Bệnh nhân đã tồn tại (theo CCCD) -> 201, is_new = false, cùng id",
    r3.status === 201 && p3.is_new === false && p3.id === old.benhNhanId, JSON.stringify(r3.data));
  check("Không ghi đè họ tên; bổ sung trường còn trống (dia_chi, gioi_tinh)",
    p3.ho_ten === "ZZ Online 2" && p3.dia_chi === "Địa chỉ mới" && p3.gioi_tinh === "Nữ");
  check("Không tạo thêm hồ sơ BenhNhan trùng CCCD",
    (await pool.query(`SELECT count(*)::int AS n FROM "BenhNhan" WHERE so_cccd_ho_chieu = $1`, [`${PREFIX_CCCD}9`])).rows[0].n === 1);

  // ---- Theo benh_nhan_id ----
  const r4 = await post({ benh_nhan_id: bn.benhNhanId, trieu_chung: "Ho kéo dài", phong_kham_id: made.phongId });
  check("Tiếp nhận theo benh_nhan_id -> 201, STT = B4 (không bị ảnh hưởng bởi hàng Online A7)",
    r4.status === 201 && r4.data.data.patient.id === bn.benhNhanId && r4.data.data.queue.stt_hien_thi === "B4", JSON.stringify(r4.data));

  // ---- Xung đột CCCD/BHYT với bệnh nhân khác ----
  const bhyt = `ZZB${sfx}`;
  await post(body(3, { patient: { ho_ten: "ZZ Khách 3", so_cccd_ho_chieu: `${PREFIX_CCCD}3`, ma_bhyt: bhyt } }));
  const rb = await post(body(4, { patient: { ho_ten: "ZZ Khách 4", so_cccd_ho_chieu: `${PREFIX_CCCD}4`, ma_bhyt: bhyt } }));
  check("Mã BHYT của người khác -> 409", rb.status === 409, `(HTTP ${rb.status})`);
  check("409 xong không để lại bệnh nhân dở dang",
    (await pool.query(`SELECT count(*)::int AS n FROM "BenhNhan" WHERE so_cccd_ho_chieu = $1`, [`${PREFIX_CCCD}4`])).rows[0].n === 0);

  // ---- 5 request đồng thời: STT không trùng ----
  const before = (await pool.query(`SELECT COALESCE(MAX(so_thu_tu),0)::int AS m FROM "HangDoi" WHERE phong_kham_id = $1 AND loai = 'OFFLINE'`, [made.phongId])).rows[0].m;
  const par = await Promise.all([10, 11, 12, 13, 14].map((n) => post(body(n))));
  const stts = par.map((r) => r.data?.data?.queue?.so_thu_tu).sort((a, b) => a - b);
  const expected = [1, 2, 3, 4, 5].map((i) => before + i);
  check("5 request đồng thời -> 5 STT liên tiếp, không trùng",
    par.every((r) => r.status === 201) && JSON.stringify(stts) === JSON.stringify(expected), `(${stts})`);

  // ---- Lỗi giữa quá trình -> rollback toàn bộ ----
  await pool.query(`
    CREATE OR REPLACE FUNCTION zz_c304_fail() RETURNS trigger AS $$
    BEGIN
      IF NEW.trieu_chung_ghi_nhan = '__ZZ_FORCE_FAIL__' THEN RAISE EXCEPTION 'zz forced failure'; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await pool.query(`CREATE TRIGGER zz_c304_fail_trg BEFORE INSERT ON "KetQuaKham" FOR EACH ROW EXECUTE FUNCTION zz_c304_fail()`);
  try {
    const cnt = async () => (await pool.query(
      `SELECT (SELECT count(*) FROM "BenhNhan")::int AS bn, (SELECT count(*) FROM "HangDoi")::int AS hd, (SELECT count(*) FROM "HoSoBenhAn")::int AS hs`)).rows[0];
    const c0 = await cnt();
    const rf = await post(body(20, { trieu_chung: "__ZZ_FORCE_FAIL__" }));
    const c1 = await cnt();
    check("Lỗi ở bước cuối -> 500", rf.status === 500, `(HTTP ${rf.status})`);
    check("Lỗi giữa chừng: không còn BenhNhan/HangDoi/HoSo dở dang",
      c0.bn === c1.bn && c0.hd === c1.hd && c0.hs === c1.hs, JSON.stringify({ c0, c1 }));
    const ok = await post(body(20));
    check("Sau lỗi vẫn tiếp nhận được và STT không bị nhảy cóc",
      ok.status === 201 && ok.data.data.queue.so_thu_tu === before + 6, JSON.stringify(ok.data));
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS zz_c304_fail_trg ON "KetQuaKham"`);
    await pool.query(`DROP FUNCTION IF EXISTS zz_c304_fail()`);
  }
}

async function cleanup() {
  const q = async (sql, params) => pool.query(sql, params).catch((e) => console.log("cleanup:", e.message));
  const bnSql = `SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`;
  const pat = [`ZZ%${sfx}%`, `zz_%_${sfx}%`];
  await q(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${bnSql}))`, pat);
  await q(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${bnSql})`, pat);
  await q(`DELETE FROM "HangDoi" WHERE benh_nhan_id IN (${bnSql})`, pat);
  await q(`DELETE FROM "BenhNhan" WHERE id IN (${bnSql})`, pat);
  await q(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zz_%_${sfx}%`]);
  await q(`DELETE FROM "BacSi" WHERE id = ANY($1::int[])`, [[made.bacSiId, made.bacSiSaiKhoaId].filter(Boolean)]);
  if (made.phongId) await q(`DELETE FROM "PhongKham" WHERE id = $1`, [made.phongId]);
}

run()
  .catch((e) => {
    fail++;
    console.log("FAIL  Lỗi không mong đợi:", e.message);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\nKết quả: ${pass} PASS / ${fail} FAIL`);
    await pool.end();
    process.exitCode = fail > 0 ? 1 : 0;
  });
