const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { evaluateCheckinWindow } = require("../src/utils/checkinWindow");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong"; // phải giống STATUS_ACTIVE trong auth.controller
const LICH_ACTIVE = "HoatDong";
const sfx = Date.now().toString().slice(-6);

const made = { bacSiId: null, users: [] };
let pass = 0,
  fail = 0,
  n = 0;

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

const mkAppt = async (offsetSec, status, benhNhanId, bacSiId, ckId) => {
  const code = `ZZCI${sfx}${++n}`;
  const r = await pool.query(
    `INSERT INTO "DatLichKham" (ma_dat_lich, benh_nhan_id, bac_si_id, chuyen_khoa_id, ngay_kham, gio_kham, trang_thai, qr_code)
     SELECT $1::text, $2::int, $3::int, $4::int, t::date, t::time, $6::text, $1::text
     FROM (SELECT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + ($5::int * interval '1 second') AS t) x
     RETURNING id`,
    [code, benhNhanId, bacSiId, ckId, offsetSec, status]
  );
  return { id: r.rows[0].id, code };
};

const statusOf = async (id) =>
  (await pool.query(`SELECT trang_thai FROM "DatLichKham" WHERE id=$1`, [id])).rows[0].trang_thai;

const cleanup = async () => {
  try {
    if (made.users.length) {
      await pool.query(
        `DELETE FROM "HangDoi" WHERE benh_nhan_id IN
           (SELECT bn.id FROM "BenhNhan" bn JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id WHERE tk.ten_dang_nhap = ANY($1))`,
        [made.users]
      );
    }
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
              (SELECT COUNT(*) FROM "BacSi" WHERE ho_ten LIKE 'ZZ TEST BS ${sfx}%') AS bs,
              (SELECT COUNT(*) FROM "DatLichKham" WHERE ma_dat_lich LIKE 'ZZCI${sfx}%') AS dl`
    );
    console.log(
      `\nDọn dữ liệu xong. Còn sót: TaiKhoan=${left.rows[0].tk}, BacSi=${left.rows[0].bs}, DatLichKham=${left.rows[0].dl} (phải = 0)`
    );
  } catch (e) {
    console.error("LỖI khi dọn dữ liệu, hãy dọn tay:", e.message);
  }
};

(async () => {
  try {
    // ---- Chuẩn bị dữ liệu test ----
    const ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;
    const bs = await pool.query(
      `INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,$4) RETURNING id`,
      [`ZZ TEST BS ${sfx}`, ck, 150000, "Test"]
    );
    made.bacSiId = bs.rows[0].id;

    const patientName = `zz_t${sfx}_p`;
    made.users.push(patientName);
    await api("POST", "/auth/register", {
      username: patientName,
      password: "123456",
      ho_ten: "ZZ Test Patient",
    });
    const pTok = (await api("POST", "/auth/login", { username: patientName, password: "123456" })).data
      .data.token;
    const benhNhanId = (await api("GET", "/auth/me", null, pTok)).data.data.user.benh_nhan_id;

    const staffName = `zz_t${sfx}_s`;
    made.users.push(staffName);
    const roleLT = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`)).rows[0].id;
    await pool.query(
      `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4)`,
      [staffName, await bcrypt.hash("123456", 10), roleLT, STATUS_ACTIVE]
    );
    const sTok = (await api("POST", "/auth/login", { username: staffName, password: "123456" })).data
      .data.token;

    const mk = (off, st = "DA_DAT") => mkAppt(off, st, benhNhanId, made.bacSiId, ck);
    const queueCount = async () =>
      Number(
        (await pool.query(`SELECT COUNT(*) FROM "HangDoi" WHERE benh_nhan_id=$1`, [benhNhanId])).rows[0]
          .count
      );
    const checkin = (code, tok = sTok, field = "ma_dat_lich") =>
      api("POST", "/checkin/online", { [field]: code }, tok);

    // ---- 1. Rule thời gian: biên chính xác (hàm thuần) ----
    check("Biên: đúng 60 phút -> OK", evaluateCheckinWindow(3600, 60, 10) === "OK");
    check("Biên: đúng 10 phút -> OK", evaluateCheckinWindow(600, 60, 10) === "OK");
    check("Biên: hơn 60 phút -> TOO_EARLY", evaluateCheckinWindow(3600.5, 60, 10) === "TOO_EARLY");
    check("Biên: dưới 10 phút -> TOO_LATE", evaluateCheckinWindow(599.5, 60, 10) === "TOO_LATE");
    check("Biên: đã qua giờ -> TOO_LATE", evaluateCheckinWindow(-100, 60, 10) === "TOO_LATE");

    // ---- 2. Quyền và input ----
    let r = await checkin("x", null);
    check("Không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);
    r = await checkin("x", pTok);
    check("Bệnh nhân (không phải Lễ tân) -> 403", r.status === 403, `(nhận ${r.status})`);
    for (const bad of [undefined, 123, "", "   ", {}]) {
      r = await api("POST", "/checkin/online", { ma_dat_lich: bad }, sTok);
      check(`ma_dat_lich=${JSON.stringify(bad)} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    r = await checkin("KHONG_TON_TAI_" + sfx);
    check("Mã không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);

    // ---- 3. Happy path ----
    const q0 = await queueCount();
    const a1 = await mk(1800); // còn 30 phút
    r = await checkin(a1.code);
    check("Check-in hợp lệ -> 200", r.status === 200, `(nhận ${r.status}) ${JSON.stringify(r.data)}`);
    check("Response có trạng thái DA_CHECK_IN", r.data?.data?.appointment?.trang_thai === "DA_CHECK_IN");
    check("DB: DA_DAT -> DA_CHECK_IN", (await statusOf(a1.id)) === "DA_CHECK_IN");
    check(
      "Response có thông tin bệnh nhân/bác sĩ cho LT-02",
      !!r.data?.data?.patient?.ho_ten && !!r.data?.data?.doctor?.ho_ten
    );
    check("Không tạo HangDoi sau check-in", (await queueCount()) === q0);

    // ---- 4. Check-in lần hai ----
    r = await checkin(a1.code);
    check("Check-in lần hai -> 409", r.status === 409, `(nhận ${r.status})`);
    check(
      "Lần hai không làm sai dữ liệu",
      (await statusOf(a1.id)) === "DA_CHECK_IN" && (await queueCount()) === q0
    );

    // ---- 5. Cửa sổ thời gian (có biên độ an toàn qua API) ----
    const cases = [
      ["Còn ~59 phút 40 giây -> 200", 3580, 200, null],
      ["Còn ~61 phút -> 400 TOO_EARLY", 3660, 400, "TOO_EARLY"],
      ["Còn ~10 phút 40 giây -> 200", 640, 200, null],
      ["Còn ~9 phút -> 400 TOO_LATE", 540, 400, "TOO_LATE"],
      ["Đã qua giờ 30 phút -> 400 TOO_LATE", -1800, 400, "TOO_LATE"],
    ];
    for (const [label, off, st, errCode] of cases) {
      const a = await mk(off);
      r = await checkin(a.code);
      check(label, r.status === st && (!errCode || r.data.code === errCode), `(nhận ${r.status} ${r.data.code || ""})`);
      const expectStatus = st === 200 ? "DA_CHECK_IN" : "DA_DAT";
      check(`  -> DB còn đúng trạng thái ${expectStatus}`, (await statusOf(a.id)) === expectStatus);
    }

    // ---- 6. Sai trạng thái ----
    for (const st of ["DA_CHECK_IN", "QUA_HAN_CHECK_IN", "DA_HUY", "HOAN_THANH"]) {
      const a = await mk(1800, st);
      r = await checkin(a.code);
      check(`Trạng thái ${st} -> 409`, r.status === 409, `(nhận ${r.status})`);
      check(`  -> ${st} không bị đổi`, (await statusOf(a.id)) === st);
    }

    // ---- 7. Nhập bằng QR và gõ chữ thường ----
    const aQr = await mk(1800);
    r = await checkin(aQr.code, sTok, "qr_code");
    check("Check-in bằng qr_code -> 200", r.status === 200, `(nhận ${r.status})`);
    const aLow = await mk(1800);
    r = await checkin(aLow.code.toLowerCase());
    check("Mã gõ chữ thường -> 200", r.status === 200, `(nhận ${r.status})`);

    // ---- 8. Đồng thời: 5 request cùng lúc ----
    const aRace = await mk(1800);
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => checkin(aRace.code)));
    const ok = rs.filter((x) => x.status === 200).length;
    const dup = rs.filter((x) => x.status === 409).length;
    check("Đồng thời: đúng 1 request thành công", ok === 1 && dup === 4, `(200=${ok}, 409=${dup})`);
    check("Đồng thời: trạng thái cuối DA_CHECK_IN", (await statusOf(aRace.id)) === "DA_CHECK_IN");
    check("Không tạo HangDoi trong cả bài test", (await queueCount()) === q0);

    // ---- 9. Regression flow C2 (đặt, xem, hủy lịch) ----
    r = await api("GET", "/health");
    check("Regression /health -> 200", r.status === 200);
    
    const lich = await pool.query(
      `INSERT INTO "LichKhamBacSi" (bac_si_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       SELECT $1::int, t::date, t::time, (t + interval '30 minutes')::time, 5, 3, 0, $2::text
       FROM (SELECT date_trunc('minute', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '3 hours') AS t) x RETURNING id`,
      [made.bacSiId, LICH_ACTIVE]
    );
    r = await api("POST", "/appointments", { lich_kham_id: lich.rows[0].id }, pTok);
    check("Regression C2: đặt lịch -> 201", r.status === 201, `(nhận ${r.status}) ${JSON.stringify(r.data)}`);

    const newCode = r.data?.data?.appointment?.ma_dat_lich;
    const apptId = r.data?.data?.appointment?.id;
    if (newCode) {
      const st = (
        await pool.query(`SELECT trang_thai FROM "DatLichKham" WHERE ma_dat_lich=$1`, [newCode])
      ).rows[0]?.trang_thai;
      check("Regression C2: lịch mới có trạng thái DA_DAT", st === "DA_DAT", `(thực tế: ${st})`);
    }
    if (apptId) {
      const list = await api("GET", "/appointments", null, pTok);
      check("Regression C2: xem danh sách lịch -> 200", list.status === 200, `(nhận ${list.status})`);
      const c = await api("PATCH", `/appointments/${apptId}/cancel`, null, pTok);
      check("Regression C2: hủy lịch -> 200", c.status === 200, `(nhận ${c.status})`);
      const slot = (
        await pool.query(`SELECT so_slot_da_dat FROM "LichKhamBacSi" WHERE id=$1`, [lich.rows[0].id])
      ).rows[0].so_slot_da_dat;
      check("Regression C2: hủy xong slot được trả lại", Number(slot) === 0, `(so_slot_da_dat=${slot})`);
      r = await checkin(newCode);
      check("Lịch đã hủy không check-in được -> 409", r.status === 409, `(nhận ${r.status})`);
    }
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