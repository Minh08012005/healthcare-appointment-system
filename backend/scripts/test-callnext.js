const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong"; // phải giống auth.controller
const sfx = Date.now().toString().slice(-6);
const P = `ZZQ${sfx}`;
let pass = 0, fail = 0, seq = 0;
let roleBS, roleLT, ck, pwHash;

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
  const username = `zzq${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const addRow = async (sc, loai, spec) => {
  const lbl = loai === "ONLINE" ? "A" : "B";
  const bn = (
    await pool.query(`INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id`, [`${P} BN ${sc.name} ${lbl}${spec.stt}`])
  ).rows[0].id;
  let apptId = null, apptCode = null;
  if (spec.appt) {
    apptCode = `${P}-${++seq}`;
    apptId = (
      await pool.query(
        `INSERT INTO "DatLichKham" (ma_dat_lich, benh_nhan_id, bac_si_id, phong_kham_id, ngay_kham, gio_kham, trang_thai, qr_code)
         VALUES ($1,$2,$3,$4,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'08:00','DA_CHECK_IN',$5) RETURNING id`,
        [apptCode, bn, sc.bsId, sc.roomId, apptCode]
      )
    ).rows[0].id;
  }
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [apptId, bn, spec.stt, sc.roomId, loai === "ONLINE" ? sc.bsId : null, loai, spec.st || "CHO_KHAM", spec.goi || 0, spec.boLuot || 0]
    )
  ).rows[0].id;
  sc.rows[`${lbl}${spec.stt}`] = { hd, bn, apptCode };
};

const mkScenario = async (name, { on = [], off = [], schedule = true } = {}) => {
  const roomId = (
    await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} ${name}`, ck])
  ).rows[0].id;
  const doc = await mkUser(roleBS, `d_${name}`);
  const bsId = (
    await pool.query(
      `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
      [doc.id, `${P} BS ${name}`, ck]
    )
  ).rows[0].id;
  if (schedule) {
    await pool.query(
      `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',1,0,0,'HoatDong')`,
      [bsId, roomId]
    );
  }
  const sc = { name, roomId, bsId, token: doc.token, rows: {} };
  for (const s of on) await addRow(sc, "ONLINE", s);
  for (const s of off) await addRow(sc, "OFFLINE", s);
  return sc;
};

const next = (sc, body) => api("POST", "/queue/next", body || {}, sc.token);
const hdState = async (id) =>
  (await pool.query(`SELECT trang_thai, so_lan_goi FROM "HangDoi" WHERE id=$1`, [id])).rows[0];

