// Test C4-08: Đóng hồ sơ, in kết quả & Integration Test
// Endpoint: POST /api/examinations/:hoSoId/close
// Chạy: bật server (npm run dev) rồi `npm run api:test-close-exam`. Script tự tạo và dọn dẹp fixture an toàn.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const HS_DANG_KHAM = "DANG_KHAM";
const HS_DA_XONG = "DA_XONG";
const CD_CHO_XU_LY = "CHO_XU_LY";
const CD_DA_XONG = "DA_XONG";

const sfx = Date.now().toString().slice(-6);
const P = `ZZC${sfx}`;
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

const closeExam = (id, token) => api("POST", `/examinations/${id}/close`, {}, token);
const putResult = (id, body, token) => api("PUT", `/examinations/${id}/result`, body, token);
const createLabOrder = (body, token) => api("POST", "/lab-orders", body, token);
const startExam = (queueId, token) => api("POST", `/queue/${queueId}/start`, {}, token);
const callNext = (token) => api("POST", "/queue/next", {}, token);
const getCalling = (token) => api("GET", "/queue/current", undefined, token);

const mkUser = async (roleId, tag) => {
  const username = `zzc${sfx}_${tag}`;
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
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'BS CKI') RETURNING id`,
        [u.id, `${P} BS ${tag}`, ck]
      )
    ).rows[0].id;
  }
  return { bsId, token: u.token };
};

const mkPatient = async (tag) =>
  (
    await pool.query(
      `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, ma_bhyt, dia_chi) VALUES ($1,'1992-06-15','Nam',$2,'Ha Noi') RETURNING id`,
      [`${P} BN ${tag}`, `${P}${++n}`]
    )
  ).rows[0].id;

// Tạo lượt khám trong hàng đợi và hồ sơ bệnh án
const mkVisit = async (roomId, bnId, o = {}) => {
  const qState = o.qState || (o.hsState === HS_DA_XONG ? "DA_XONG" : "DANG_KHAM");
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
       VALUES ($1,$2,$3,$4,'ONLINE',$5,1,0,NOW()) RETURNING id`,
      [bnId, ++n, roomId, o.hdBs ?? null, qState]
    )
  ).rows[0].id;

  let hsId = null;
  if (o.withHoSo !== false) {
    hsId = (
      await pool.query(
        `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
         VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,$4) RETURNING id`,
        [hd, bnId, o.hsBs ?? null, o.hsState || HS_DANG_KHAM]
      )
    ).rows[0].id;
  }

  return { hd, hs: hsId };
};

const cleanup = async () => {
  try {
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    await pool.query(
      `DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id IN (
        SELECT id FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (
          SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})
        )
      )`,
      [`${P} BN %`]
    );
    await pool.query(
      `DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id IN (
        SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})
      )`,
      [`${P} BN %`]
    );
    await pool.query(
      `DELETE FROM "KetQuaKham" WHERE ho_so_id IN (
        SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})
      )`,
      [`${P} BN %`]
    );
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(
      `DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`,
      [`${P} %`]
    );
    await pool.query(
      `DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`,
      [`${P} BS %`]
    );
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [`${P} BN %`, `zzc${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzc${sfx}_%`]);
    console.log("\nĐã dọn dẹp dữ liệu test an toàn.");
  } catch (e) {
    console.error("LỖI dọn dẹp dữ liệu:", e.message);
  }
};

