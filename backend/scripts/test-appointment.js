const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const LICH_ACTIVE = "HoatDong"; // phải giống LICH_ACTIVE trong controller
const sfx = Date.now().toString().slice(-6);

const made = { users: [], bacSiId: null };
let pass = 0;
let fail = 0;

const check = (label, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} ${extra}`);
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

const newUser = async (i) => {
  const username = `zz_t${sfx}_${i}`;
  made.users.push(username);
  await api("POST", "/auth/register", { username, password: "123456", ho_ten: `ZZ Test ${i}` });
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return login.data.data.token;
};

const newLich = async ({ offsetSec, online = 3, booked = 0, status = LICH_ACTIVE }) => {
  const r = await pool.query(
    `INSERT INTO "LichKhamBacSi"
       (bac_si_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
     SELECT $1::int, t::date, t::time, (t + interval '30 minutes')::time,
            $3::int + 5, $3::int, $4::int, $5::text
     FROM (SELECT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + ($2::int * interval '1 second') AS t) x
     RETURNING id`,
    [made.bacSiId, offsetSec, online, booked, status]
  );
  return r.rows[0].id;
};

const daDat = async (lichId) =>
  Number((await pool.query(`SELECT so_slot_da_dat FROM "LichKhamBacSi" WHERE id=$1`, [lichId])).rows[0].so_slot_da_dat);

const countAppts = async () =>
  Number((await pool.query(`SELECT COUNT(*) FROM "DatLichKham" WHERE bac_si_id=$1`, [made.bacSiId])).rows[0].count);

const cleanup = async () => {
  try {
    if (made.bacSiId) {
      await pool.query(`DELETE FROM "DatLichKham" WHERE bac_si_id=$1`, [made.bacSiId]);
      await pool.query(`DELETE FROM "LichKhamBacSi" WHERE bac_si_id=$1`, [made.bacSiId]);
      await pool.query(`DELETE FROM "BacSi" WHERE id=$1`, [made.bacSiId]);
    }
    if (made.users.length) {
      await pool.query(
        `DELETE FROM "BenhNhan" WHERE tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap = ANY($1))`,
        [made.users]
      );
      await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap = ANY($1)`, [made.users]);
    }
    const left = await pool.query(
      `SELECT (SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE 'zz_t${sfx}%') AS tk,
              (SELECT COUNT(*) FROM "BacSi" WHERE ho_ten LIKE 'ZZ TEST BS ${sfx}%') AS bs`
    );
    console.log(`\nDọn dữ liệu test xong. Còn sót: TaiKhoan=${left.rows[0].tk}, BacSi=${left.rows[0].bs} (phải = 0)`);
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay bằng SQL trong hướng dẫn:", e.message);
  }
};

