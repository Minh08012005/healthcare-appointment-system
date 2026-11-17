// C6-04 - Quản lý Phòng & Gán nhân viên (UC-029)
// Chạy: npm run api:test-c6-04   (backend phải đang chạy ở localhost:3000)
// Tự tạo dữ liệu test (tiền tố ZZR...) và tự dọn sau khi chạy.

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `ZZR${sfx}`;
const LOAI_KHAM = "Phòng khám";
const LOAI_XN = "Phòng xét nghiệm";
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
const post = (p, t, b) => api("POST", p, b ?? {}, t);
const put = (p, t, b) => api("PUT", p, b ?? {}, t);
const del = (p, t) => api("DELETE", p, undefined, t);

const roleId = async (name) =>
  (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [name])).rows[0].id;

const mkUser = async (roleName, tag, status = STATUS_ACTIVE) => {
  const username = `zzr${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, await roleId(roleName), status]
  );
  const login = status === STATUS_ACTIVE ? await api("POST", "/auth/login", { username, password: "123456" }) : null;
  return { id: r.rows[0].id, token: login?.data?.data?.token };
};

const accountRoom = async (id) =>
  (await pool.query(`SELECT phong_kham_id FROM "TaiKhoan" WHERE id = $1`, [id])).rows[0].phong_kham_id;

// Tạo 1 chỉ định XN (kèm bệnh nhân + hồ sơ) gửi tới phòng roomId
const mkLabOrder = async (roomId, name) => {
  const bn = await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN ${name}`]);
  const hs = await pool.query(
    `INSERT INTO "HoSoBenhAn" (benh_nhan_id, trang_thai) VALUES ($1, 'DANG_KHAM') RETURNING id`,
    [bn.rows[0].id]
  );
  return (
    await pool.query(
      `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, ten_xet_nghiem, trang_thai)
       VALUES ($1, $2, $3, 'CHO_XU_LY') RETURNING id`,
      [hs.rows[0].id, roomId, `${P} ${name}`]
    )
  ).rows[0].id;
};

