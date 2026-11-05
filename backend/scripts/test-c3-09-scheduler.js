// C3-09 REGRESSION (manual Test 3.3): BO_LUOT -> requeue -> gọi B3 -> SCHEDULER thật -> 1 -> 2 -> 3
// Nguyên tắc: KHÔNG gọi trực tiếp xuLyTuDongGoiLai. Test chỉ bật đúng scheduler mà server dùng
// (batDauJobCheckin) rồi chờ nó tự tăng so_lan_goi theo cấu hình N/M trong CauHinhHeThong.
// Yêu cầu: backend đang chạy ở http://localhost:3000 và CauHinhHeThong hợp lệ.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { batDauJobCheckin, dungJobCheckin } = require("../src/jobs/checkinBackground.job");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);
const P = `C3S9${sfx}`;
const ORIGINAL_ENV = {
  C3_JOB_DRY_RUN: process.env.C3_JOB_DRY_RUN,
  C3_JOB_ONLY_IDS: process.env.C3_JOB_ONLY_IDS,
};
let pass = 0;
let fail = 0;

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

const readState = async (id) =>
  (
    await pool.query(
      `SELECT so_lan_goi, so_lan_bo_luot, trang_thai, loai, so_thu_tu, thoi_gian_goi_gan_nhat
       FROM "HangDoi" WHERE id = $1`,
      [id]
    )
  ).rows[0];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitFor = async (fn, timeoutMs, stepMs = 3000) => {
  const het = Date.now() + timeoutMs;
  while (Date.now() < het) {
    if (await fn()) return true;
    await sleep(stepMs);
  }
  return false;
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
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`c3s9_${sfx}_%`]);
    console.log("Dọn dẹp dữ liệu test xong.");
  } catch (e) {
    console.error("Lỗi dọn dữ liệu:", e.message);
  }
};