(async () => {
  try {
    const ck = await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`);
    const bs = await pool.query(
      `INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,$4) RETURNING id`,
      [`ZZ TEST BS ${sfx}`, ck.rows[0].id, 150000, "Test"]
    );
    made.bacSiId = bs.rows[0].id;

    const tokens = [];
    for (let i = 0; i < 5; i++) tokens.push(await newUser(i));
    const me = await api("GET", "/auth/me", null, tokens[0]);
    const benhNhanId0 = me.data.data.user.benh_nhan_id;

    // 1. Không đăng nhập
    let r = await api("POST", "/appointments", { lich_kham_id: 1 });
    check("Không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);

    // 2. lich_kham_id không hợp lệ
    const before = await countAppts();
    for (const bad of [undefined, "abc", -1, 0, {}, [], 1.5]) {
      r = await api("POST", "/appointments", { lich_kham_id: bad }, tokens[0]);
      check(`lich_kham_id=${JSON.stringify(bad)} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await api("POST", "/appointments", { lich_kham_id: 999999999 }, tokens[0]);
    check("lich_kham_id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    check("Input lỗi không tạo dữ liệu", (await countAppts()) === before);

    // 3. Đặt hợp lệ
    const lichA = await newLich({ offsetSec: 3600, online: 3, booked: 0 });
    r = await api("POST", "/appointments", { lich_kham_id: lichA, trieu_chung: "Dau dau" }, tokens[0]);
    check("Slot hợp lệ -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data)}`);
    const a = r.data?.data?.appointment;
    if (a) {
      const row = (await pool.query(`SELECT * FROM "DatLichKham" WHERE ma_dat_lich=$1`, [a.ma_dat_lich])).rows[0];
      check("DatLichKham có record", !!row);
      check("Đúng bệnh nhân đang đăng nhập", row && row.benh_nhan_id === benhNhanId0);
      check("Đúng bác sĩ", row && row.bac_si_id === made.bacSiId);
      check("Trạng thái 'Đã đặt'", row && row.trang_thai === "Đã đặt");
      check("Có qr_code", row && !!row.qr_code);
    }
    check("so_slot_da_dat tăng đúng 1", (await daDat(lichA)) === 1);

    // 4. Slot đầy
    const lichFull = await newLich({ offsetSec: 3600, online: 1, booked: 1 });
    let c0 = await countAppts();
    r = await api("POST", "/appointments", { lich_kham_id: lichFull }, tokens[1]);
    check("Slot đầy -> 409", r.status === 409, `(nhận ${r.status})`);
    check("Slot đầy: không tạo, counter giữ nguyên", (await countAppts()) === c0 && (await daDat(lichFull)) === 1);

    // 5. Mốc 10 phút
    const lichSoon = await newLich({ offsetSec: 540 }); // còn ~9 phút
    c0 = await countAppts();
    r = await api("POST", "/appointments", { lich_kham_id: lichSoon }, tokens[1]);
    check("Còn < 10 phút -> 400", r.status === 400, `(nhận ${r.status})`);
    check("< 10 phút: không tạo, counter giữ nguyên", (await countAppts()) === c0 && (await daDat(lichSoon)) === 0);

    const lichEdge = await newLich({ offsetSec: 640 }); // còn ~10 phút 40 giây
    r = await api("POST", "/appointments", { lich_kham_id: lichEdge }, tokens[1]);
    check("Còn >= 10 phút (sát mốc) -> 201", r.status === 201, `(nhận ${r.status})`);

    // 6. Đã qua + lịch không hoạt động
    const lichPast = await newLich({ offsetSec: -3600 });
    r = await api("POST", "/appointments", { lich_kham_id: lichPast }, tokens[1]);
    check("Lịch đã qua -> 400", r.status === 400, `(nhận ${r.status})`);

    const lichOff = await newLich({ offsetSec: 3600, status: "ZZ_NGUNG" });
    r = await api("POST", "/appointments", { lich_kham_id: lichOff }, tokens[1]);
    check("Lịch không hoạt động -> 409", r.status === 409, `(nhận ${r.status})`);

    // 7. Đặt đồng thời: còn 2 chỗ, bắn 5 request cùng lúc
    const lichRace = await newLich({ offsetSec: 3600, online: 2, booked: 0 });
    const results = await Promise.all(
      tokens.map((t) => api("POST", "/appointments", { lich_kham_id: lichRace }, t))
    );
    const ok = results.filter((x) => x.status === 201).length;
    const full = results.filter((x) => x.status === 409).length;
    check("Đồng thời: đúng 2 request thành công", ok === 2, `(thành công=${ok}, hết chỗ=${full})`);
    check("Đồng thời: các request còn lại bị 409", full === 3);
    check("Đồng thời: so_slot_da_dat = 2, không vượt quota", (await daDat(lichRace)) === 2);

    // 8. Regression
    r = await api("GET", "/health");
    check("Regression /health -> 200", r.status === 200);
    r = await api("GET", "/auth/me", null, tokens[0]);
    check("Regression /auth/me -> 200", r.status === 200);
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