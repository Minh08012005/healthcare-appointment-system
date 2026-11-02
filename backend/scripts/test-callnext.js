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

const mkSchedule = (bsId, roomId) =>
  pool.query(
    `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
     VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',1,0,0,'HoatDong')`,
    [bsId, roomId]
  );

// spec: { stt, st, goi, boLuot, appt, owner } ; owner: undefined (Online -> bác sĩ chính, Offline -> NULL) | "other" | "none"
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
  let owner = loai === "ONLINE" ? sc.bsId : null;
  if (spec.owner === "other") owner = sc.otherBsId;
  if (spec.owner === "none") owner = null;
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [apptId, bn, spec.stt, sc.roomId, owner, loai, spec.st || "CHO_KHAM", spec.goi || 0, spec.boLuot || 0]
    )
  ).rows[0].id;
  sc.rows[`${lbl}${spec.stt}`] = { hd, bn, apptCode };
};

const mkScenario = async (name, { on = [], off = [], schedule = true, twoDocs = false } = {}) => {
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
  if (schedule) await mkSchedule(bsId, roomId);
  const sc = { name, roomId, bsId, token: doc.token, rows: {} };

  if (twoDocs) {
    const d2 = await mkUser(roleBS, `e_${name}`);
    const bs2 = (
      await pool.query(
        `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
        [d2.id, `${P} BS ${name}2`, ck]
      )
    ).rows[0].id;
    await mkSchedule(bs2, roomId);
    sc.otherBsId = bs2;
    sc.otherToken = d2.token;
  }

  for (const s of on) await addRow(sc, "ONLINE", s);
  for (const s of off) await addRow(sc, "OFFLINE", s);
  return sc;
};

const nextAs = (token, body) => api("POST", "/queue/next", body || {}, token);
const next = (sc, body) => nextAs(sc.token, body);
// Mô phỏng C3-09: sau khi gọi thành công, bệnh nhân vào khám
const finish = (id) => pool.query(`UPDATE "HangDoi" SET trang_thai='DANG_KHAM' WHERE id=$1`, [id]);
const callAndFinish = async (sc, token) => {
  const r = await nextAs(token || sc.token, {});
  const q = r.data?.data?.queue;
  if (q) await finish(q.id);
  return q ? q.nhan_stt : null;
};
const hdState = async (id) =>
  (await pool.query(`SELECT trang_thai, so_lan_goi, bac_si_id FROM "HangDoi" WHERE id=$1`, [id])).rows[0];

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

    // ---- 1A:1B + thứ tự trong hàng + client không chọn được người + claim lượt chưa gán ----
    const noise = await mkScenario("NOISE", { on: [{ stt: 1 }], off: [{ stt: 1 }] });
    const s1 = await mkScenario("S1", {
      on: [{ stt: 3 }, { stt: 1, appt: true }, { stt: 2 }],
      off: [{ stt: 2 }, { stt: 3 }, { stt: 1 }],
    });

    const order = [];
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const body = i === 0 ? { benh_nhan_id: s1.rows.B3.bn, loai: "OFFLINE" } : {};
      r = await next(s1, body);
      const q = r.data?.data?.queue;
      order.push(q?.nhan_stt);
      ids.push(q?.id);
      if (i === 0) {
        check("Gọi lần 1 -> 200, called=true", r.status === 200 && r.data.data.called === true, `(nhận ${r.status})`);
        check("Client gửi benh_nhan_id/loai bị bỏ qua, vẫn gọi A1", q?.nhan_stt === "A1");
        check("Trả đúng bệnh nhân của A1", r.data?.data?.patient?.id === s1.rows.A1.bn);
        check("Trả đúng lịch hẹn của A1", r.data?.data?.appointment?.ma_dat_lich === s1.rows.A1.apptCode);
        check("Trạng thái vừa gọi là DANG_GOI, so_lan_goi = 1", q?.trang_thai === "DANG_GOI" && q?.so_lan_goi === 1);
      }
      if (q) await finish(q.id); // mô phỏng C3-09: bệnh nhân vào khám
    }
    check("Điều phối 1A:1B đúng thứ tự A1,B1,A2,B2,A3,B3", JSON.stringify(order) === JSON.stringify(["A1", "B1", "A2", "B2", "A3", "B3"]), JSON.stringify(order));
    let allOk = true;
    for (const id of ids) {
      const s = await hdState(id);
      if (!s || s.trang_thai !== "DANG_KHAM" || s.so_lan_goi !== 1 || s.bac_si_id !== s1.bsId) allOk = false;
    }
    check("6 lượt so_lan_goi = 1, đều gán cho bác sĩ gọi (kể cả lượt Offline chưa gán trước đó)", allOk);

    r = await next(s1);
    check("Hết người chờ -> 200, called=false", r.status === 200 && r.data.data.called === false, `(nhận ${r.status})`);
    const n1 = await hdState(noise.rows.A1.hd);
    const n2 = await hdState(noise.rows.B1.hd);
    check("Không lấy bệnh nhân phòng khác", n1.trang_thai === "CHO_KHAM" && n2.trang_thai === "CHO_KHAM" && n1.so_lan_goi === 0);

    // ---- Một hàng rỗng không chặn hàng kia ----
    const s2 = await mkScenario("S2", { off: [{ stt: 1 }, { stt: 2 }] });
    const o2 = [await callAndFinish(s2), await callAndFinish(s2)];
    check("A rỗng, B có -> gọi B1 rồi B2", JSON.stringify(o2) === JSON.stringify(["B1", "B2"]), JSON.stringify(o2));

    const s3 = await mkScenario("S3", { on: [{ stt: 1 }, { stt: 2 }] });
    const o3 = [await callAndFinish(s3), await callAndFinish(s3)];
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
    const keep = await Promise.all(["A1", "A2", "A3", "B1"].map(async (k) => (await hdState(s5.rows[k].hd)).trang_thai));
    check("Các lượt khác không bị đổi trạng thái", JSON.stringify(keep) === JSON.stringify(["DANG_KHAM", "DA_XONG", "BO_LUOT", "VANG_MAT"]), JSON.stringify(keep));

    // ---- Gọi thất bại không tiêu thụ lượt A/B ----
    const s6 = await mkScenario("S6", { on: [{ stt: 1 }, { stt: 2 }], off: [{ stt: 1 }] });
    const c1 = (await next(s6)).data?.data?.queue;
    await pool.query(`UPDATE "HangDoi" SET trang_thai='BO_LUOT', so_lan_bo_luot=1 WHERE id=$1`, [c1.id]); // mô phỏng C3-09: gọi thất bại
    const c2 = (await next(s6)).data?.data?.queue;
    check("Gọi thất bại không tiêu thụ lượt: lượt tiếp vẫn là A2", c1.nhan_stt === "A1" && c2?.nhan_stt === "A2", `(${c1.nhan_stt} -> ${c2?.nhan_stt})`);
    await finish(c2.id);
    const c3 = (await next(s6)).data?.data?.queue;
    check("A2 khám xong -> đến lượt B1", c3?.nhan_stt === "B1", JSON.stringify(c3?.nhan_stt));

    // ---- Đang DANG_GOI thì chưa gọi tiếp (tương tác C3-09) ----
    const s10 = await mkScenario("S10", { on: [{ stt: 1 }, { stt: 2 }], off: [{ stt: 1 }] });
    const d1 = (await next(s10)).data?.data?.queue;
    r = await next(s10);
    check("Đang DANG_GOI -> 409 ALREADY_CALLING", r.status === 409 && r.data.code === "ALREADY_CALLING", `(nhận ${r.status} ${r.data.code || ""})`);
    check("409 trả thông tin người đang gọi (A1)", r.data?.data?.current?.nhan_stt === "A1");
    const a1s = await hdState(s10.rows.A1.hd);
    const a2s = await hdState(s10.rows.A2.hd);
    check("Bị chặn thì không đổi dữ liệu (A1 còn DANG_GOI/1, A2 còn CHO_KHAM/0)", a1s.trang_thai === "DANG_GOI" && a1s.so_lan_goi === 1 && a2s.trang_thai === "CHO_KHAM" && a2s.so_lan_goi === 0);
    await finish(d1.id);
    r = await next(s10);
    check("Xử lý xong người cũ thì gọi tiếp được (B1)", r.status === 200 && r.data?.data?.queue?.nhan_stt === "B1", `(nhận ${r.status} ${r.data?.data?.queue?.nhan_stt})`);

    // ---- Cô lập theo bác sĩ (2 bác sĩ cùng phòng) ----
    const s11 = await mkScenario("S11", {
      twoDocs: true,
      on: [{ stt: 1, owner: "other" }, { stt: 2 }, { stt: 3, owner: "other" }],
      off: [{ stt: 1 }, { stt: 2 }],
    });
    const o11 = [];
    for (let i = 0; i < 3; i++) o11.push(await callAndFinish(s11));
    check("Bác sĩ chỉ gọi A của mình (A2) rồi B1, B2 chưa gán", JSON.stringify(o11) === JSON.stringify(["A2", "B1", "B2"]), JSON.stringify(o11));
    r = await next(s11);
    check("Hết lượt của mình -> called=false (không lấy A1, A3 của bác sĩ kia)", r.status === 200 && r.data.data.called === false, `(nhận ${r.status})`);
    const x1 = await hdState(s11.rows.A1.hd);
    const x3 = await hdState(s11.rows.A3.hd);
    check(
      "Queue của bác sĩ kia không bị đổi",
      x1.trang_thai === "CHO_KHAM" && x1.so_lan_goi === 0 && x1.bac_si_id === s11.otherBsId &&
        x3.trang_thai === "CHO_KHAM" && x3.so_lan_goi === 0 && x3.bac_si_id === s11.otherBsId
    );
    const y1 = await hdState(s11.rows.B1.hd);
    const y2 = await hdState(s11.rows.B2.hd);
    check("Lượt Offline chưa gán được gán cho bác sĩ đã gọi", y1.bac_si_id === s11.bsId && y2.bac_si_id === s11.bsId);
    const oth = await callAndFinish(s11, s11.otherToken);
    check("Bác sĩ kia gọi được A1 của mình", oth === "A1", JSON.stringify(oth));

    const s12 = await mkScenario("S12", {
      twoDocs: true,
      on: [{ stt: 1, owner: "other", st: "DA_XONG" }, { stt: 2, owner: "other", st: "DA_XONG" }, { stt: 3 }],
      off: [{ stt: 1 }],
    });
    r = await next(s12);
    check("Lượt đã gọi của bác sĩ khác không làm lệch A/B của mình (gọi A3, không phải B1)", r.data?.data?.queue?.nhan_stt === "A3", JSON.stringify(r.data?.data?.queue?.nhan_stt));

    const s9 = await mkScenario("S9", { schedule: false });
    r = await next(s9);
    check("Bác sĩ không có lịch hôm nay -> 404", r.status === 404, `(nhận ${r.status})`);

    // ---- Đồng thời ----
    const s7 = await mkScenario("S7", { on: [{ stt: 1 }, { stt: 2 }, { stt: 3 }], off: [{ stt: 1 }, { stt: 2 }] });
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => next(s7)));
    const ok7 = rs.filter((x) => x.status === 200 && x.data?.data?.called === true).length;
    const blocked7 = rs.filter((x) => x.status === 409).length;
    check("Đồng thời (1 bác sĩ, 5 request): đúng 1 gọi được, 4 bị chặn 409", ok7 === 1 && blocked7 === 4, `(called=${ok7}, 409=${blocked7})`);
    const g7 = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "HangDoi" WHERE phong_kham_id=$1 AND trang_thai='DANG_GOI' AND so_lan_goi=1`,
      [s7.roomId]
    );
    check("Đồng thời: DB chỉ có đúng 1 lượt DANG_GOI", g7.rows[0].n === 1);

    const s8 = await mkScenario("S8", { on: [{ stt: 1 }] });
    const rs8 = await Promise.all([1, 2, 3, 4, 5].map(() => next(s8)));
    const ok8 = rs8.filter((x) => x.data?.data?.called === true).length;
    const b8 = rs8.filter((x) => x.status === 409).length;
    check("Đồng thời: 1 người chờ, 5 request -> đúng 1 gọi được", ok8 === 1 && b8 === 4, `(called=${ok8}, 409=${b8})`);
    const g8 = await hdState(s8.rows.A1.hd);
    check("Đồng thời: người đó chỉ được gọi 1 lần", g8.trang_thai === "DANG_GOI" && g8.so_lan_goi === 1);

    const s13 = await mkScenario("S13", { twoDocs: true, off: [{ stt: 1 }] });
    const [p, q2] = await Promise.all([next(s13), nextAs(s13.otherToken, {})]);
    const calledN = [p, q2].filter((z) => z.data?.data?.called === true).length;
    const emptyN = [p, q2].filter((z) => z.status === 200 && z.data?.data?.called === false).length;
    check("2 bác sĩ cùng giành 1 lượt chưa gán -> đúng 1 người gọi được", calledN === 1 && emptyN === 1, `(called=${calledN}, rỗng=${emptyN})`);
    const g13 = await hdState(s13.rows.B1.hd);
    check("Lượt đó chỉ được gọi 1 lần, gán cho đúng 1 bác sĩ", g13.trang_thai === "DANG_GOI" && g13.so_lan_goi === 1 && !!g13.bac_si_id);

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