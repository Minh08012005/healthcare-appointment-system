// C3-06 — Test API hàng đợi Lễ tân: GET /api/reception/queue
// Chạy: backend đang chạy ở localhost:3000, rồi `npm run api:test-reception-queue`.
// Script tự tạo dữ liệu test (tiền tố ZZ) và tự dọn sau khi chạy.
// Queue Offline tạo thật qua API C3-04; Queue Online (C3-03) mô phỏng bằng SQL đúng các cột C3-03 sinh ra.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const sfx = Date.now().toString().slice(-7);

let pass = 0;
let fail = 0;
const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const made = { roomA: null, roomB: null, doctor: null, token: null };

async function newPatient(tag) {
  const r = await pool.query(
    `INSERT INTO "BenhNhan" (ho_ten, so_cccd_ho_chieu, gioi_tinh, ngay_sinh) VALUES ($1, $2, 'Nam', '1990-01-01') RETURNING id`,
    [`ZZ Q ${tag}`, `ZZ${sfx}Q${tag}`]
  );
  return r.rows[0].id;
}

async function addQueueRow({ benhNhanId, soThuTu, phongId, loai, trangThai, bacSiId = null, ngayTruoc = 0 }) {
  const r = await pool.query(
    `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, thoi_gian_check_in)
     VALUES ($1, $2, $3, $4, $5, $6, now() - ($7 || ' days')::interval) RETURNING id`,
    [benhNhanId, soThuTu, phongId, bacSiId, loai, trangThai, String(ngayTruoc)]
  );
  return r.rows[0].id;
}

