// Test C4-06: API chỉ định xét nghiệm
//   POST /api/lab-orders        (tạo chỉ định)
//   GET  /api/lab-orders?ho_so_id=  (đọc danh sách chỉ định của hồ sơ)
// Chạy: bật server (npm run dev) rồi `npm run api:test-lab-order`. Script tự tạo và tự dọn dữ liệu test.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const HS_DANG_KHAM = "DANG_KHAM";
const HS_DONE = "HOAN_THANH";
const sfx = Date.now().toString().slice(-6);
const P = `ZZL${sfx}`;
let pass = 0, fail = 0, n = 0, roleBS, roleLT, ck, pwHash;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${ok ? "" : extra}`);
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const create = (body, token) => api("POST", "/lab-orders", body, token);
const list = (hoSoId, token) => api("GET", `/lab-orders${hoSoId === undefined ? "" : `?ho_so_id=${hoSoId}`}`, undefined, token);

const mkUser = async (roleId, tag) => {
  const username = `zzl${sfx}_${tag}`;
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
      [bnId, ++n, roomId, o.hdBs ?? null, (o.hsState || HS_DANG_KHAM) === HS_DANG_KHAM ? "DANG_KHAM" : "DA_XONG"]
    )
  ).rows[0].id;
  const hs = (
    await pool.query(
      `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,$4) RETURNING id`,
      [hd, bnId, o.hsBs ?? null, o.hsState || HS_DANG_KHAM]
    )
  ).rows[0].id;
  return { hs, hd };
};

const countCd = async (hs) =>
  Number((await pool.query(`SELECT COUNT(*) AS c FROM "ChiDinhXetNghiem" WHERE ho_so_id = $1`, [hs])).rows[0].c);

const cleanup = async () => {
  try {
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    const hsOf = `SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`;
    await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (${hsOf}) OR phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $2)`, [`${P} BN %`, `${P} %`]);
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (${hsOf})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [`${P} BN %`, `zzl${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzl${sfx}_%`]);
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
    const mkRoom = async (name) =>
      (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} ${name}`, ck])).rows[0].id;
    const room = await mkRoom("Phòng khám");
    const labRoom = await mkRoom("Phòng XN 1");
    const labRoom2 = await mkRoom("Phòng XN 2");

    const docA = await mkDoctor("A");
    const docB = await mkDoctor("B");
    const docNoBs = await mkDoctor("nobs", false);
    const lt = await mkUser(roleLT, "lt");
    const ptName = `zzl${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    // Hồ sơ A: chủ là docA (qua HoSoBenhAn.bac_si_id). Hồ sơ Off: HoSo.bac_si_id NULL, chủ lấy từ HangDoi.bac_si_id.
    const A = await mkVisit(room, await mkPatient("A"), { hdBs: docA.bsId, hsBs: docA.bsId });
    const Off = await mkVisit(room, await mkPatient("Off"), { hdBs: docA.bsId, hsBs: null });
    const Done = await mkVisit(room, await mkPatient("Done"), { hdBs: docA.bsId, hsBs: docA.bsId, hsState: HS_DONE });
    const Empty = await mkVisit(room, await mkPatient("Empty"), { hdBs: docA.bsId, hsBs: docA.bsId });
    const ok = (over = {}) => ({ ho_so_id: A.hs, phong_kham_id: labRoom, ten_xet_nghiem: "Công thức máu", ghi_chu: "Nhịn ăn sáng", ...over });

    check("Có token của bác sĩ A, B, Lễ tân, bệnh nhân", !!(docA.token && docB.token && lt.token && ptTok));

    // ---- Tạo chỉ định thành công ----
    const before = Date.now();
    const r1 = await create(ok(), docA.token);
    const cd1 = r1.data.data?.chi_dinh || {};
    check("Tạo chỉ định -> 201", r1.status === 201, JSON.stringify(r1.data));
    check("trang_thai = CHO_XU_LY", cd1.trang_thai === "CHO_XU_LY");
    check("Gắn đúng ho_so_id", cd1.ho_so_id === A.hs);
    check("Lưu đúng phòng, tên xét nghiệm, ghi chú",
      cd1.phong_kham_id === labRoom && cd1.phong?.id === labRoom && cd1.phong?.ten_phong === `${P} Phòng XN 1` &&
      cd1.ten_xet_nghiem === "Công thức máu" && cd1.ghi_chu === "Nhịn ăn sáng");
    const t = Date.parse(cd1.thoi_gian_chi_dinh);
    check("thoi_gian_chi_dinh được tạo (gần thời điểm hiện tại)", !Number.isNaN(t) && Math.abs(t - before) < 60000, cd1.thoi_gian_chi_dinh);
    const row = (await pool.query(`SELECT * FROM "ChiDinhXetNghiem" WHERE id = $1`, [cd1.id])).rows[0] || {};
    check("DB: dòng ChiDinhXetNghiem đúng (ho_so_id, phòng, tên, ghi chú, CHO_XU_LY, có thời gian)",
      row.ho_so_id === A.hs && row.phong_kham_id === labRoom && row.ten_xet_nghiem === "Công thức máu" &&
      row.ghi_chu === "Nhịn ăn sáng" && row.trang_thai === "CHO_XU_LY" && !!row.thoi_gian_chi_dinh);

    // ---- Ghi chú tuỳ chọn, chuẩn hoá chuỗi ----
    const r2 = await create(ok({ phong_kham_id: labRoom2, ten_xet_nghiem: "  Đường huyết  ", ghi_chu: undefined }), docA.token);
    check("Không gửi ghi_chu -> 201, ghi_chu = null, tên được cắt khoảng trắng",
      r2.status === 201 && r2.data.data.chi_dinh.ghi_chu === null && r2.data.data.chi_dinh.ten_xet_nghiem === "Đường huyết", JSON.stringify(r2.data));
    const r3 = await create(ok({ ten_xet_nghiem: "Nước tiểu", ghi_chu: "   " }), docA.token);
    check("ghi_chu chỉ có khoảng trắng -> lưu null", r3.status === 201 && r3.data.data.chi_dinh.ghi_chu === null);
    check("Một hồ sơ có nhiều chỉ định (3)", (await countCd(A.hs)) === 3);
    const dup = await create(ok(), docA.token);
    check("Cùng tên xét nghiệm tạo thêm lần nữa vẫn được (không có rule cấm)", dup.status === 201);

    // ---- Hồ sơ không đóng, bệnh nhân vẫn trong lượt khám ----
    const hsAfter = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id = $1`, [A.hs])).rows[0];
    const hdAfter = (await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id = $1`, [A.hd])).rows[0];
    check("Tạo chỉ định không đóng hồ sơ và không đổi trạng thái hàng đợi",
      hsAfter.trang_thai === HS_DANG_KHAM && hdAfter.trang_thai === "DANG_KHAM");

    // ---- Hồ sơ Offline: chủ hồ sơ lấy từ HangDoi.bac_si_id ----
    const rOff = await create(ok({ ho_so_id: Off.hs }), docA.token);
    check("Hồ sơ HoSo.bac_si_id NULL: chủ = HangDoi.bac_si_id -> 201", rOff.status === 201, JSON.stringify(rOff.data));

    // ---- Đọc danh sách ----
    const l1 = await list(A.hs, docA.token);
    const items = l1.data.data?.chi_dinh || [];
    check("GET danh sách -> 200, đủ 4 chỉ định", l1.status === 200 && l1.data.data?.tong === 4 && items.length === 4, JSON.stringify(l1.data));
    check("Đúng ho_so và thứ tự (cũ trước)", l1.data.data?.ho_so?.id === A.hs && l1.data.data.ho_so.trang_thai === HS_DANG_KHAM &&
      items[0]?.id === cd1.id && items[1]?.ten_xet_nghiem === "Đường huyết" && items[2]?.ten_xet_nghiem === "Nước tiểu");
    check("Mỗi chỉ định có tên, phòng, ghi chú, trạng thái, thời gian",
      items.every((x) => x.ten_xet_nghiem && x.phong?.ten_phong && "ghi_chu" in x && x.trang_thai === "CHO_XU_LY" && x.thoi_gian_chi_dinh));
    check("Danh sách chỉ chứa chỉ định của đúng hồ sơ", items.every((x) => x.ho_so_id === A.hs));
    const lEmpty = await list(Empty.hs, docA.token);
    check("Hồ sơ chưa có chỉ định -> 200, danh sách rỗng", lEmpty.status === 200 && lEmpty.data.data?.tong === 0 && lEmpty.data.data.chi_dinh.length === 0, JSON.stringify(lEmpty.data));
    const lDone = await list(Done.hs, docA.token);
    check("Đọc được chỉ định của hồ sơ đã hoàn thành (chỉ đọc) -> 200", lDone.status === 200);

    // ---- Permission ----
    const cntBefore = await countCd(A.hs);
    const rB = await create(ok(), docB.token);
    check("Bác sĩ khác (không phải chủ hồ sơ) -> 403", rB.status === 403, JSON.stringify(rB.data));
    check("Bác sĩ khác xem danh sách -> 403", (await list(A.hs, docB.token)).status === 403);
    check("Bác sĩ chưa gắn hồ sơ BacSi -> 403", (await create(ok(), docNoBs.token)).status === 403);
    check("Lễ tân -> 403", (await create(ok(), lt.token)).status === 403);
    check("Bệnh nhân -> 403", (await create(ok(), ptTok)).status === 403);
    check("Lễ tân / bệnh nhân xem danh sách -> 403", (await list(A.hs, lt.token)).status === 403 && (await list(A.hs, ptTok)).status === 403);
    check("Không token -> 401", (await create(ok(), null)).status === 401 && (await list(A.hs, null)).status === 401);
    check("Các request bị từ chối không tạo thêm chỉ định", (await countCd(A.hs)) === cntBefore);

    // ---- Trạng thái hồ sơ ----
    const rDone = await create(ok({ ho_so_id: Done.hs }), docA.token);
    check("Hồ sơ không DANG_KHAM -> 409", rDone.status === 409, JSON.stringify(rDone.data));
    check("Hồ sơ không DANG_KHAM: không tạo dòng nào", (await countCd(Done.hs)) === 0);
    check("Hồ sơ không tồn tại -> 404", (await create(ok({ ho_so_id: 2147483000 }), docA.token)).status === 404);
    check("GET hồ sơ không tồn tại -> 404", (await list(2147483000, docA.token)).status === 404);

    // ---- Dữ liệu không hợp lệ ----
    const bad = async (label, body, status = 400) => {
      const before2 = await countCd(A.hs);
      const r = await create(body, docA.token);
      check(label, r.status === status && (await countCd(A.hs)) === before2, `(HTTP ${r.status}: ${r.data.message})`);
    };
    await bad("Thiếu ten_xet_nghiem -> 400", ok({ ten_xet_nghiem: undefined }));
    await bad("ten_xet_nghiem rỗng -> 400", ok({ ten_xet_nghiem: "" }));
    await bad("ten_xet_nghiem toàn khoảng trắng -> 400", ok({ ten_xet_nghiem: "    " }));
    await bad("ten_xet_nghiem không phải chuỗi -> 400", ok({ ten_xet_nghiem: 123 }));
    await bad("ten_xet_nghiem > 255 ký tự -> 400", ok({ ten_xet_nghiem: "x".repeat(256) }));
    await bad("ghi_chu không phải chuỗi -> 400", ok({ ghi_chu: { a: 1 } }));
    await bad("ghi_chu quá dài -> 400", ok({ ghi_chu: "x".repeat(10001) }));
    await bad("Thiếu ho_so_id -> 400", ok({ ho_so_id: undefined }));
    await bad("ho_so_id sai định dạng -> 400", ok({ ho_so_id: "abc" }));
    await bad("Thiếu phong_kham_id -> 400", ok({ phong_kham_id: undefined }));
    await bad("phong_kham_id sai định dạng -> 400", ok({ phong_kham_id: -5 }));
    await bad("Phòng không tồn tại -> 400", ok({ phong_kham_id: 2147483000 }));
    const rArr = await api("POST", "/lab-orders", [1, 2], docA.token);
    check("Body không phải object -> 400", rArr.status === 400);
    check("ten_xet_nghiem dài đúng 255 ký tự -> 201", (await create(ok({ ten_xet_nghiem: "y".repeat(255) }), docA.token)).status === 201);
    check("GET thiếu ho_so_id -> 400", (await list(undefined, docA.token)).status === 400);
    check("GET ho_so_id sai -> 400", (await list("abc", docA.token)).status === 400);

    // ---- Đồng thời ----
    const cntPar = await countCd(Empty.hs);
    const par = await Promise.all([1, 2, 3, 4, 5].map((i) => create(ok({ ho_so_id: Empty.hs, ten_xet_nghiem: `XN song song ${i}` }), docA.token)));
    check("5 request đồng thời -> 5 chỉ định, không mất, không trùng id",
      par.every((r) => r.status === 201) && (await countCd(Empty.hs)) === cntPar + 5 && new Set(par.map((r) => r.data.data.chi_dinh.id)).size === 5);

    // ---- Không ảnh hưởng C4-02 / C4-04 ----
    const ex = await api("GET", `/examinations/${A.hs}`, undefined, docA.token);
    check("API đọc hồ sơ C4-02 vẫn hoạt động", ex.status === 200 && ex.data.data?.ho_so?.id === A.hs);
    const sv = await api("PUT", `/examinations/${A.hs}/result`, { chan_doan: "Test" }, docA.token);
    check("API lưu kết quả khám C4-04 vẫn hoạt động", sv.status === 201 || sv.status === 200, JSON.stringify(sv.data));

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
