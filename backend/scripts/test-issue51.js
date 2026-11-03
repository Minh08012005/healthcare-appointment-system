const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { getQueueConfig, xuLyTuDongGoiLai } = require("../src/controllers/callNext.controller");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `IS51${sfx}`;
let pass = 0, fail = 0;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " -> " + extra : ""}`);
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

const cleanup = async () => {
  try {
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
    await pool.query(
      `DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`,
      [`${P} %`]
    );
    await pool.query(
      `DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`,
      [`${P} BS%`]
    );
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS%`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(`DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1`, [`${P} BN%`]);
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`is51_${sfx}_%`]);
    console.log("\nDọn dẹp dữ liệu test sạch sẽ thành công.");
  } catch (e) {
    console.error("Lỗi dọn dữ liệu:", e.message);
  }
};

(async () => {
  try {
    const validConfig = {
      ti_le_online: 1,
      ti_le_offline: 1,
      so_lan_goi_toi_da: 3,
      khoang_cach_goi_phut: 1,
      chu_ky_quet_phut: 1,
    };
    const configDb = (row) => ({
      query: async () => ({ rows: row ? [row] : [] }),
    });
    const expectInvalidConfig = async (label, row, expectedField) => {
      let error;
      try {
        await getQueueConfig(configDb(row), { requireRecallConfig: true });
      } catch (err) {
        error = err;
      }
      check(label, Boolean(error) && (!expectedField || error.message.includes(expectedField)), error?.message);
    };

    await expectInvalidConfig("Cấu hình C3-09 thiếu dòng bị từ chối", null, "no row");
    for (const [field, invalidValue] of [
      ["so_lan_goi_toi_da", null],
      ["so_lan_goi_toi_da", 0],
      ["so_lan_goi_toi_da", -1],
      ["so_lan_goi_toi_da", "3"],
      ["khoang_cach_goi_phut", null],
      ["khoang_cach_goi_phut", 0],
      ["khoang_cach_goi_phut", -1],
      ["khoang_cach_goi_phut", "1"],
    ]) {
      await expectInvalidConfig(`Từ chối ${field}=${String(invalidValue)}`, {
        ...validConfig,
        [field]: invalidValue,
      }, field);
    }

    const pwHash = await bcrypt.hash("123456", 10);
    const rolesRes = await pool.query(`SELECT id, ten_vai_tro FROM "VaiTro"`);
    const roleMap = Object.fromEntries(rolesRes.rows.map((r) => [r.ten_vai_tro, r.id]));
    const roleBS = roleMap["Bác sĩ"];
    const roleLT = roleMap["Lễ tân"];
    const ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const cfgRow = (await pool.query(`SELECT * FROM "CauHinhHeThong" ORDER BY id LIMIT 1`)).rows[0];
    if (
      !cfgRow ||
      !Number.isInteger(cfgRow.so_lan_goi_toi_da) || cfgRow.so_lan_goi_toi_da <= 0 ||
      !Number.isInteger(cfgRow.khoang_cach_goi_phut) || cfgRow.khoang_cach_goi_phut <= 0
    ) {
      throw new Error("Test C3-09 requires valid so_lan_goi_toi_da and khoang_cach_goi_phut config");
    }
    const maxCalls = cfgRow.so_lan_goi_toi_da;
    const intervalMin = cfgRow.khoang_cach_goi_phut;

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
         VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',10,5,0,'HoatDong')`,
        [bsId, roomId]
      );

    // Tạo Phòng 1 + Bác sĩ 1, Phòng 2 + Bác sĩ 2, và Lễ tân
    const room1 = (
      await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} Room 1`, ck])
    ).rows[0].id;
    const room2 = (
      await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} Room 2`, ck])
    ).rows[0].id;

    const doc1 = await mkUser(roleBS, "doc1");
    const doc2 = await mkUser(roleBS, "doc2");
    const leTan = await mkUser(roleLT, "letan");

    const bs1 = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [doc1.id, `${P} BS 1`, ck]
      )
    ).rows[0].id;
    const bs2 = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [doc2.id, `${P} BS 2`, ck]
      )
    ).rows[0].id;

    await mkSchedule(bs1, room1);
    await mkSchedule(bs2, room2);

    // Tạo 3 bệnh nhân ở Phòng 1: BN1 (ONLINE A1), BN2 (OFFLINE B1), BN3 (ONLINE A2)
    const bn1 = (await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 1`])).rows[0].id;
    const bn2 = (await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 2`])).rows[0].id;
    const bn3 = (await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN 3`])).rows[0].id;

    const hdOnline1 = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1, 1, $2, $3, 'ONLINE', 'CHO_KHAM', 0, 0) RETURNING id`,
        [bn1, room1, bs1]
      )
    ).rows[0].id;

    const hdOffline1 = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1, 1, $2, $3, 'OFFLINE', 'CHO_KHAM', 0, 0) RETURNING id`,
        [bn2, room1, bs1]
      )
    ).rows[0].id;

    const hdOnline2 = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1, 2, $2, $3, 'ONLINE', 'CHO_KHAM', 0, 0) RETURNING id`,
        [bn3, room1, bs1]
      )
    ).rows[0].id;

    // =========================================================================
    // NHÓM 1: GET /queue/current Read-Only & Chặn Start từ CHO_KHAM
    // =========================================================================
    let r = await api("GET", "/queue/current", null, doc1.token);
    check(
      "GET /queue/current read-only: không tự gọi bệnh nhân CHO_KHAM khi chưa có DANG_GOI",
      r.status === 200 && r.data?.data?.has_calling === false && r.data?.data?.queue === null
    );

    r = await api("POST", `/queue/${hdOnline1}/start`, {}, doc1.token);
    check(
      "Chặn Bắt đầu khám trực tiếp từ CHO_KHAM (bắt buộc phải qua DANG_GOI)",
      r.status === 400 && r.data?.code === "INVALID_STATE"
    );

    // =========================================================================
    // NHÓM 2: Gọi bệnh nhân đầu tiên (A1) & Kiểm tra Scope/Read-Only của /current
    // =========================================================================
    r = await api("POST", "/queue/next", {}, doc1.token);
    check(
      "Gọi bệnh nhân đầu tiên (A1) sang DANG_GOI, so_lan_goi = 1, có lưu thoi_gian_goi_gan_nhat",
      r.status === 200 &&
        r.data?.data?.queue?.id === hdOnline1 &&
        r.data?.data?.queue?.nhan_stt === "A1" &&
        r.data?.data?.queue?.trang_thai === "DANG_GOI" &&
        r.data?.data?.queue?.so_lan_goi === 1 &&
        Boolean(r.data?.data?.queue?.thoi_gian_goi_gan_nhat)
    );

    const cur1 = await api("GET", "/queue/current", null, doc1.token);
    const cur2 = await api("GET", "/queue/current", null, doc1.token);
    check(
      "GET /queue/current trả đúng A1 đang gọi và giữ nguyên so_lan_goi = 1 khi F5 nhiều lần",
      cur1.status === 200 &&
        cur1.data?.data?.has_calling === true &&
        cur1.data?.data?.queue?.id === hdOnline1 &&
        cur2.data?.data?.queue?.so_lan_goi === 1
    );

    const curOtherDoc = await api("GET", "/queue/current", null, doc2.token);
    check(
      "GET /queue/current đúng scope: Bác sĩ 2 (Phòng 2) không nhìn thấy bệnh nhân đang gọi của Bác sĩ 1",
      curOtherDoc.status === 200 && curOtherDoc.data?.data?.has_calling === false
    );

    // =========================================================================
    // NHÓM 3: Kiểm soát khoảng cách gọi (M) & Auto-Recall tới N lần & Chặn Skip sớm
    // =========================================================================
    await pool.query(`UPDATE "HangDoi" SET thoi_gian_goi_gan_nhat = NULL WHERE id = $1`, [hdOnline1]);
    const nullTimestampRecall = await xuLyTuDongGoiLai([hdOnline1]);
    const nullTimestampRow = (await pool.query(
      `SELECT so_lan_goi, thoi_gian_goi_gan_nhat FROM "HangDoi" WHERE id = $1`,
      [hdOnline1]
    )).rows[0];
    check(
      "Timestamp NULL bị bỏ qua, không dùng check-in hoặc tăng số lần gọi",
      nullTimestampRecall === 0 && nullTimestampRow.so_lan_goi === 1 && nullTimestampRow.thoi_gian_goi_gan_nhat === null
    );
    await pool.query(`UPDATE "HangDoi" SET thoi_gian_goi_gan_nhat = NOW() WHERE id = $1`, [hdOnline1]);

    r = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc1.token);
    check(
      "Chặn Skip khi chưa gọi đủ số lần tối đa (so_lan_goi = 1 < N)",
      r.status === 400 && r.data?.code === "CALLS_NOT_EXHAUSTED"
    );

    // Chạy auto-recall ngay lập tức (chưa đủ M phút) -> không được tăng so_lan_goi
    const countEarly = await xuLyTuDongGoiLai([hdOnline1]);
    r = await api("POST", "/queue/recall", {}, doc1.token);
    check(
      "Kiểm soát khoảng cách gọi: Chặn tăng so_lan_goi khi chưa đủ M phút",
      countEarly === 0 && r.status === 400 && r.data?.code === "CALL_INTERVAL_NOT_REACHED"
    );

    // Tua lùi thoi_gian_goi_gan_nhat về trước M phút để kích hoạt Auto-Recall từng nấc tới maxCalls
    for (let targetCall = 2; targetCall <= maxCalls; targetCall++) {
      await pool.query(
        `UPDATE "HangDoi"
         SET thoi_gian_goi_gan_nhat = NOW() - (($2::int + 1) * interval '1 minute')
         WHERE id = $1`,
        [hdOnline1, intervalMin]
      );
      const updated = await xuLyTuDongGoiLai([hdOnline1]);
      const qNow = await api("GET", "/queue/current", null, doc1.token);
      check(
        `Auto-recall tự động tăng so_lan_goi lên ${targetCall}/${maxCalls} sau khi đủ ${intervalMin} phút`,
        updated === 1 && qNow.data?.data?.queue?.so_lan_goi === targetCall
      );

      if (targetCall < maxCalls) {
        const earlySkip = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc1.token);
        check(
          `Chặn Skip khi mới gọi ${targetCall}/${maxCalls} lần`,
          earlySkip.status === 400 && earlySkip.data?.code === "CALLS_NOT_EXHAUSTED"
        );
      }
    }

    // Khi đã đạt maxCalls, dù qua thêm M phút cũng không vượt quá maxCalls
    await pool.query(
      `UPDATE "HangDoi" SET thoi_gian_goi_gan_nhat = NOW() - (($2::int + 1) * interval '1 minute') WHERE id = $1`,
      [hdOnline1, intervalMin]
    );
    const overMax = await xuLyTuDongGoiLai([hdOnline1]);
    check("Auto-recall dừng lại khi đã chạm ngưỡng tối đa N lần", overMax === 0);

    // =========================================================================
    // NHÓM 4: Kiểm tra Ownership (Sai bác sĩ/phòng) & Skip lần 1 -> BO_LUOT
    // =========================================================================
    r = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc2.token);
    check(
      "Chặn Bác sĩ khác / Phòng khác bấm Skip lượt của Bác sĩ 1",
      r.status === 403 && r.data?.code === "FORBIDDEN_OWNERSHIP"
    );

    r = await api("POST", `/queue/${hdOnline1}/start`, {}, doc2.token);
    check(
      "Chặn Bác sĩ khác / Phòng khác bấm Start lượt của Bác sĩ 1",
      r.status === 403 && r.data?.code === "FORBIDDEN_OWNERSHIP"
    );

    r = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc1.token);
    check(
      "Skip lần 1 thành công sau khi gọi đủ N lần -> chuyển sang BO_LUOT, so_lan_bo_luot = 1",
      r.status === 200 && r.data?.data?.trang_thai === "BO_LUOT" && r.data?.data?.so_lan_bo_luot === 1
    );

    r = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc1.token);
    check(
      "Chặn gọi lặp Skip trên lượt đang ở trạng thái BO_LUOT",
      r.status === 400 && r.data?.code === "INVALID_STATE"
    );

    // =========================================================================
    // NHÓM 5: Lễ tân Xếp lại (Requeue) xuống cuối hàng OFFLINE
    // =========================================================================
    r = await api("POST", `/queue/${hdOnline1}/requeue`, {}, doc1.token);
    check("Chặn Bác sĩ tự gọi API Xếp lại (chỉ Lễ tân được phép)", r.status === 403);

    r = await api("POST", `/queue/${hdOnline1}/requeue`, {}, leTan.token);
    check(
      "Lễ tân Xếp lại thành công: chuyển sang OFFLINE, cấp STT mới B2 (cuối hàng), về CHO_KHAM, giữ so_lan_bo_luot = 1",
      r.status === 200 &&
        r.data?.data?.queue?.loai === "OFFLINE" &&
        r.data?.data?.queue?.so_thu_tu === 2 &&
        r.data?.data?.queue?.nhan_stt === "B2" &&
        r.data?.data?.queue?.trang_thai === "CHO_KHAM" &&
        r.data?.data?.queue?.so_lan_goi === 0 &&
        r.data?.data?.queue?.so_lan_bo_luot === 1
    );

    // =========================================================================
    // NHÓM 6: Regression tỷ lệ A:B & Bắt đầu khám (DANG_GOI -> DANG_KHAM)
    // =========================================================================
    // Vì lượt A1 bị BO_LUOT (chưa vào khám), số lượt ONLINE đã khám vẫn = 0.
    // Do đó gọi tiếp theo phải ưu tiên lấy A2 (hdOnline2) trước, rồi mới tới B1 (hdOffline1), rồi mới tới B2 (hdOnline1 đã xếp lại).
    r = await api("POST", "/queue/next", {}, doc1.token);
    check(
      "Regression A:B (1): Lượt BO_LUOT không làm mất suất ONLINE -> Gọi tiếp theo chọn A2",
      r.status === 200 && r.data?.data?.queue?.id === hdOnline2 && r.data?.data?.queue?.nhan_stt === "A2"
    );

    r = await api("POST", `/queue/${hdOnline2}/start`, {}, doc1.token);
    check(
      "Bắt đầu khám cho A2 từ DANG_GOI -> DANG_KHAM và tạo HoSoBenhAn thành công",
      r.status === 200 && r.data?.data?.trang_thai === "DANG_KHAM" && Boolean(r.data?.data?.ho_so_id)
    );

    // Sau khi A2 vào DANG_KHAM (ONLINE đã tiêu thụ = 1, OFFLINE = 0), lần gọi kế tiếp phải chọn OFFLINE B1 (hdOffline1)
    r = await api("POST", "/queue/next", {}, doc1.token);
    check(
      "Regression A:B (2): Sau khi 1 ONLINE vào khám, lần gọi kế tiếp chọn OFFLINE B1",
      r.status === 200 && r.data?.data?.queue?.id === hdOffline1 && r.data?.data?.queue?.nhan_stt === "B1"
    );

    // Cho B1 vào khám luôn để tiếp tục gọi tới B2 (bệnh nhân đã được Lễ tân xếp lại)
    await api("POST", `/queue/${hdOffline1}/start`, {}, doc1.token);

    // =========================================================================
    // NHÓM 7: Gọi lại bệnh nhân đã Xếp lại (B2) & Skip lần 2 -> VANG_MAT
    // =========================================================================
    r = await api("POST", "/queue/next", {}, doc1.token);
    check(
      "Gọi tới lượt bệnh nhân đã Xếp lại ở cuối hàng OFFLINE (B2), giữ so_lan_bo_luot = 1",
      r.status === 200 &&
        r.data?.data?.queue?.id === hdOnline1 &&
        r.data?.data?.queue?.nhan_stt === "B2" &&
        r.data?.data?.queue?.so_lan_bo_luot === 1
    );

    // Tự động gọi lại đủ maxCalls cho B2
    for (let c = 2; c <= maxCalls; c++) {
      await pool.query(
        `UPDATE "HangDoi" SET thoi_gian_goi_gan_nhat = NOW() - (($2::int + 1) * interval '1 minute') WHERE id = $1`,
        [hdOnline1, intervalMin]
      );
      await xuLyTuDongGoiLai([hdOnline1]);
    }

    r = await api("POST", `/queue/${hdOnline1}/skip`, {}, doc1.token);
    check(
      "Skip lần 2 sau khi đã xếp lại -> chuyển hẳn sang VANG_MAT, so_lan_bo_luot = 2 (đóng lượt)",
      r.status === 200 && r.data?.data?.trang_thai === "VANG_MAT" && r.data?.data?.so_lan_bo_luot === 2
    );

    r = await api("POST", `/queue/${hdOnline1}/requeue`, {}, leTan.token);
    check(
      "Chặn Lễ tân xếp lại lượt đã chuyển sang VANG_MAT (lần 2)",
      r.status === 400 && r.data?.code === "INVALID_REQUEUE_STATE"
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