(async () => {
  let hdId = null;
  try {
    // 0. Cấu hình phải hợp lệ: N >= 2 để thấy được 1 -> 2, M và chu kỳ > 0
    const cfg = (await pool.query(`SELECT * FROM "CauHinhHeThong" ORDER BY id LIMIT 1`)).rows[0];
    if (
      !cfg ||
      !Number.isInteger(cfg.so_lan_goi_toi_da) || cfg.so_lan_goi_toi_da < 2 ||
      !Number.isInteger(cfg.khoang_cach_goi_phut) || cfg.khoang_cach_goi_phut <= 0 ||
      !Number.isInteger(cfg.chu_ky_quet_phut) || cfg.chu_ky_quet_phut <= 0
    ) {
      throw new Error(
        "Cần CauHinhHeThong hợp lệ: so_lan_goi_toi_da >= 2, khoang_cach_goi_phut > 0, chu_ky_quet_phut > 0"
      );
    }
    const maxCalls = cfg.so_lan_goi_toi_da;
    const intervalMin = cfg.khoang_cach_goi_phut;
    const cycleMin = cfg.chu_ky_quet_phut;
    const target = Math.min(3, maxCalls);
    console.log(
      `Cấu hình: N=${maxCalls}, M=${intervalMin} phút, chu kỳ quét=${cycleMin} phút, mục tiêu so_lan_goi 1 -> ${target}`
    );

    // 1. Fixture riêng: phòng + bác sĩ (có lịch hôm nay) + lễ tân + 1 lượt BO_LUOT lần 1
    const pwHash = await bcrypt.hash("123456", 10);
    const roleMap = Object.fromEntries(
      (await pool.query(`SELECT id, ten_vai_tro FROM "VaiTro"`)).rows.map((r) => [r.ten_vai_tro, r.id])
    );
    const ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const mkUser = async (roleId, tag) => {
      const username = `c3s9_${sfx}_${tag}`;
      const r = await pool.query(
        `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
        [username, pwHash, roleId, STATUS_ACTIVE]
      );
      const login = await api("POST", "/auth/login", { username, password: "123456" });
      return { id: r.rows[0].id, token: login.data?.data?.token };
    };

    const roomId = (
      await pool.query(
        `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`,
        [`${P} Room`, ck]
      )
    ).rows[0].id;
    const doc = await mkUser(roleMap["Bác sĩ"], "doc");
    const leTan = await mkUser(roleMap["Lễ tân"], "letan");
    if (!doc.token || !leTan.token) {
      throw new Error("Không đăng nhập được tài khoản test - backend đã chạy ở cổng 3000 chưa?");
    }
    const bsId = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [doc.id, `${P} BS`, ck]
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO "LichKhamBacSi"
         (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc,
          so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',10,5,0,'HoatDong')`,
      [bsId, roomId]
    );
    const bnId = (
      await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN`])
    ).rows[0].id;
    hdId = (
      await pool.query(
        `INSERT INTO "HangDoi"
           (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai,
            so_lan_goi, so_lan_bo_luot, thoi_gian_goi_gan_nhat)
         VALUES ($1, 2, $2, $3, 'OFFLINE', 'BO_LUOT', $4, 1, NOW() - interval '5 minutes')
         RETURNING id`,
        [bnId, roomId, bsId, maxCalls]
      )
    ).rows[0].id;
    check(
      "Fixture: 1 lượt BO_LUOT lần 1 (đã gọi đủ N lần) ở phòng/bác sĩ riêng",
      Boolean(hdId),
      `queueId=${hdId}`
    );

    // 2. Lễ tân xếp lại: BO_LUOT -> CHO_KHAM/OFFLINE, cấp STT mới B3
    const requeue = await api("POST", `/queue/${hdId}/requeue`, {}, leTan.token);
    const afterRequeue = await readState(hdId);
    check(
      "Requeue: BO_LUOT -> CHO_KHAM/OFFLINE, reset so_lan_goi = 0, xoá thoi_gian_goi_gan_nhat",
      requeue.status === 200 &&
        afterRequeue.trang_thai === "CHO_KHAM" &&
        afterRequeue.loai === "OFFLINE" &&
        afterRequeue.so_lan_goi === 0 &&
        afterRequeue.so_lan_bo_luot === 1 &&
        afterRequeue.thoi_gian_goi_gan_nhat === null,
      JSON.stringify(afterRequeue)
    );
    check(
      "Requeue cấp STT mới xuống cuối hàng OFFLINE (B3)",
      afterRequeue.so_thu_tu === 3 && requeue.data?.data?.queue?.nhan_stt === "B3",
      JSON.stringify(requeue.data?.data?.queue)
    );

    // 3. Bác sĩ gọi lại B3: so_lan_goi quay về 1
    const next = await api("POST", "/queue/next", {}, doc.token);
    const afterCall = await readState(hdId);
    check(
      "Gọi lại B3 sau requeue: DANG_GOI, so_lan_goi = 1, có thoi_gian_goi_gan_nhat",
      next.status === 200 &&
        next.data?.data?.queue?.id === hdId &&
        afterCall.trang_thai === "DANG_GOI" &&
        afterCall.so_lan_goi === 1 &&
        afterCall.thoi_gian_goi_gan_nhat !== null,
      JSON.stringify({ status: next.status, queue: next.data?.data?.queue, afterCall })
    );
    const t1 = afterCall.thoi_gian_goi_gan_nhat.getTime();

    // 4. Bật SCHEDULER thật (đúng hàm server dùng) và chờ nó tự tăng 1 -> 2 -> 3.
    //    C3_JOB_ONLY_IDS = "0,<id>" để C3-03 không đụng dữ liệu của người khác (id 0 không tồn tại).
    process.env.C3_JOB_DRY_RUN = "false";
    process.env.C3_JOB_ONLY_IDS = `0,${hdId}`;
    batDauJobCheckin();

    const budgetMs = (intervalMin * 2 + cycleMin * 2 + 2) * 60 * 1000;
    const seen = [];
    const reached = await waitFor(async () => {
      const s = await readState(hdId);
      if (seen[seen.length - 1] !== s.so_lan_goi) seen.push(s.so_lan_goi);
      return s.so_lan_goi >= target;
    }, budgetMs);

    const afterScheduler = await readState(hdId);
    const expected = Array.from({ length: target }, (_, i) => i + 1).join(">");
    check(
      `Scheduler tự tăng so_lan_goi 1 -> ${target} (không gọi helper trực tiếp)`,
      reached && seen.join(">") === expected,
      `seen=${seen.join(" -> ")}`
    );
    check(
      "Scheduler chạy nhiều vòng liên tiếp (vòng sau vẫn được hẹn lại trong finally)",
      seen.length >= 2,
      `seen=${seen.join(" -> ")}`
    );
    check(
      "Scheduler không vượt ngưỡng N, vẫn DANG_GOI và cập nhật thoi_gian_goi_gan_nhat",
      afterScheduler.so_lan_goi === target &&
        afterScheduler.so_lan_goi <= maxCalls &&
        afterScheduler.trang_thai === "DANG_GOI" &&
        afterScheduler.thoi_gian_goi_gan_nhat.getTime() > t1,
      JSON.stringify(afterScheduler)
    );

    // 5. Đủ N lần gọi => luồng skip/requeue không đổi
    if (afterScheduler.so_lan_goi >= maxCalls) {
      const skip = await api("POST", `/queue/${hdId}/skip`, {}, doc.token);
      const afterSkip = await readState(hdId);
      check(
        "Sau khi scheduler gọi đủ N lần, skip không còn bị CALLS_NOT_EXHAUSTED",
        skip.status === 200 && afterSkip.trang_thai === "VANG_MAT" && afterSkip.so_lan_bo_luot === 2,
        JSON.stringify({ status: skip.status, code: skip.data?.code, afterSkip })
      );
      const requeueAgain = await api("POST", `/queue/${hdId}/requeue`, {}, leTan.token);
      check(
        "Requeue lần 2 vẫn bị chặn (INVALID_REQUEUE_STATE) - flow requeue không đổi",
        requeueAgain.status === 400 && requeueAgain.data?.code === "INVALID_REQUEUE_STATE",
        JSON.stringify({ status: requeueAgain.status, code: requeueAgain.data?.code })
      );
    } else {
      console.log(
        `Bỏ qua kiểm tra skip/requeue: N=${maxCalls} > ${target} nên scheduler chưa đạt N trong ngân sách test`
      );
    }
  } catch (e) {
    fail++;
    console.error("LỖI CHẠY SCRIPT TEST:", e);
  } finally {
    dungJobCheckin();
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await cleanup();
    console.log("");
    console.log(`KẾT QUẢ KIỂM THỬ: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
})();