(async () => {
  try {
    pwHash = await bcrypt.hash("123456", 10);
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    roleLT = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`)).rows[0].id;
    ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const room = (
      await pool.query(
        `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Kham') RETURNING id`,
        [`${P} R1`, ck]
      )
    ).rows[0].id;

    const labRoom = (
      await pool.query(
        `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Phòng xét nghiệm') RETURNING id`,
        [`${P} Lab`, ck]
      )
    ).rows[0].id;

    const docA = await mkDoctor("A");
    const docB = await mkDoctor("B");
    const docNoBs = await mkDoctor("nobs", false);
    const lt = await mkUser(roleLT, "lt");

    // Tạo lịch trực hôm nay cho docA để test queue regression
    await pool.query(
      `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, trang_thai)
       VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, '06:00:00', '18:00:00', 10, 'DangKham')`,
      [docA.bsId, room]
    );

    const ptName = `zzc${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    console.log("=== 1. TEST AUTH & PERMISSIONS ===");
    const vA = await mkVisit(room, await mkPatient("A"), { hdBs: docA.bsId, hsBs: docA.bsId });
    const vB = await mkVisit(room, await mkPatient("B"), { hdBs: docB.bsId, hsBs: docB.bsId });

    let r = await closeExam(vA.hs);
    check("Không có token -> 401", r.status === 401, `(nhận ${r.status})`);

    r = await closeExam(vA.hs, ptTok);
    check("Role Bệnh nhân -> 403", r.status === 403, `(nhận ${r.status})`);

    r = await closeExam(vA.hs, lt.token);
    check("Role Lễ tân -> 403", r.status === 403, `(nhận ${r.status})`);

    r = await closeExam(vA.hs, docNoBs.token);
    check("Tài khoản bác sĩ chưa gắn hồ sơ BacSi -> 403", r.status === 403, `(nhận ${r.status})`);

    r = await closeExam(vB.hs, docA.token);
    check("Bác sĩ A đóng hồ sơ của bác sĩ B -> 403", r.status === 403, `(nhận ${r.status})`);

    console.log("\n=== 2. TEST VALIDATION & PRECONDITIONS ===");
    for (const bad of ["abc", "0", "-1", "1.5", "99999999999"]) {
      r = await closeExam(bad, docA.token);
      check(`ho_so_id="${bad}" -> 400`, r.status === 400, `(nhận ${r.status})`);
    }

    r = await closeExam(999999999, docA.token);
    check("ho_so_id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);

    const vDone = await mkVisit(room, await mkPatient("Done"), {
      hdBs: docA.bsId,
      hsBs: docA.bsId,
      hsState: HS_DA_XONG,
      qState: "DA_XONG",
    });
    r = await closeExam(vDone.hs, docA.token);
    check("Hồ sơ đã DA_XONG đóng lại -> 409", r.status === 409, `(nhận ${r.status})`);

    console.log("\n=== 3. TEST FLOW CÓ XÉT NGHIỆM (BLOCK KHI CHƯA XONG) ===");
    const vLab = await mkVisit(room, await mkPatient("Lab"), { hdBs: docA.bsId, hsBs: docA.bsId });

    // Tạo chỉ định xét nghiệm ban đầu ở trạng thái CHO_XU_LY
    const labRes = await createLabOrder(
      { ho_so_id: vLab.hs, phong_kham_id: labRoom, ten_xet_nghiem: "Tổng phân tích tế bào máu" },
      docA.token
    );
    check("Tạo chỉ định xét nghiệm -> 201", labRes.status === 201, JSON.stringify(labRes.data));
    const labOrderId = labRes.data?.data?.chi_dinh?.id;

    // Đóng khi chỉ định còn ở CHO_XU_LY -> Phải bị chặn 409
    r = await closeExam(vLab.hs, docA.token);
    check(
      "Đóng hồ sơ khi có xét nghiệm CHO_XU_LY -> 409 LAB_ORDER_PENDING",
      r.status === 409 && r.data?.code === "LAB_ORDER_PENDING",
      JSON.stringify(r.data)
    );

    // Kiểm tra DB: Hồ sơ và Hàng đợi vẫn phải là DANG_KHAM
    const hsLabDb = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id = $1`, [vLab.hs])).rows[0];
    const hdLabDb = (await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id = $1`, [vLab.hd])).rows[0];
    check("DB: HoSoBenhAn vẫn là DANG_KHAM", hsLabDb.trang_thai === HS_DANG_KHAM);
    check("DB: HangDoi vẫn là DANG_KHAM", hdLabDb.trang_thai === "DANG_KHAM");

    // Giả lập phòng xét nghiệm hoàn tất (chuyển sang DA_XONG)
    await pool.query(`UPDATE "ChiDinhXetNghiem" SET trang_thai = $1 WHERE id = $2`, [CD_DA_XONG, labOrderId]);

    // Đóng lại sau khi xét nghiệm đã hoàn thành -> Thành công 200
    r = await closeExam(vLab.hs, docA.token);
    check("Đóng hồ sơ sau khi xét nghiệm hoàn tất -> 200", r.status === 200, JSON.stringify(r.data));
    check("Response data chứa trang_thai = DA_XONG", r.data?.data?.trang_thai === HS_DA_XONG);

    const hsLabDone = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id = $1`, [vLab.hs])).rows[0];
    const hdLabDone = (await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id = $1`, [vLab.hd])).rows[0];
    check("DB: HoSoBenhAn đã chuyển DA_XONG", hsLabDone.trang_thai === HS_DA_XONG);
    check("DB: HangDoi đã chuyển DA_XONG", hdLabDone.trang_thai === "DA_XONG");

    console.log("\n=== 4. TEST FLOW KHÔNG XÉT NGHIỆM: START -> SAVE -> CLOSE -> READ-ONLY ===");
    // Tạo 1 bệnh nhân chờ vào khám ở DANG_GOI
    const bnFlow = await mkPatient("Flow");
    const vFlow = await mkVisit(room, bnFlow, { hdBs: docA.bsId, qState: "DANG_GOI", withHoSo: false });

    // Bác sĩ bắt đầu khám (Start Examination)
    const startRes = await startExam(vFlow.hd, docA.token);
    check("Start Examination -> 200", startRes.status === 200, JSON.stringify(startRes.data));
    const flowHsId = startRes.data?.data?.ho_so_id;
    check("Đã tạo hoặc lấy ho_so_id", Boolean(flowHsId));

    // Bác sĩ lưu kết quả khám
    const saveRes = await putResult(
      flowHsId,
      {
        trieu_chung_ghi_nhan: "Đau họng, sốt 38 độ",
        chan_doan: "Viêm họng cấp",
        loi_dan: "Súc họng nước muối, uống nhiều nước ấm",
        don_thuoc: "Amoxicillin 500mg x 14 viên",
      },
      docA.token
    );
    check("Lưu kết quả khám -> 201/200", saveRes.status === 201 || saveRes.status === 200);

    // Bác sĩ đóng hồ sơ khám
    const closeRes = await closeExam(flowHsId, docA.token);
    check("Đóng hồ sơ thành công -> 200", closeRes.status === 200, JSON.stringify(closeRes.data));
    check("Response trả về đúng ho_so_id và trang_thai DA_XONG",
      closeRes.data?.data?.ho_so_id === flowHsId && closeRes.data?.data?.trang_thai === HS_DA_XONG
    );

    // Xác minh trong DB cả hai bảng đều DA_XONG
    const dbHs = (await pool.query(`SELECT trang_thai FROM "HoSoBenhAn" WHERE id = $1`, [flowHsId])).rows[0];
    const dbHd = (await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id = $1`, [vFlow.hd])).rows[0];
    check("DB Verify: HoSoBenhAn.trang_thai = DA_XONG", dbHs.trang_thai === HS_DA_XONG);
    check("DB Verify: HangDoi.trang_thai = DA_XONG", dbHd.trang_thai === "DA_XONG");

    // Kiểm tra tính Read-only: Sau khi đóng không thể sửa kết quả
    const putAfterClose = await putResult(flowHsId, { chan_doan: "Sửa chẩn đoán sau đóng" }, docA.token);
    check("PUT kết quả khám sau khi đóng -> 409", putAfterClose.status === 409, `(nhận ${putAfterClose.status})`);

    // Kiểm tra tính Read-only: Sau khi đóng không thể tạo thêm chỉ định xét nghiệm
    const labAfterClose = await createLabOrder(
      { ho_so_id: flowHsId, phong_kham_id: labRoom, ten_xet_nghiem: "Test sau đóng" },
      docA.token
    );
    check("POST chỉ định xét nghiệm sau khi đóng -> 409", labAfterClose.status === 409, `(nhận ${labAfterClose.status})`);

    console.log("\n=== 5. TEST QUEUE REGRESSION: GIẢI PHÓNG LƯỢT KHÁM VÀ GỌI BỆNH NHÂN TIẾP ===");
    // Sau khi đóng hồ sơ, bác sĩ không bị kẹt lượt đang gọi / đang khám
    const curRes = await getCalling(docA.token);
    check(
      "GET /queue/current không còn giữ bệnh nhân đang gọi",
      curRes.status === 200 && curRes.data?.data?.has_calling === false,
      JSON.stringify(curRes.data)
    );

    // Thêm một bệnh nhân mới chờ khám (CHO_KHAM)
    const bnNext = await mkPatient("Next");
    await mkVisit(room, bnNext, { hdBs: docA.bsId, qState: "CHO_KHAM", withHoSo: false });

    // Bác sĩ có thể gọi bệnh nhân tiếp theo bình thường
    const nextRes = await callNext(docA.token);
    check(
      "Bác sĩ gọi bệnh nhân tiếp theo (POST /queue/next) thành công",
      nextRes.status === 200 && nextRes.data?.data?.called === true,
      JSON.stringify(nextRes.data)
    );

  } catch (err) {
    console.error("LỖI NGOẠI LỆ TRONG TEST:", err);
    fail++;
  } finally {
    await cleanup();
    console.log(`\n========================================`);
    console.log(`KẾT QUẢ TEST C4-08: PASS: ${pass} | FAIL: ${fail}`);
    console.log(`========================================\n`);
    await pool.end();
    process.exit(fail === 0 ? 0 : 1);
  }
})();
