// C6-06 - Cấu hình Khung giờ & Slot (UC-031)
// Chạy: npm run api:test-c6-06   (backend phải đang chạy ở localhost:3000, đã chạy db:migrate:c6-06)
// Tự tạo tài khoản test (zzt...), tự khôi phục capacity gốc và dọn dữ liệu sau khi chạy.

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { getTimeSlotTemplate } = require("../src/services/timeSlotConfig.service");

const BASE = "http://localhost:3000/api";
const sfx = Date.now().toString().slice(-6);
const EXPECTED = [
  ["SANG", "06:00", "07:00"],
  ["SANG", "07:00", "08:00"],
  ["SANG", "08:00", "09:00"],
  ["SANG", "09:00", "10:00"],
  ["SANG", "10:00", "11:00"],
  ["CHIEU", "13:00", "14:00"],
  ["CHIEU", "14:00", "15:00"],
  ["CHIEU", "15:00", "16:00"],
];
let pass = 0, fail = 0, original = [];

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

const mkUser = async (roleName, tag, hash) => {
  const username = `zzt${sfx}_${tag}`;
  const role = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [roleName]);
  await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1, $2, $3, 'HoatDong')`,
    [username, hash, role.rows[0].id]
  );
  const r = await api("POST", "/auth/login", { username, password: "123456" });
  return r.data?.data?.token;
};

// Ảnh chụp capacity của toàn bộ lịch trực hiện có (để chứng minh không bị ghi đè)
const scheduleSnapshot = async () =>
  (
    await pool.query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(md5(string_agg(id || ':' || so_slot_toi_da || ':' || so_slot_online || ':' || so_slot_da_dat, ',' ORDER BY id)), '') AS h
       FROM "LichKhamBacSi"`
    )
  ).rows[0];