async function setup() {
  const ck = await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`);
  if (ck.rowCount === 0) throw new Error("Chưa có chuyên khoa (chạy npm run db:seed)");
  made.ck = ck.rows[0].id;
  const mkRoom = async (n) =>
    (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1, $2, 'Phòng khám') RETURNING id`, [`ZZ Phòng Q${n} ${sfx}`, made.ck])).rows[0].id;
  made.roomA = await mkRoom("A");
  made.roomB = await mkRoom("B");
  made.doctor = (await pool.query(`INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1, $2, 100000, 'Test') RETURNING id`, [`ZZ BS Q ${sfx}`, made.ck])).rows[0].id;

  const role = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`);
  if (role.rowCount === 0) throw new Error("Chưa có vai trò 'Lễ tân' (chạy npm run db:seed)");
  made.lt = `zz_ltq_${sfx}`;
  await pool.query(`INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1, $2, $3, 'HoatDong')`, [made.lt, await bcrypt.hash("123456", 10), role.rows[0].id]);
  made.token = (await api("POST", "/auth/login", { username: made.lt, password: "123456" })).data?.data?.token;

  made.bn = `zz_bnq_${sfx}`;
  await api("POST", "/auth/register", { username: made.bn, password: "123456", ho_ten: `ZZ Q Bệnh nhân thường` });
  made.tokenBn = (await api("POST", "/auth/login", { username: made.bn, password: "123456" })).data?.data?.token;
}

const get = (qs, token = made.token) => api("GET", `/reception/queue${qs}`, null, token);
const offline = (n, phongId, bacSiId) =>
  api("POST", "/reception/offline-checkin", {
    patient: { ho_ten: `ZZ Q Offline ${n}`, so_cccd_ho_chieu: `ZZ${sfx}Qoff${n}`, ngay_sinh: "1992-03-04", gioi_tinh: "Nữ" },
    trieu_chung: "Đau đầu",
    phong_kham_id: phongId,
    ...(bacSiId ? { bac_si_id: bacSiId } : {}),
  }, made.token);

async function run() {
  await setup();
  check("Có token Lễ tân và token bệnh nhân", !!made.token && !!made.tokenBn);

  // ---- Quyền ----
  check("Không token -> 401", (await get(`?phong_kham_id=${made.roomA}`, null)).status === 401);
  check("Token bệnh nhân -> 403", (await get(`?phong_kham_id=${made.roomA}`, made.tokenBn)).status === 403);

  // ---- Tham số ----
  const bad = async (label, qs, status) => {
    const r = await get(qs);
    check(label, r.status === status, `(HTTP ${r.status}: ${r.data.message})`);
  };
  await bad("Thiếu phong_kham_id -> 400", "", 400);
  await bad("phong_kham_id = abc -> 400", "?phong_kham_id=abc", 400);
  await bad("phong_kham_id = 0 -> 400", "?phong_kham_id=0", 400);
  await bad("phong_kham_id quá lớn -> 400", "?phong_kham_id=99999999999", 400);
  await bad("Phòng không tồn tại -> 404", "?phong_kham_id=2147483000", 404);
  await bad("ngay sai định dạng -> 400", `?phong_kham_id=${made.roomA}&ngay=30-10-2026`, 400);
  await bad("ngay không có thật -> 400", `?phong_kham_id=${made.roomA}&ngay=2026-02-31`, 400);
  await bad("loai sai -> 400", `?phong_kham_id=${made.roomA}&loai=XYZ`, 400);
  await bad("trang_thai sai -> 400", `?phong_kham_id=${made.roomA}&trang_thai=CHO_KHAM,ABC`, 400);

  // ---- Hàng đợi rỗng ----
  const empty = await get(`?phong_kham_id=${made.roomB}`);
  check("Phòng chưa có ai -> 200, queue rỗng, summary = 0",
    empty.status === 200 && Array.isArray(empty.data.data?.queue) && empty.data.data.queue.length === 0 &&
    empty.data.data.summary.tong === 0 && empty.data.data.room.id === made.roomB, JSON.stringify(empty.data));

  // ---- Queue Offline (B) tạo thật qua C3-04 ----
  const o1 = await offline(1, made.roomA, made.doctor);
  const o2 = await offline(2, made.roomA);
  const oB = await offline(3, made.roomB);
  check("Tạo 3 lượt Offline qua API C3-04", [o1, o2, oB].every((x) => x.status === 201), JSON.stringify([o1.data, o2.data, oB.data]));

  // ---- Queue Online (A) mô phỏng C3-03 ----
  const pOn1 = await newPatient("on1");
  const pOn2 = await newPatient("on2");
  const pOnB = await newPatient("onB");
  const on1 = await addQueueRow({ benhNhanId: pOn1, soThuTu: 1, phongId: made.roomA, loai: "ONLINE", trangThai: "CHO_KHAM", bacSiId: made.doctor });
  const on2 = await addQueueRow({ benhNhanId: pOn2, soThuTu: 2, phongId: made.roomA, loai: "ONLINE", trangThai: "DANG_GOI" });
  await addQueueRow({ benhNhanId: pOnB, soThuTu: 1, phongId: made.roomB, loai: "ONLINE", trangThai: "CHO_KHAM" });

  // ---- Đọc phòng A ----
  const a = await get(`?phong_kham_id=${made.roomA}`);
  const q = a.data.data?.queue || [];
  check("Phòng A -> 200, có 4 lượt", a.status === 200 && q.length === 4, JSON.stringify(a.data));
  check("Thứ tự: A1, A2 (Online) rồi B1, B2 (Offline)", JSON.stringify(q.map((x) => x.stt_hien_thi)) === '["A1","A2","B1","B2"]', JSON.stringify(q.map((x) => x.stt_hien_thi)));
  check("loai đúng theo dữ liệu", JSON.stringify(q.map((x) => x.loai)) === '["ONLINE","ONLINE","OFFLINE","OFFLINE"]');
  check("trang_thai đúng (CHO_KHAM, DANG_GOI, CHO_KHAM, CHO_KHAM)", JSON.stringify(q.map((x) => x.trang_thai)) === '["CHO_KHAM","DANG_GOI","CHO_KHAM","CHO_KHAM"]');
  check("Queue Offline từ C3-04: so_thu_tu 1, 2; so_lan_goi = 0; so_lan_bo_luot = 0; dat_lich_id = null",
    q[2]?.so_thu_tu === 1 && q[3]?.so_thu_tu === 2 && q[2]?.so_lan_goi === 0 && q[2]?.so_lan_bo_luot === 0 && q[2]?.dat_lich_id === null);
  check("Bệnh nhân đúng (id + họ tên + ngày sinh + giới tính)",
    q[2]?.patient?.id === o1.data.data?.patient?.id && q[2]?.patient?.ho_ten === "ZZ Q Offline 1" &&
    q[2]?.patient?.ngay_sinh === "1992-03-04" && q[2]?.patient?.gioi_tinh === "Nữ" &&
    q[0]?.patient?.id === pOn1 && q[1]?.patient?.id === pOn2);
  check("Bác sĩ: có khi đã xác định, null khi chưa", q[0]?.doctor?.id === made.doctor && q[2]?.doctor?.id === made.doctor && q[1]?.doctor === null && q[3]?.doctor === null);
  check("Có thoi_gian_check_in để sắp xếp", q.every((x) => !!x.thoi_gian_check_in && !Number.isNaN(Date.parse(x.thoi_gian_check_in))));
  check("Thông tin phòng + ngày + summary đúng",
    a.data.data?.room?.id === made.roomA && /^\d{4}-\d{2}-\d{2}$/.test(a.data.data?.ngay || "") &&
    a.data.data?.summary?.tong === 4 && a.data.data.summary.online === 2 && a.data.data.summary.offline === 2 &&
    a.data.data.summary.theo_trang_thai?.CHO_KHAM === 3 && a.data.data.summary.theo_trang_thai?.DANG_GOI === 1);

  // ---- Không lẫn phòng ----
  const b = await get(`?phong_kham_id=${made.roomB}`);
  const qb = b.data.data?.queue || [];
  const idsA = new Set(q.map((x) => x.patient.id));
  check("Phòng B chỉ có 2 lượt của phòng B (A1, B1)", qb.length === 2 && JSON.stringify(qb.map((x) => x.stt_hien_thi)) === '["A1","B1"]', JSON.stringify(qb.map((x) => x.stt_hien_thi)));
  check("Không lẫn bệnh nhân giữa phòng A và B", qb.every((x) => !idsA.has(x.patient.id)) && qb[0]?.patient?.id === pOnB && qb[1]?.patient?.id === oB.data.data?.patient?.id);

  // ---- Lọc ----
  check("loai=ONLINE -> chỉ 2 lượt Online", (await get(`?phong_kham_id=${made.roomA}&loai=online`)).data.data?.queue?.every((x) => x.loai === "ONLINE") && (await get(`?phong_kham_id=${made.roomA}&loai=ONLINE`)).data.data.queue.length === 2);
  check("loai=OFFLINE -> chỉ 2 lượt Offline", (await get(`?phong_kham_id=${made.roomA}&loai=OFFLINE`)).data.data?.queue?.length === 2);
  check("trang_thai=DANG_GOI -> 1 lượt", (await get(`?phong_kham_id=${made.roomA}&trang_thai=dang_goi`)).data.data?.queue?.length === 1);

  // ---- Trạng thái kết thúc bị ẩn mặc định, hiện khi ALL ----
  await addQueueRow({ benhNhanId: await newPatient("done"), soThuTu: 3, phongId: made.roomA, loai: "OFFLINE", trangThai: "DA_XONG" });
  await addQueueRow({ benhNhanId: await newPatient("skip"), soThuTu: 4, phongId: made.roomA, loai: "OFFLINE", trangThai: "BO_LUOT" });
  check("Mặc định ẩn DA_XONG/BO_LUOT -> vẫn 4 lượt", (await get(`?phong_kham_id=${made.roomA}`)).data.data?.queue?.length === 4);
  const all = await get(`?phong_kham_id=${made.roomA}&trang_thai=ALL`);
  check("trang_thai=ALL -> 6 lượt", all.data.data?.queue?.length === 6, `(${all.data.data?.queue?.length})`);

  // ---- Theo ngày (giờ VN) ----
  await addQueueRow({ benhNhanId: await newPatient("old"), soThuTu: 9, phongId: made.roomA, loai: "OFFLINE", trangThai: "CHO_KHAM", ngayTruoc: 1 });
  const ytd = (await pool.query(`SELECT to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1, 'YYYY-MM-DD') AS d`)).rows[0].d;
  check("Lượt của hôm qua không lẫn vào hôm nay", (await get(`?phong_kham_id=${made.roomA}`)).data.data?.queue?.length === 4);
  const yres = await get(`?phong_kham_id=${made.roomA}&ngay=${ytd}`);
  check("ngay=hôm qua -> đúng 1 lượt (B9)", yres.data.data?.queue?.length === 1 && yres.data.data.queue[0].stt_hien_thi === "B9" && yres.data.data.ngay === ytd, JSON.stringify(yres.data));

  // ---- Phản ánh dữ liệu thật + ổn định + chỉ đọc ----
  const r1 = await get(`?phong_kham_id=${made.roomA}`);
  const r2 = await get(`?phong_kham_id=${made.roomA}`);
  check("Gọi 2 lần liên tiếp cho cùng thứ tự", JSON.stringify(r1.data.data.queue.map((x) => x.id)) === JSON.stringify(r2.data.data.queue.map((x) => x.id)));
  await pool.query(`UPDATE "HangDoi" SET trang_thai = 'DANG_KHAM' WHERE id = $1`, [on1]);
  const upd = await get(`?phong_kham_id=${made.roomA}`);
  check("Đổi trạng thái trong DB -> API phản ánh ngay (DANG_KHAM)", upd.data.data.queue[0]?.trang_thai === "DANG_KHAM");
  await pool.query(`DELETE FROM "HangDoi" WHERE id = $1`, [on2]);
  check("Xóa 1 lượt trong DB -> API không còn lượt đó", (await get(`?phong_kham_id=${made.roomA}`)).data.data.queue.every((x) => x.id !== on2));
  const cnt = async () => (await pool.query(`SELECT count(*)::int AS n, coalesce(sum(so_lan_goi + so_lan_bo_luot),0)::int AS s FROM "HangDoi" WHERE phong_kham_id = ANY($1::int[])`, [[made.roomA, made.roomB]])).rows[0];
  const c0 = await cnt();
  await get(`?phong_kham_id=${made.roomA}`);
  await get(`?phong_kham_id=${made.roomA}&trang_thai=ALL`);
  const c1 = await cnt();
  check("API chỉ đọc: không thêm/xóa/đổi dữ liệu HangDoi", JSON.stringify(c0) === JSON.stringify(c1));

  // ---- Không ảnh hưởng C3-04 ----
  const o4 = await offline(4, made.roomA);
  check("C3-04 vẫn tiếp nhận được sau khi dùng API hàng đợi (B…)", o4.status === 201 && /^B\d+$/.test(o4.data.data?.queue?.stt_hien_thi || ""), JSON.stringify(o4.data));
  const fin = await get(`?phong_kham_id=${made.roomA}`);
  check("Lượt vừa tiếp nhận hiện trong hàng đợi", fin.data.data.queue.some((x) => x.patient.id === o4.data.data.patient.id));
}

async function cleanup() {
  const q = async (sql, params) => pool.query(sql, params).catch((e) => console.log("cleanup:", e.message));
  const bnSql = `SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`;
  const pat = [`ZZ${sfx}%`, `zz_%q_${sfx}%`];
  await q(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${bnSql}))`, pat);
  await q(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${bnSql})`, pat);
  await q(`DELETE FROM "HangDoi" WHERE benh_nhan_id IN (${bnSql}) OR phong_kham_id = ANY($3::int[])`, [...pat, [made.roomA, made.roomB].filter(Boolean)]);
  await q(`DELETE FROM "BenhNhan" WHERE id IN (${bnSql})`, pat);
  await q(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zz_%q_${sfx}%`]);
  if (made.doctor) await q(`DELETE FROM "BacSi" WHERE id = $1`, [made.doctor]);
  await q(`DELETE FROM "PhongKham" WHERE id = ANY($1::int[])`, [[made.roomA, made.roomB].filter(Boolean)]);
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
