const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong"; // phải giống auth.controller
const HS_STATE = "DANG_KHAM"; // trạng thái HoSoBenhAn đang khám (theo C4-06)
const sfx = Date.now().toString().slice(-6);
const P = `ZZL${sfx}`;
let pass = 0, fail = 0, n = 0, pwHash, roleXN, roleBS;

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
const get = (p, t) => api("GET", p, null, t);
const post = (p, t, body) => api("POST", p, body || null, t);

const mkRoom = async (name) =>
  (await pool.query(`INSERT INTO "PhongKham" (ten_phong, loai_phong) VALUES ($1,'Xet nghiem') RETURNING id`, [`${P} ${name}`])).rows[0].id;

const mkUser = async (roleId, tag, roomId = null) => {
  const username = `zzl${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai, phong_kham_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE, roomId]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkOrder = async (hsId, roomId, state, minutesAgo, staffId = null) => {
  const idx = ++n;
  const r = await pool.query(
    `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, trang_thai, ten_xet_nghiem, ghi_chu, thoi_gian_chi_dinh, nhan_vien_xu_ly_id, thoi_gian_bat_dau)
     VALUES ($1,$2,$3,$4,$5, NOW() - ($6::int * interval '1 minute'), $7::int,
             CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() - interval '2 minutes' END)
     RETURNING id`,
    [hsId, roomId, state, `${P} XN ${idx}`, `Ghi chu ${idx}`, minutesAgo, staffId]
  );
  return { id: r.rows[0].id, ten: `${P} XN ${idx}`, ghiChu: `Ghi chu ${idx}` };
};

const dbOrder = async (id) =>
  (
    await pool.query(
      `SELECT trang_thai, nhan_vien_xu_ly_id, thoi_gian_bat_dau, ho_so_id, phong_kham_id,
              (thoi_gian_bat_dau > NOW() - interval '30 seconds') AS vua_bat_dau
       FROM "ChiDinhXetNghiem" WHERE id = $1`,
      [id]
    )
  ).rows[0];

const ids = (r) => (r.data?.data?.items || []).map((x) => x.chi_dinh_id);

const cleanup = async () => {
  try {
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`;
    const hsIds = `SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`;
    const args = [`${P} BN %`, `zzl${sfx}_%`];
    await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (SELECT id FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hsIds}))`, args);
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hsIds})`, args);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, args);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`, args);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzl${sfx}_%`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    const l = (
      await pool.query(
        `SELECT (SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1) AS tk,
                (SELECT COUNT(*) FROM "PhongKham" WHERE ten_phong LIKE $2) AS pk,
                (SELECT COUNT(*) FROM "BenhNhan" WHERE ho_ten LIKE $3) AS bn`,
        [`zzl${sfx}_%`, `${P} %`, `${P} BN %`]
      )
    ).rows[0];
    console.log(`\nDọn dữ liệu xong. Còn sót: TaiKhoan=${l.tk}, PhongKham=${l.pk}, BenhNhan=${l.bn} (phải = 0)`);
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleXN = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Xét nghiệm'`)).rows[0].id;
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;

    const r1 = await mkRoom("XN1");
    const r2 = await mkRoom("XN2");
    const r3 = await mkRoom("XN3 trong");
    const s1 = await mkUser(roleXN, "s1", r1);
    const s2 = await mkUser(roleXN, "s2", r2);
    const s3 = await mkUser(roleXN, "s3", r3);
    const sNo = await mkUser(roleXN, "s0", null);
    const docU = await mkUser(roleBS, "doc");
    const bsId = (
      await pool.query(`INSERT INTO "BacSi" (tai_khoan_id, ho_ten, cap_bac) VALUES ($1,$2,'Test') RETURNING id`, [docU.id, `${P} BS A`])
    ).rows[0].id;
    const ptName = `zzl${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    const bn = (
      await pool.query(`INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh) VALUES ($1,'1990-05-20','Nam') RETURNING id`, [`${P} BN 1`])
    ).rows[0].id;
    const hs = (
      await pool.query(`INSERT INTO "HoSoBenhAn" (benh_nhan_id, bac_si_id, trang_thai) VALUES ($1,$2,$3) RETURNING id`, [bn, bsId, HS_STATE])
    ).rows[0].id;

    const o1 = await mkOrder(hs, r1, "CHO_XU_LY", 30);
    const o2 = await mkOrder(hs, r1, "CHO_XU_LY", 20);
    const o3 = await mkOrder(hs, r1, "DANG_XU_LY", 10, s1.id);
    const o4 = await mkOrder(hs, r1, "DA_XONG", 5, s1.id);
    const p1 = await mkOrder(hs, r2, "CHO_XU_LY", 15);

    // ---- Xác thực và vai trò ----
    for (const [m, path, tag] of [
      ["GET", "/lab/orders", "GET danh sách"],
      ["GET", `/lab/orders/${o1.id}`, "GET chi tiết"],
      ["POST", `/lab/orders/${o1.id}/start`, "POST start"],
    ]) {
      let r = await api(m, path);
      check(`${tag} - không đăng nhập -> 401`, r.status === 401, `(nhận ${r.status})`);
      r = await api(m, path, null, ptTok);
      check(`${tag} - bệnh nhân -> 403`, r.status === 403, `(nhận ${r.status})`);
      r = await api(m, path, null, docU.token);
      check(`${tag} - bác sĩ -> 403`, r.status === 403, `(nhận ${r.status})`);
      r = await api(m, path, null, sNo.token);
      check(`${tag} - nhân viên chưa gán phòng -> 403`, r.status === 403, `(nhận ${r.status})`);
    }

    // ---- Danh sách + lọc ----
    let r = await get("/lab/orders", s1.token);
    check("Nhân viên XN lấy danh sách phòng mình -> 200, đúng thứ tự thời gian chỉ định", r.status === 200 && JSON.stringify(ids(r)) === JSON.stringify([o1.id, o2.id, o3.id, o4.id]), JSON.stringify(ids(r)));
    check("Không thấy chỉ định của phòng khác", !ids(r).includes(p1.id));
    const it = r.data?.data?.items?.[0];
    check("Item đủ chi_dinh_id, ho_so_id, bệnh nhân, tên XN, ghi chú, phòng, thời gian, trạng thái", it?.chi_dinh_id === o1.id && it.ho_so_id === hs && it.patient?.ho_ten === `${P} BN 1` && it.ten_xet_nghiem === o1.ten && it.ghi_chu === o1.ghiChu && it.room?.id === r1 && !!it.room.ten_phong && !!it.thoi_gian_chi_dinh && it.trang_thai === "CHO_XU_LY", JSON.stringify(it));
    check("Có thông tin phòng ở cấp danh sách", r.data?.data?.room?.id === r1);

    r = await get("/lab/orders?trang_thai=CHO_XU_LY", s1.token);
    check("Lọc CHO_XU_LY đúng", JSON.stringify(ids(r)) === JSON.stringify([o1.id, o2.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders?trang_thai=DANG_XU_LY", s1.token);
    check("Lọc DANG_XU_LY đúng", JSON.stringify(ids(r)) === JSON.stringify([o3.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders?trang_thai=DA_XONG", s1.token);
    check("Lọc DA_XONG đúng", JSON.stringify(ids(r)) === JSON.stringify([o4.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders?trang_thai=CHO_XU_LY,DANG_XU_LY", s1.token);
    check("Lọc nhiều trạng thái", JSON.stringify(ids(r)) === JSON.stringify([o1.id, o2.id, o3.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders?trang_thai=ABC", s1.token);
    check("trang_thai không hợp lệ -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get("/lab/orders?limit=2", s1.token);
    check("limit=2 -> chỉ 2 chỉ định đầu", JSON.stringify(ids(r)) === JSON.stringify([o1.id, o2.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders?limit=0", s1.token);
    check("limit=0 -> 400", r.status === 400, `(nhận ${r.status})`);
    r = await get("/lab/orders", s2.token);
    check("Phòng 2 chỉ thấy chỉ định phòng 2", JSON.stringify(ids(r)) === JSON.stringify([p1.id]), JSON.stringify(ids(r)));
    r = await get("/lab/orders", s3.token);
    check("Phòng không có chỉ định -> 200, danh sách rỗng", r.status === 200 && Array.isArray(r.data?.data?.items) && r.data.data.items.length === 0, `(nhận ${r.status})`);

    // ---- Chi tiết ----
    r = await get(`/lab/orders/${o1.id}`, s1.token);
    const d = r.data?.data;
    check("Mở đúng chi tiết chỉ định -> 200", r.status === 200 && d?.chi_dinh_id === o1.id, `(nhận ${r.status})`);
    check("Chi tiết có bệnh nhân, hồ sơ, tên XN, ghi chú, phòng, trạng thái, thời gian", d?.patient?.ho_ten === `${P} BN 1` && d.patient.ngay_sinh === "1990-05-20" && d.patient.gioi_tinh === "Nam" && d.ho_so?.id === hs && d.ten_xet_nghiem === o1.ten && d.ghi_chu === o1.ghiChu && d.room?.id === r1 && d.trang_thai === "CHO_XU_LY" && !!d.thoi_gian_chi_dinh);
    check("Chi tiết có bác sĩ chỉ định", d?.doctor?.id === bsId);
    check("Chưa xử lý -> xu_ly.nhan_vien = null", d?.xu_ly?.nhan_vien === null && d.xu_ly.thoi_gian_bat_dau === null);
    let db = await dbOrder(o1.id);
    check("Chỉ xem chi tiết không đổi trạng thái", db.trang_thai === "CHO_XU_LY" && db.nhan_vien_xu_ly_id === null && db.thoi_gian_bat_dau === null);
    r = await get(`/lab/orders/${o3.id}`, s1.token);
    check("Đã bắt đầu xử lý -> chi tiết có nhân viên và thời gian bắt đầu", r.data?.data?.xu_ly?.nhan_vien?.id === s1.id && !!r.data.data.xu_ly.thoi_gian_bat_dau);
    r = await get(`/lab/orders/${p1.id}`, s1.token);
    check("Mở chỉ định phòng khác -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get("/lab/orders/999999999", s1.token);
    check("Chỉ định không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get("/lab/orders/abc", s1.token);
    check("id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Bắt đầu xử lý ----
    const before = await dbOrder(o1.id);
    r = await post(`/lab/orders/${o1.id}/start`, s2.token);
    check("Nhân viên phòng khác start -> 403", r.status === 403, `(nhận ${r.status})`);
    db = await dbOrder(o1.id);
    check("  -> dữ liệu không đổi", db.trang_thai === "CHO_XU_LY" && db.nhan_vien_xu_ly_id === null);

    r = await post(`/lab/orders/${o1.id}/start`, s1.token);
    check("CHO_XU_LY -> DANG_XU_LY thành công -> 200", r.status === 200 && r.data?.data?.trang_thai === "DANG_XU_LY", `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    db = await dbOrder(o1.id);
    check("DB: trạng thái DANG_XU_LY", db.trang_thai === "DANG_XU_LY");
    check("DB: ghi đúng nhan_vien_xu_ly_id", db.nhan_vien_xu_ly_id === s1.id);
    check("DB: ghi thoi_gian_bat_dau", db.vua_bat_dau === true);
    check("DB: giữ nguyên ho_so_id và phong_kham_id", db.ho_so_id === before.ho_so_id && db.phong_kham_id === before.phong_kham_id);
    check("Response trả nhân viên xử lý đúng", r.data?.data?.xu_ly?.nhan_vien?.id === s1.id);

    const t0 = db.thoi_gian_bat_dau;
    r = await post(`/lab/orders/${o1.id}/start`, s1.token);
    check("Start lại DANG_XU_LY -> 409 INVALID_STATE", r.status === 409 && r.data.code === "INVALID_STATE", `(nhận ${r.status})`);
    db = await dbOrder(o1.id);
    check("  -> thoi_gian_bat_dau không bị ghi đè", String(db.thoi_gian_bat_dau) === String(t0));
    r = await post(`/lab/orders/${o3.id}/start`, s1.token);
    check("Start chỉ định đã DANG_XU_LY (o3) -> 409", r.status === 409, `(nhận ${r.status})`);
    const b4 = await dbOrder(o4.id);
    r = await post(`/lab/orders/${o4.id}/start`, s1.token);
    check("Start chỉ định DA_XONG -> 409", r.status === 409, `(nhận ${r.status})`);
    db = await dbOrder(o4.id);
    check("  -> DA_XONG không bị đổi", db.trang_thai === "DA_XONG" && String(db.thoi_gian_bat_dau) === String(b4.thoi_gian_bat_dau));
    r = await post("/lab/orders/999999999/start", s1.token);
    check("Start chỉ định không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await post("/lab/orders/abc/start", s1.token);
    check("Start id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    r = await post(`/lab/orders/${o2.id}/start`, s1.token, { phong_kham_id: r2, nhan_vien_xu_ly_id: s2.id });
    db = await dbOrder(o2.id);
    check("Client gửi phong_kham_id/nhan_vien_xu_ly_id bị bỏ qua", r.status === 200 && db.nhan_vien_xu_ly_id === s1.id && db.phong_kham_id === r1, `(nhận ${r.status})`);

    // ---- Đồng thời ----
    const o5 = await mkOrder(hs, r1, "CHO_XU_LY", 1);
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => post(`/lab/orders/${o5.id}/start`, s1.token)));
    const ok = rs.filter((x) => x.status === 200).length;
    const dup = rs.filter((x) => x.status === 409).length;
    check("Start đồng thời: đúng 1 thành công, 4 bị 409", ok === 1 && dup === 4, `(200=${ok}, 409=${dup})`);
    db = await dbOrder(o5.id);
    check("Đồng thời: DANG_XU_LY, ghi đúng nhân viên", db.trang_thai === "DANG_XU_LY" && db.nhan_vien_xu_ly_id === s1.id);

    // ---- Tích hợp C4-06 -> C5-02: bác sĩ tạo chỉ định, phòng XN thấy và bắt đầu xử lý ----
    r = await post("/lab-orders", docU.token, { ho_so_id: hs, phong_kham_id: r1, ten_xet_nghiem: `${P} XN tu C4-06`, ghi_chu: "tao qua API C4-06" });
    check("C4-06: bác sĩ tạo chỉ định -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`);
    const newId = r.data?.data?.chi_dinh?.id;
    if (newId) {
      r = await get("/lab/orders?trang_thai=CHO_XU_LY", s1.token);
      const found = (r.data?.data?.items || []).find((x) => x.chi_dinh_id === newId);
      check("Integration: chỉ định mới từ C4-06 xuất hiện ở danh sách phòng XN (CHO_XU_LY)", !!found && found.ten_xet_nghiem === `${P} XN tu C4-06` && found.ghi_chu === "tao qua API C4-06", JSON.stringify(found));
      r = await post(`/lab/orders/${newId}/start`, s1.token);
      check("Integration: phòng XN bắt đầu xử lý chỉ định vừa tạo -> 200", r.status === 200 && r.data?.data?.trang_thai === "DANG_XU_LY", `(nhận ${r.status})`);
      r = await get(`/lab-orders?ho_so_id=${hs}`, docU.token);
      const mine = (r.data?.data?.chi_dinh || []).find((x) => x.id === newId);
      check("Integration: C4-06 liệt kê chỉ định thấy trạng thái DANG_XU_LY", r.status === 200 && mine?.trang_thai === "DANG_XU_LY", `(nhận ${r.status})`);
    }

    // ---- Regression ----
    r = await get("/health");
    check("Regression /health -> 200", r.status === 200);
    r = await get("/auth/me", s1.token);
    check("Regression /auth/me -> 200", r.status === 200);
    r = await get(`/examinations/${hs}`, docU.token);
    check("Regression C4-02: bác sĩ vẫn đọc được hồ sơ khám -> 200", r.status === 200, `(nhận ${r.status})`);
    const kt = await api("POST", "/auth/login", { username: "ktv_huyethoc", password: "123456" });
    r = await get("/lab/orders", kt.data?.data?.token);
    check("Tài khoản seed C5-01 ktv_huyethoc xem được danh sách -> 200", r.status === 200 && Array.isArray(r.data?.data?.items), `(nhận ${r.status})`);
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