// Dọn dữ liệu test trực tiếp trong DB (dọn dẹp, không phải chức năng hệ thống)
const cleanup = async () => {
  try {
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ten_xet_nghiem LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1)`,
      [`${P} BN %`]
    );
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN %`]);
    await pool.query(
      `DELETE FROM "LichKhamBacSi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong ILIKE $1)`,
      [`${P}%`]
    );
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS%`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzr${sfx}_%`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong ILIKE $1`, [`${P}%`]);
  } catch (e) {
    console.error("Cleanup lỗi:", e.message);
  }
};

(async () => {
  pwHash = await bcrypt.hash("123456", 10);
  try {
    const admin = await mkUser("Quản trị viên", "admin");
    const ktv1 = await mkUser("Xét nghiệm", "ktv1");
    const ktv2 = await mkUser("Xét nghiệm", "ktv2");
    const letan = await mkUser("Lễ tân", "letan");
    const bacsi = await mkUser("Bác sĩ", "bacsi");
    const ktvLocked = await mkUser("Xét nghiệm", "locked", "BiKhoa");
    const T = admin.token;
    const ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    // ---------- Quyền ----------
    check("Không token -> 401", (await get("/admin/rooms")).status === 401);
    check("Không phải admin -> 403", (await get("/admin/rooms", ktv1.token)).status === 403);

    // ---------- List ----------
    let r = await get("/admin/rooms", T);
    check("List phòng -> 200 + items là mảng", r.status === 200 && Array.isArray(r.data.data?.items));
    r = await get(`/admin/rooms?loai_phong=${encodeURIComponent(LOAI_XN)}`, T);
    check("Lọc loai_phong=Phòng xét nghiệm", r.status === 200 && r.data.data.items.every((x) => x.loai_phong === LOAI_XN));
    check("loai_phong lọc sai -> 400", (await get("/admin/rooms?loai_phong=abc", T)).status === 400);

    // ---------- Create ----------
    r = await post("/admin/rooms", T, { ten_phong: `${P} Kham 1`, loai_phong: LOAI_KHAM, chuyen_khoa_id: ck });
    check("Tạo phòng khám -> 201", r.status === 201 && r.data.data?.chuyen_khoa?.id === ck, JSON.stringify(r.data.message || ""));
    const kham1 = r.data.data?.id;
    r = await post("/admin/rooms", T, { ten_phong: `${P} XN A`, loai_phong: LOAI_XN });
    check("Tạo phòng XN -> 201, chuyen_khoa null", r.status === 201 && r.data.data?.chuyen_khoa === null);
    const xnA = r.data.data?.id;
    r = await post("/admin/rooms", T, { ten_phong: `${P} XN B`, loai_phong: LOAI_XN, chuyen_khoa_id: null });
    const xnB = r.data.data?.id;
    check("Tạo phòng XN B -> 201", r.status === 201);

    r = await post("/admin/rooms", T, { ten_phong: `  ${P.toLowerCase()}   kham 1 `, loai_phong: LOAI_KHAM, chuyen_khoa_id: ck });
    check("Tên trùng (khác hoa/thường, khoảng trắng) -> 409 DUPLICATE_NAME", r.status === 409 && r.data.code === "DUPLICATE_NAME");
    check("Loại phòng không hợp lệ -> 400", (await post("/admin/rooms", T, { ten_phong: `${P} X`, loai_phong: "Kho" })).status === 400);
    check("Tên trống -> 400", (await post("/admin/rooms", T, { ten_phong: "  ", loai_phong: LOAI_XN })).status === 400);
    check("Phòng khám thiếu chuyên khoa -> 400", (await post("/admin/rooms", T, { ten_phong: `${P} Y`, loai_phong: LOAI_KHAM })).status === 400);
    check(
      "Phòng khám chuyên khoa không tồn tại -> 400",
      (await post("/admin/rooms", T, { ten_phong: `${P} Y`, loai_phong: LOAI_KHAM, chuyen_khoa_id: 999999 })).status === 400
    );
    check(
      "Phòng XN gắn chuyên khoa -> 400",
      (await post("/admin/rooms", T, { ten_phong: `${P} Z`, loai_phong: LOAI_XN, chuyen_khoa_id: ck })).status === 400
    );

    // ---------- Update ----------
    r = await put(`/admin/rooms/${kham1}`, T, { ten_phong: `${P} Kham 1 moi`, loai_phong: LOAI_KHAM, chuyen_khoa_id: ck });
    check("Sửa tên phòng -> 200", r.status === 200 && r.data.data?.ten_phong === `${P} Kham 1 moi`);
    r = await put(`/admin/rooms/${kham1}`, T, { ten_phong: `${P} XN A`, loai_phong: LOAI_KHAM, chuyen_khoa_id: ck });
    check("Sửa sang tên đã có -> 409", r.status === 409 && r.data.code === "DUPLICATE_NAME");
    check("Sửa phòng không tồn tại -> 404", (await put("/admin/rooms/999999", T, { ten_phong: `${P} Q`, loai_phong: LOAI_XN })).status === 404);

    // Phòng khám có lịch trực -> không đổi loại / chuyên khoa / không xóa được
    const bs = await pool.query(`INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id) VALUES ($1, $2) RETURNING id`, [`${P} BS`, ck]);
    await pool.query(
      `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       VALUES ($1, $2, CURRENT_DATE + 30, '06:00', '07:00', 6, 4, 0, 'HoatDong')`,
      [bs.rows[0].id, kham1]
    );
    r = await put(`/admin/rooms/${kham1}`, T, { ten_phong: `${P} Kham 1 moi`, loai_phong: LOAI_XN });
    check("Đổi loại phòng đang có lịch trực -> 409 ROOM_TYPE_LOCKED", r.status === 409 && r.data.code === "ROOM_TYPE_LOCKED");
    const ck2 = (await pool.query(`SELECT id FROM "ChuyenKhoa" WHERE id <> $1 ORDER BY id LIMIT 1`, [ck])).rows[0]?.id;
    if (ck2) {
      r = await put(`/admin/rooms/${kham1}`, T, { ten_phong: `${P} Kham 1 moi`, loai_phong: LOAI_KHAM, chuyen_khoa_id: ck2 });
      check("Đổi chuyên khoa phòng đang có lịch trực -> 409 SPECIALTY_LOCKED", r.status === 409 && r.data.code === "SPECIALTY_LOCKED");
    }
    r = await del(`/admin/rooms/${kham1}`, T);
    check("Xóa phòng có lịch trực -> 409 HAS_REFERENCES", r.status === 409 && r.data.code === "HAS_REFERENCES" && r.data.data?.so_lich_truc === 1);
    check("Phòng có lịch vẫn còn trong DB", (await get(`/admin/rooms/${kham1}`, T)).status === 200);

    // ---------- Assignment ----------
    r = await put(`/admin/rooms/${xnA}/staff/${ktv1.id}`, T);
    check("Gán KTV1 chưa có phòng vào XN A -> 200", r.status === 200 && (await accountRoom(ktv1.id)) === xnA);
    r = await put(`/admin/rooms/${xnA}/staff/${ktv2.id}`, T);
    check("Gán KTV2 vào XN A -> 200", r.status === 200);
    r = await get(`/admin/rooms/${xnA}`, T);
    check("Một phòng có nhiều nhân viên (so_nhan_vien = 2)", r.data.data?.so_nhan_vien === 2);

    r = await put(`/admin/rooms/${xnB}/staff/${ktv1.id}`, T);
    check(
      "Chuyển KTV1 sang XN B chưa xác nhận -> 409 ACCOUNT_IN_OTHER_ROOM",
      r.status === 409 && r.data.code === "ACCOUNT_IN_OTHER_ROOM" && r.data.data?.phong_hien_tai?.id === xnA
    );
    check("Chưa xác nhận thì KTV1 vẫn ở XN A", (await accountRoom(ktv1.id)) === xnA);

    // Integration C5 trước khi chuyển: KTV1 chỉ thấy chỉ định phòng A
    const orderA = await mkLabOrder(xnA, "CD A");
    const orderB = await mkLabOrder(xnB, "CD B");
    const labIds = async () =>
      ((await get("/lab/orders?limit=200", ktv1.token)).data.data?.items || []).map((x) => x.chi_dinh_id);
    let ids = await labIds();
    check("C5: KTV1 ở phòng A chỉ thấy chỉ định phòng A", ids.includes(orderA) && !ids.includes(orderB));

    r = await put(`/admin/rooms/${xnB}/staff/${ktv1.id}`, T, { confirm_transfer: true });
    check("Chuyển KTV1 A -> B có xác nhận -> 200", r.status === 200 && r.data.data?.phong_cu?.id === xnA);
    check("KTV1 giờ thuộc B", (await accountRoom(ktv1.id)) === xnB);
    r = await get(`/admin/rooms/${xnA}`, T);
    check("KTV1 không còn trong danh sách phòng A", !r.data.data.nhan_vien.some((n) => n.id === ktv1.id));
    ids = await labIds();
    check("C5: reload -> KTV1 chỉ thấy chỉ định phòng B (không cần đăng nhập lại)", ids.includes(orderB) && !ids.includes(orderA));

    r = await put(`/admin/rooms/${xnB}/staff/${ktv1.id}`, T);
    check("Gán lại vào đúng phòng hiện tại -> 200 (không đổi)", r.status === 200 && (await accountRoom(ktv1.id)) === xnB);

    check("KTV gán vào phòng khám -> 400 ROOM_TYPE_MISMATCH", (await put(`/admin/rooms/${kham1}/staff/${ktv2.id}`, T)).data.code === "ROOM_TYPE_MISMATCH");
    check("Lễ tân gán vào phòng XN -> 400 ROOM_TYPE_MISMATCH", (await put(`/admin/rooms/${xnA}/staff/${letan.id}`, T)).data.code === "ROOM_TYPE_MISMATCH");
    r = await put(`/admin/rooms/${kham1}/staff/${letan.id}`, T);
    check("Lễ tân gán vào phòng khám -> 200", r.status === 200);
    check("Bác sĩ -> 400 ROLE_NOT_ASSIGNABLE", (await put(`/admin/rooms/${kham1}/staff/${bacsi.id}`, T)).data.code === "ROLE_NOT_ASSIGNABLE");
    check("Tài khoản bị khóa -> 400 ACCOUNT_INACTIVE", (await put(`/admin/rooms/${xnA}/staff/${ktvLocked.id}`, T)).data.code === "ACCOUNT_INACTIVE");
    check("Tài khoản không tồn tại -> 404", (await put(`/admin/rooms/${xnA}/staff/999999`, T)).status === 404);

    // ---------- Gỡ ----------
    r = await del(`/admin/rooms/${xnA}/staff/${ktv1.id}`, T);
    check("Gỡ KTV1 khỏi phòng không phải của mình -> 409 NOT_IN_ROOM", r.status === 409 && r.data.code === "NOT_IN_ROOM");
    r = await del(`/admin/rooms/${xnB}/staff/${ktv1.id}`, T);
    check("Gỡ KTV1 khỏi XN B -> 200, phong_kham_id = null", r.status === 200 && (await accountRoom(ktv1.id)) === null);
    r = await get("/lab/orders", ktv1.token);
    check("C5: KTV chưa gán phòng -> Lab trả 403 như cũ", r.status === 403);

    // ---------- Delete ----------
    r = await del(`/admin/rooms/${xnA}`, T);
    check("Xóa phòng còn nhân viên/chỉ định -> 409", r.status === 409 && r.data.code === "HAS_REFERENCES");
    r = await post("/admin/rooms", T, { ten_phong: `${P} Trong`, loai_phong: LOAI_XN });
    r = await del(`/admin/rooms/${r.data.data.id}`, T);
    check("Xóa phòng trống -> 200", r.status === 200);
    check("Xóa phòng không tồn tại -> 404", (await del("/admin/rooms/999999", T)).status === 404);
  } catch (e) {
    fail++;
    console.error("Lỗi khi chạy test:", e);
  } finally {
    await cleanup();
    console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail ? 1 : 0);
  }
})();