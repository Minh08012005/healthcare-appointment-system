const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `IS51${sfx}`;
let pass = 0, fail = 0;
let roleBS, ck, pwHash;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const mkUser = async (roleId, tag) => {
  const username = `is51_${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkSchedule = (bsId, roomId) =>
  pool.query(
    `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
     VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',5,0,0,'HoatDong')`,
    [bsId, roomId]
  );

const cleanup = async () => {
  try {
    // Xóa HoSoBenhAn và KetQuaKham trước để không bị lỗi khóa ngoại (Foreign Key)
    await pool.query(
      `DELETE FROM "KetQuaKham" WHERE ho_so_id IN (
         SELECT hs.id FROM "HoSoBenhAn" hs 
         JOIN "HangDoi" h ON h.id = hs.hang_doi_id 
         WHERE h.phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)
       )`, 
      [`${P} %`]
    );
    await pool.query(
      `DELETE FROM "HoSoBenhAn" WHERE hang_doi_id IN (
         SELECT id FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)
       )`, 
      [`${P} %`]
    );
    
    // Sau đó mới xóa các bảng còn lại
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`is51_${sfx}_%`]);
    console.log("\nDọn dẹp dữ liệu test sạch sẽ thành công.");
  } catch (e) {
    console.error("Lỗi dọn dữ liệu:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const roomId = (
      await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} Room`, ck])
    ).rows[0].id;
    const doc = await mkUser(roleBS, "doc");
    const bsId = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [doc.id, `${P} BS Test`, ck]
      )
    ).rows[0].id;
    await mkSchedule(bsId, roomId);

    const bnId = (
      await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 1`])
    ).rows[0].id;
    const hdId = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1, 1, $2, $3, 'ONLINE', 'CHO_KHAM', 0, 0) RETURNING id`,
        [bnId, roomId, bsId]
      )
    ).rows[0].id;

    // --- TEST 1: Gọi bệnh nhân sang DANG_GOI ---
    let r = await api("POST", "/queue/next", {}, doc.token);
    check("Gọi bệnh nhân sang DANG_GOI thành công", r.status === 200 && r.data?.data?.queue?.trang_thai === "DANG_GOI");

    // --- TEST 2: Gọi lại (Recall) khi đang DANG_GOI ---
    r = await api("POST", "/queue/recall", {}, doc.token);
    if (r.status !== 200) {
      console.log("--> CHI TIẾT LỖI RECALL TỪ SERVER:", r.status, r.data);
    }
    check("Gọi lại (Recall) thành công, tăng so_lan_goi lên 2", r.status === 200 && r.data?.data?.queue?.so_lan_goi === 2);

    // --- TEST 3: Bắt đầu khám (Start) từ trạng thái DANG_GOI ---
    r = await api("POST", `/queue/${hdId}/start`, {}, doc.token);
    check("Bắt đầu khám (Start) thành công, chuyển sang DANG_KHAM và tạo hồ sơ bệnh án", 
      r.status === 200 && r.data?.data?.trang_thai === "DANG_KHAM" && !!r.data?.data?.ho_so_id
    );

    // Tạo lượt bệnh nhân thứ 2 để test Skip
    const bnId2 = (
      await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 2`])
    ).rows[0].id;
    const hdId2 = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1, 2, $2, $3, 'OFFLINE', 'DANG_GOI', 1, 0) RETURNING id`,
        [bnId2, roomId, bsId]
      )
    ).rows[0].id;

    // --- TEST 4: Skip lần 1 (BO_LUOT) ---
    r = await api("POST", `/queue/${hdId2}/skip`, {}, doc.token);
    check("Skip lần 1 chuyển trạng thái thành BO_LUOT", r.status === 200 && r.data?.data?.trang_thai === "BO_LUOT" && r.data?.data?.so_lan_bo_luot === 1);

    // --- TEST 5: Skip lần 2 (VANG_MAT) ---
    r = await api("POST", `/queue/${hdId2}/skip`, {}, doc.token);
    check("Skip lần 2 chuyển trạng thái thành VANG_MAT (đóng lượt)", r.status === 200 && r.data?.data?.trang_thai === "VANG_MAT" && r.data?.data?.so_lan_bo_luot === 2);

    // --- TEST 6: Kiểm thử API lấy lại thông tin bệnh nhân đang gọi khi F5 (/queue/current) ---
    r = await api("GET", "/queue/current", null, doc.token);
    check("Lấy thông tin bệnh nhân đang gọi qua GET /queue/current thành công", 
      r.status === 200 && r.data?.success === true
    );
    
  } catch (e) {
    fail++;
    console.error("LỖI CHẠY SCRIPT TEST:", e);
  } finally {
    await cleanup();
    console.log(`\nKẾT QUẢ KIỂM THỬ: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
})();