const cleanup = async () => {
  try {
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "DatLichKham" WHERE ma_dat_lich LIKE $1`, [`${P}-%`]);
    await pool.query(`DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [`${P} BN %`, `zzq${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zzq${sfx}_%`]);
    const left = await pool.query(
      `SELECT (SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1) AS tk,
              (SELECT COUNT(*) FROM "PhongKham" WHERE ten_phong LIKE $2) AS pk,
              (SELECT COUNT(*) FROM "BenhNhan" WHERE ho_ten LIKE $3) AS bn`,
      [`zzq${sfx}_%`, `${P} %`, `${P} BN %`]
    );
    const l = left.rows[0];
    console.log(`\nDọn dữ liệu xong. Còn sót: TaiKhoan=${l.tk}, PhongKham=${l.pk}, BenhNhan=${l.bn} (phải = 0)`);
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

    // ---- Quyền ----
    let r = await api("POST", "/queue/next", {});
    check("Không đăng nhập -> 401", r.status === 401, `(nhận ${r.status})`);

    const ptName = `zzq${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;
    r = await api("POST", "/queue/next", {}, ptTok);
    check("Bệnh nhân -> 403", r.status === 403, `(nhận ${r.status})`);

    const lt = await mkUser(roleLT, "lt");
    r = await api("POST", "/queue/next", {}, lt.token);
    check("Lễ tân -> 403", r.status === 403, `(nhận ${r.status})`);

    // ---- Dữ liệu ----
    const noise = await mkScenario("NOISE", { on: [{ stt: 1 }], off: [{ stt: 1 }] });
    const s1 = await mkScenario("S1", {
      on: [{ stt: 3 }, { stt: 1, appt: true }, { stt: 2 }], // chèn lộn thứ tự để kiểm tra ORDER BY
      off: [{ stt: 2 }, { stt: 3 }, { stt: 1 }],
    });

    // ---- 1A:1B + thứ tự trong hàng + client không chọn được người ----
    const order = [];
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const body = i === 0 ? { benh_nhan_id: s1.rows.B3.bn, loai: "OFFLINE" } : {};
      r = await next(s1, body);
      order.push(r.data?.data?.queue?.nhan_stt);
      ids.push(r.data?.data?.queue?.id);
      if (i === 0) {
        check("Gọi lần 1 -> 200, called=true", r.status === 200 && r.data.data.called === true, `(nhận ${r.status})`);
        check("Client gửi benh_nhan_id/loai bị bỏ qua, vẫn gọi A1", r.data?.data?.queue?.nhan_stt === "A1");
        check("Trả đúng bệnh nhân của A1", r.data?.data?.patient?.id === s1.rows.A1.bn);
        check("Trả đúng thông tin lịch hẹn của A1", r.data?.data?.appointment?.ma_dat_lich === s1.rows.A1.apptCode);
      }
    }
    check("Điều phối 1A:1B đúng thứ tự A1,B1,A2,B2,A3,B3", JSON.stringify(order) === JSON.stringify(["A1", "B1", "A2", "B2", "A3", "B3"]), JSON.stringify(order));
    let allOk = true;
    for (const id of ids) {
      const s = await hdState(id);
      if (!s || s.trang_thai !== "DANG_GOI" || s.so_lan_goi !== 1) allOk = false;
    }
    check("6 lượt đều DANG_GOI và so_lan_goi = 1", allOk);

    r = await next(s1);
    check("Hết người chờ -> 200, called=false", r.status === 200 && r.data.data.called === false, `(nhận ${r.status})`);
    const n1 = await hdState(noise.rows.A1.hd);
    const n2 = await hdState(noise.rows.B1.hd);
    check("Không lấy bệnh nhân phòng khác", n1.trang_thai === "CHO_KHAM" && n2.trang_thai === "CHO_KHAM" && n1.so_lan_goi === 0);

    // ---- Một hàng rỗng không chặn hàng kia ----
    const s2 = await mkScenario("S2", { off: [{ stt: 1 }, { stt: 2 }] });
    const o2 = [(await next(s2)).data?.data?.queue?.nhan_stt, (await next(s2)).data?.data?.queue?.nhan_stt];
    check("A rỗng, B có -> gọi B1 rồi B2", JSON.stringify(o2) === JSON.stringify(["B1", "B2"]), JSON.stringify(o2));

    const s3 = await mkScenario("S3", { on: [{ stt: 1 }, { stt: 2 }] });
    const o3 = [(await next(s3)).data?.data?.queue?.nhan_stt, (await next(s3)).data?.data?.queue?.nhan_stt];
    check("B rỗng, A có -> gọi A1 rồi A2", JSON.stringify(o3) === JSON.stringify(["A1", "A2"]), JSON.stringify(o3));

    const s4 = await mkScenario("S4", {});
    r = await next(s4);
    check("A và B đều rỗng -> 200, called=false", r.status === 200 && r.data.data.called === false, `(nhận ${r.status})`);

    // ---- Chỉ lấy lượt CHO_KHAM ----
    const s5 = await mkScenario("S5", {
      on: [{ stt: 1, st: "DANG_KHAM" }, { stt: 2, st: "DA_XONG" }, { stt: 3, st: "BO_LUOT" }, { stt: 4 }],
      off: [{ stt: 1, st: "VANG_MAT" }],
    });
    r = await next(s5);
    check("Chỉ lấy lượt CHO_KHAM (A4)", r.data?.data?.queue?.nhan_stt === "A4", JSON.stringify(r.data?.data?.queue?.nhan_stt));
    const keep = await Promise.all(
      ["A1", "A2", "A3", "B1"].map(async (k) => (await hdState(s5.rows[k].hd)).trang_thai)
    );
    check("Các lượt khác không bị đổi trạng thái", JSON.stringify(keep) === JSON.stringify(["DANG_KHAM", "DA_XONG", "BO_LUOT", "VANG_MAT"]), JSON.stringify(keep));

    // ---- Gọi thất bại không tiêu thụ lượt A/B ----
    const s6 = await mkScenario("S6", { on: [{ stt: 1 }, { stt: 2 }], off: [{ stt: 1 }] });
    const c1 = (await next(s6)).data?.data?.queue;
    await pool.query(`UPDATE "HangDoi" SET trang_thai='BO_LUOT', so_lan_bo_luot=1 WHERE id=$1`, [c1.id]); // mô phỏng C3-09: gọi thất bại
    const c2 = (await next(s6)).data?.data?.queue;
    check("Gọi thất bại không tiêu thụ lượt: lượt tiếp vẫn là A2", c1.nhan_stt === "A1" && c2?.nhan_stt === "A2", `(${c1.nhan_stt} -> ${c2?.nhan_stt})`);
    const c3 = (await next(s6)).data?.data?.queue;
    check("Sau đó đến lượt B1", c3?.nhan_stt === "B1", JSON.stringify(c3?.nhan_stt));

    // ---- Không có lịch hôm nay ----
    const s9 = await mkScenario("S9", { schedule: false });
    r = await next(s9);
    check("Bác sĩ không có lịch hôm nay -> 404", r.status === 404, `(nhận ${r.status})`);

    // ---- Đồng thời ----
    const s7 = await mkScenario("S7", {
      on: [{ stt: 1 }, { stt: 2 }, { stt: 3 }],
      off: [{ stt: 1 }, { stt: 2 }],
    });
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => next(s7)));
    const labels = rs.map((x) => x.data?.data?.queue?.nhan_stt).filter(Boolean);
    check("Đồng thời: 5 request gọi 5 người khác nhau", new Set(labels).size === 5 && rs.every((x) => x.status === 200), JSON.stringify(labels.sort()));
    const dbS7 = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "HangDoi" WHERE phong_kham_id=$1 AND trang_thai='DANG_GOI' AND so_lan_goi=1`,
      [s7.roomId]
    );
    check("Đồng thời: DB có đúng 5 lượt DANG_GOI, so_lan_goi=1", dbS7.rows[0].n === 5);

    const s8 = await mkScenario("S8", { on: [{ stt: 1 }] });
    const rs8 = await Promise.all([1, 2, 3, 4, 5].map(() => next(s8)));
    const okN = rs8.filter((x) => x.data?.data?.called === true).length;
    const noN = rs8.filter((x) => x.status === 200 && x.data?.data?.called === false).length;
    check("Đồng thời: 1 người chờ, 5 request -> đúng 1 request gọi được", okN === 1 && noN === 4, `(called=${okN}, rỗng=${noN})`);
    const g = await hdState(s8.rows.A1.hd);
    check("Đồng thời: người đó chỉ được gọi 1 lần", g.trang_thai === "DANG_GOI" && g.so_lan_goi === 1);

    // ---- Regression ----
    r = await api("GET", "/health");
    check("Regression /health -> 200", r.status === 200);
    r = await api("GET", "/auth/me", null, ptTok);
    check("Regression /auth/me -> 200", r.status === 200);
    r = await api("POST", "/checkin/online", { ma_dat_lich: "x" });
    check("Regression: /checkin/online vẫn mount (401 khi chưa đăng nhập)", r.status === 401, `(nhận ${r.status})`);
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