(async () => {
  const hash = await bcrypt.hash("123456", 10);
  try {
    original = (
      await pool.query(`SELECT id, so_slot_toi_da, so_slot_online FROM "CauHinhKhungGio" ORDER BY gio_bat_dau`)
    ).rows;
    const T = await mkUser("Quản trị viên", "admin", hash);
    const patientToken = await mkUser("Bệnh nhân", "bn", hash);
    const doctorToken = await mkUser("Bác sĩ", "bs", hash);

    // ---------- Quyền ----------
    check("Không token -> 401", (await api("GET", "/admin/time-slots")).status === 401);
    check("Bác sĩ -> 403", (await api("GET", "/admin/time-slots", undefined, doctorToken)).status === 403);
    check("Không phải admin PUT -> 403", (await api("PUT", `/admin/time-slots/${original[0].id}`, { so_slot_toi_da: 5, so_slot_online: 2 }, doctorToken)).status === 403);

    // ---------- Đọc ----------
    let r = await api("GET", "/admin/time-slots", undefined, T);
    const items = r.data.data?.items || [];
    check("GET -> 200", r.status === 200);
    check("time_format = HH:mm", r.data.data?.time_format === "HH:mm");
    check("Đủ 8 khung giờ theo đặc tả", items.length === 8, `(nhận ${items.length})`);
    check(
      "Đúng ca + giờ bắt đầu/kết thúc, sắp xếp tăng dần",
      EXPECTED.every(([ca, s, e], i) => items[i]?.ca === ca && items[i]?.gio_bat_dau === s && items[i]?.gio_ket_thuc === e)
    );
    check("Ca sáng 06:00-11:00 = 5 khung", items.filter((x) => x.ca === "SANG").length === 5);
    check("Ca chiều 13:00-16:00 = 3 khung", items.filter((x) => x.ca === "CHIEU").length === 3);
    check("Offline = tối đa - online ở mọi khung", items.every((x) => x.so_slot_offline === x.so_slot_toi_da - x.so_slot_online));
    check("Mọi khung online <= tối đa và tối đa > 0", items.every((x) => x.so_slot_toi_da > 0 && x.so_slot_online >= 0 && x.so_slot_online <= x.so_slot_toi_da));

    // ---------- Validate ----------
    const target = items[2]; // 08:00-09:00
    const put = (body, id = target.id) => api("PUT", `/admin/time-slots/${id}`, body, T);
    const cases = [
      ["Total = 0 bị chặn", { so_slot_toi_da: 0, so_slot_online: 0 }],
      ["Total âm bị chặn", { so_slot_toi_da: -3, so_slot_online: 0 }],
      ["Online âm bị chặn", { so_slot_toi_da: 6, so_slot_online: -1 }],
      ["Online > total bị chặn", { so_slot_toi_da: 4, so_slot_online: 5 }],
      ["Total là chuỗi bị chặn", { so_slot_toi_da: "6", so_slot_online: 4 }],
      ["Online số thập phân bị chặn", { so_slot_toi_da: 6, so_slot_online: 2.5 }],
      ["Thiếu so_slot_online bị chặn", { so_slot_toi_da: 6 }],
      ["Online null bị chặn", { so_slot_toi_da: 6, so_slot_online: null }],
    ];
    for (const [label, body] of cases) {
      r = await put(body);
      check(`${label} -> 400`, r.status === 400, `(nhận ${r.status} ${r.data.message || ""})`);
    }
    check("id không hợp lệ -> 400", (await put({ so_slot_toi_da: 6, so_slot_online: 4 }, "abc")).status === 400);
    check("id không tồn tại -> 404", (await put({ so_slot_toi_da: 6, so_slot_online: 4 }, 999999)).status === 404);
    r = await api("GET", "/admin/time-slots", undefined, T);
    const afterBad = r.data.data.items.find((x) => x.id === target.id);
    check(
      "Request lỗi không làm đổi dữ liệu",
      afterBad.so_slot_toi_da === target.so_slot_toi_da && afterBad.so_slot_online === target.so_slot_online
    );

    // DB tự chặn nếu có ai ghi sai trực tiếp (bảo vệ C6-07)
    let dbBlocked = false;
    try {
      await pool.query(`UPDATE "CauHinhKhungGio" SET so_slot_online = so_slot_toi_da + 1 WHERE id = $1`, [target.id]);
    } catch (e) {
      dbBlocked = e.code === "23514";
    }
    check("CHECK constraint trong DB chặn online > tối đa", dbBlocked);

    // ---------- Lưu ----------
    const schedBefore = await scheduleSnapshot();
    const lich = await pool.query(`SELECT bac_si_id, to_char(ngay, 'YYYY-MM-DD') AS ngay FROM "LichKhamBacSi" ORDER BY id LIMIT 1`);
    const slotPath = lich.rowCount ? `/slots?bac_si_id=${lich.rows[0].bac_si_id}&ngay=${lich.rows[0].ngay}` : null;
    const slotBefore = slotPath ? await api("GET", slotPath, undefined, patientToken) : null;

    r = await put({ so_slot_toi_da: 10, so_slot_online: 7 });
    check("Save thành công -> 200", r.status === 200, `(nhận ${r.status} ${r.data.message || ""})`);
    check("Response trả đúng giá trị mới + offline = 3",
      r.data.data?.so_slot_toi_da === 10 && r.data.data?.so_slot_online === 7 && r.data.data?.so_slot_offline === 3);
    r = await put({ so_slot_toi_da: 5, so_slot_online: 5 }, items[7].id);
    check("Online = total (offline = 0) hợp lệ", r.status === 200 && r.data.data?.so_slot_offline === 0);
    r = await put({ so_slot_toi_da: 3, so_slot_online: 0 }, items[0].id);
    check("Online = 0 (toàn bộ offline) hợp lệ", r.status === 200 && r.data.data?.so_slot_offline === 3);

    r = await api("GET", "/admin/time-slots", undefined, T);
    const saved = r.data.data.items;
    const s2 = saved.find((x) => x.id === target.id);
    check("Reload vẫn đúng dữ liệu vừa lưu", s2.so_slot_toi_da === 10 && s2.so_slot_online === 7 && s2.so_slot_offline === 3);
    check("Khung khác không bị đổi theo", saved[1].so_slot_toi_da === items[1].so_slot_toi_da && saved[1].so_slot_online === items[1].so_slot_online);
    check("Giờ khung không đổi sau khi lưu", s2.gio_bat_dau === "08:00" && s2.gio_ket_thuc === "09:00");

    // ---------- Không ảnh hưởng dữ liệu cũ / booking ----------
    const schedAfter = await scheduleSnapshot();
    check("Lịch trực hiện có không bị thay đổi (số lượng + capacity)", schedBefore.n === schedAfter.n && schedBefore.h === schedAfter.h, `(${schedAfter.n} lịch)`);
    if (slotPath) {
      const slotAfter = await api("GET", slotPath, undefined, patientToken);
      check(
        "Patient Booking: API /slots trả y hệt trước khi đổi cấu hình",
        slotBefore.status === slotAfter.status && JSON.stringify(slotBefore.data) === JSON.stringify(slotAfter.data),
        `(status ${slotAfter.status})`
      );
    } else {
      console.log("SKIP  Không có LichKhamBacSi để so sánh API /slots");
    }

    // ---------- Contract cho C6-07 ----------
    const tpl = await getTimeSlotTemplate();
    check("C6-07: getTimeSlotTemplate() trả cùng dữ liệu với API", JSON.stringify(tpl) === JSON.stringify(saved));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inTx = await getTimeSlotTemplate(client);
      check("C6-07: đọc được template trong transaction (truyền client)", inTx.length === 8);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } catch (e) {
    fail++;
    console.error("Lỗi khi chạy test:", e);
  } finally {
    try {
      for (const o of original) {
        await pool.query(`UPDATE "CauHinhKhungGio" SET so_slot_toi_da = $1, so_slot_online = $2 WHERE id = $3`, [
          o.so_slot_toi_da,
          o.so_slot_online,
          o.id,
        ]);
      }
      await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzt${sfx}_%`]);
      console.log("\nĐã khôi phục cấu hình gốc và dọn tài khoản test.");
    } catch (e) {
      console.error("Cleanup lỗi:", e.message);
    }
    console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
    await pool.end();
    process.exit(fail ? 1 : 0);
  }
})();