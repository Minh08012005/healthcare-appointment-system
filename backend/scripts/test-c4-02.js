const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const STATUS_ACTIVE = "HoatDong"; // phải giống auth.controller
// Trạng thái HoSoBenhAn: chỉnh theo C4-01 nếu khác (xem dòng INFO ở cuối bài test)
const HS_DANG_KHAM = "DANG_KHAM";
const HS_DONE = "HOAN_THANH";
const sfx = Date.now().toString().slice(-6);
const P = `ZZE${sfx}`;
let pass = 0, fail = 0, n = 0, roleBS, roleLT, ck, pwHash;

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
const get = (path, token) => api("GET", path, null, token);

const mkUser = async (roleId, tag) => {
  const username = `zze${sfx}_${tag}`;
  const r = await pool.query(
    `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
    [username, pwHash, roleId, STATUS_ACTIVE]
  );
  const login = await api("POST", "/auth/login", { username, password: "123456" });
  return { id: r.rows[0].id, token: login.data?.data?.token };
};

const mkRoom = async (name) =>
  (await pool.query(`INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong) VALUES ($1,$2,'Test') RETURNING id`, [`${P} ${name}`, ck])).rows[0].id;

// Lịch khám cả ngày hôm nay: một số API (như Start sau C4-01) có thể cần bác sĩ có lịch trong phòng
const mkSchedule = (bsId, roomId) =>
  pool.query(
    `INSERT INTO "LichKhamBacSi" (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
     VALUES ($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59',1,0,0,'HoatDong')`,
    [bsId, roomId]
  );

const mkDoctor = async (tag, roomId = null) => {
  const u = await mkUser(roleBS, `d_${tag}`);
  const bsId = (
    await pool.query(
      `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac) VALUES ($1,$2,$3,0,'Test') RETURNING id`,
      [u.id, `${P} BS ${tag}`, ck]
    )
  ).rows[0].id;
  if (roomId) await mkSchedule(bsId, roomId);
  return { bsId, token: u.token, name: `${P} BS ${tag}` };
};

const mkPatient = async (tag) =>
  (
    await pool.query(
      `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, ma_bhyt, dia_chi) VALUES ($1,'1990-05-20','Nam',$2,'Ha Noi') RETURNING id`,
      [`${P} BN ${tag}`, `${P}${++n}`]
    )
  ).rows[0].id;

// o: { stt, loai, hdBs, hsBs, days (số ngày trước; âm = tương lai), hdState, hsState, kq: {tc,cd,ld,dt} }
const addVisit = async (roomId, bnId, o) => {
  const days = o.days || 0;
  const hd = (
    await pool.query(
      `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot, thoi_gian_check_in)
       VALUES ($1,$2,$3,$4,$5,$6,1,0, NOW() - ($7::int * interval '1 day')) RETURNING id`,
      [bnId, o.stt, roomId, o.hdBs ?? null, o.loai || "ONLINE", o.hdState || "DA_XONG", days]
    )
  ).rows[0].id;
  const hs = (
    await pool.query(
      `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1,$2,$3,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - $4::int, $5) RETURNING id`,
      [hd, bnId, o.hsBs ?? null, days, o.hsState || HS_DONE]
    )
  ).rows[0].id;
  if (o.kq) {
    await pool.query(
      `INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc) VALUES ($1,$2,$3,$4,$5)`,
      [hs, o.kq.tc, o.kq.cd, o.kq.ld, o.kq.dt]
    );
  }
  return { hd, hs };
};

// Ảnh chụp dữ liệu để chứng minh API chỉ đọc
const snapshot = async () => {
  const q = async (sql) => JSON.stringify((await pool.query(sql, [`${P} BN %`])).rows);
  return (
    (await q(`SELECT hs.id, hs.trang_thai, hs.bac_si_id, hs.hang_doi_id FROM "HoSoBenhAn" hs JOIN "BenhNhan" b ON b.id = hs.benh_nhan_id WHERE b.ho_ten LIKE $1 ORDER BY hs.id`)) +
    (await q(`SELECT k.* FROM "KetQuaKham" k JOIN "HoSoBenhAn" hs ON hs.id = k.ho_so_id JOIN "BenhNhan" b ON b.id = hs.benh_nhan_id WHERE b.ho_ten LIKE $1 ORDER BY k.id`)) +
    (await q(`SELECT h.id, h.trang_thai, h.so_lan_goi, h.so_lan_bo_luot FROM "HangDoi" h JOIN "BenhNhan" b ON b.id = h.benh_nhan_id WHERE b.ho_ten LIKE $1 ORDER BY h.id`))
  );
};

const cleanup = async () => {
  try {
    const pat = `SELECT id FROM "BenhNhan" WHERE ho_ten LIKE $1`;
    await pool.query(`DELETE FROM "KetQuaKham" WHERE ho_so_id IN (SELECT id FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat}))`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HoSoBenhAn" WHERE benh_nhan_id IN (${pat})`, [`${P} BN %`]);
    await pool.query(`DELETE FROM "HangDoi" WHERE phong_kham_id IN (SELECT id FROM "PhongKham" WHERE ten_phong LIKE $1)`, [`${P} %`]);
    await pool.query(`DELETE FROM "LichKhamBacSi" WHERE bac_si_id IN (SELECT id FROM "BacSi" WHERE ho_ten LIKE $1)`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "BacSi" WHERE ho_ten LIKE $1`, [`${P} BS %`]);
    await pool.query(`DELETE FROM "PhongKham" WHERE ten_phong LIKE $1`, [`${P} %`]);
    await pool.query(
      `DELETE FROM "BenhNhan" WHERE ho_ten LIKE $1 OR tai_khoan_id IN (SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $2)`,
      [`${P} BN %`, `zze${sfx}_%`]
    );
    await pool.query(`DELETE FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1`, [`zze${sfx}_%`]);
    const l = (
      await pool.query(
        `SELECT (SELECT COUNT(*) FROM "TaiKhoan" WHERE ten_dang_nhap LIKE $1) AS tk,
                (SELECT COUNT(*) FROM "PhongKham" WHERE ten_phong LIKE $2) AS pk,
                (SELECT COUNT(*) FROM "BenhNhan" WHERE ho_ten LIKE $3) AS bn`,
        [`zze${sfx}_%`, `${P} %`, `${P} BN %`]
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
    roleBS = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`)).rows[0].id;
    roleLT = (await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`)).rows[0].id;
    ck = (await pool.query(`SELECT id FROM "ChuyenKhoa" ORDER BY id LIMIT 1`)).rows[0].id;

    const room1 = await mkRoom("R1");
    const docA = await mkDoctor("A", room1); // có lịch hôm nay trong room1
    const docB = await mkDoctor("B", room1);
    const lt = await mkUser(roleLT, "lt");
    const ptName = `zze${sfx}_pt`;
    await api("POST", "/auth/register", { username: ptName, password: "123456", ho_ten: "ZZ Test Patient" });
    const ptTok = (await api("POST", "/auth/login", { username: ptName, password: "123456" })).data.data.token;

    // Bệnh nhân P: hồ sơ hiện tại + 2 hồ sơ cũ + 1 hồ sơ "ngày mai" (không được tính là lịch sử)
    const patP = await mkPatient("P");
    const old1 = await addVisit(room1, patP, { stt: 1, hdBs: docB.bsId, hsBs: docB.bsId, days: 2, kq: { tc: "Sot cao", cd: "Cam cum", ld: "Nghi ngoi", dt: "Paracetamol" } });
    const old2 = await addVisit(room1, patP, { stt: 2, hdBs: docA.bsId, hsBs: docA.bsId, days: 5, kq: { tc: "Dau hong", cd: "Viem hong", ld: "Uong nuoc am", dt: "Amoxicillin" } });
    const later = await addVisit(room1, patP, { stt: 3, hdBs: docA.bsId, hsBs: docA.bsId, days: -1, kq: { tc: "Tai kham", cd: null, ld: null, dt: null } });
    const cur = await addVisit(room1, patP, { stt: 7, hdBs: docA.bsId, hsBs: docA.bsId, hdState: "DANG_KHAM", hsState: HS_DANG_KHAM, kq: { tc: "Ho keo dai", cd: null, ld: null, dt: null } });

    // Bệnh nhân khác của cùng bác sĩ A (không được lẫn vào lịch sử của P)
    const patOther = await mkPatient("OTHER");
    const other = await addVisit(room1, patOther, { stt: 8, hdBs: docA.bsId, hsBs: docA.bsId, days: 1, kq: { tc: "Dau bung", cd: "Viem da day", ld: "An nhat", dt: "Omeprazole" } });

    // Bệnh nhân Q: Offline, hồ sơ chưa gán bác sĩ (chủ qua HangDoi), chưa có KetQuaKham, chưa có lịch sử
    const patQ = await mkPatient("Q");
    const curQ = await addVisit(room1, patQ, { stt: 9, loai: "OFFLINE", hdBs: docA.bsId, hsBs: null, hdState: "DANG_KHAM", hsState: HS_DANG_KHAM });

    // Hồ sơ của bác sĩ B
    const patX = await mkPatient("X");
    const curX = await addVisit(room1, patX, { stt: 10, hdBs: docB.bsId, hsBs: docB.bsId, hdState: "DANG_KHAM", hsState: HS_DANG_KHAM });

    // Hồ sơ mồ côi: không bác sĩ, không HangDoi
    const patZ = await mkPatient("Z");
    const orphan = (
      await pool.query(`INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, trang_thai) VALUES (NULL,$1,NULL,$2) RETURNING id`, [patZ, HS_DANG_KHAM])
    ).rows[0].id;

    const before = await snapshot();

    // ---- Xác thực và quyền theo vai trò ----
    for (const path of [`/examinations/${cur.hs}`, `/examinations/${cur.hs}/history`]) {
      let r = await get(path);
      check(`${path} - không đăng nhập -> 401`, r.status === 401, `(nhận ${r.status})`);
      r = await get(path, ptTok);
      check(`${path} - bệnh nhân -> 403`, r.status === 403, `(nhận ${r.status})`);
      r = await get(path, lt.token);
      check(`${path} - lễ tân -> 403`, r.status === 403, `(nhận ${r.status})`);
    }

    // ---- ho_so_id không hợp lệ / không tồn tại ----
    for (const bad of ["abc", "0", "-5", "1.5", "99999999999"]) {
      const r = await get(`/examinations/${bad}`, docA.token);
      check(`ho_so_id="${bad}" -> 400`, r.status === 400, `(nhận ${r.status})`);
    }
    let r = await get(`/examinations/999999999`, docA.token);
    check("ho_so_id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get(`/examinations/999999999/history`, docA.token);
    check("history của ho_so_id không tồn tại -> 404", r.status === 404, `(nhận ${r.status})`);
    r = await get(`/examinations/abc/history`, docA.token);
    check("history ho_so_id sai định dạng -> 400", r.status === 400, `(nhận ${r.status})`);

    // ---- Hồ sơ hiện tại (DANG_KHAM) ----
    r = await get(`/examinations/${cur.hs}`, docA.token);
    const d = r.data?.data;
    check("Bác sĩ đọc hồ sơ DANG_KHAM của mình -> 200", r.status === 200, `(nhận ${r.status})`);
    check("Trả đúng hồ sơ và ngày khám", d?.ho_so?.id === cur.hs && /^\d{4}-\d{2}-\d{2}$/.test(d?.ho_so?.ngay_kham || ""));
    check("Trả đúng thông tin bệnh nhân", d?.patient?.id === patP && d.patient.ho_ten === `${P} BN P` && d.patient.gioi_tinh === "Nam" && d.patient.ngay_sinh === "1990-05-20" && !!d.patient.ma_bhyt && d.patient.dia_chi === "Ha Noi");
    check("Trả đúng HangDoi (DANG_KHAM, nhãn A7)", d?.queue?.id === cur.hd && d.queue.trang_thai === "DANG_KHAM" && d.queue.nhan_stt === "A7");
    check("Trả đúng bác sĩ và phòng", d?.doctor?.id === docA.bsId && d.doctor.ho_ten === docA.name && d?.room?.id === room1 && !!d.room.ten_phong && !!d.room.ten_chuyen_khoa);
    check("Trả KetQuaKham hiện có", d?.ket_qua_kham?.trieu_chung_ghi_nhan === "Ho keo dai" && d.ket_qua_kham.chan_doan === null);
    check("Không lộ số CCCD/hộ chiếu", !JSON.stringify(r.data).includes("so_cccd"));

    r = await get(`/examinations/${curQ.hs}`, docA.token);
    check("Hồ sơ Offline chưa gán bác sĩ nhưng HangDoi thuộc bác sĩ -> 200", r.status === 200 && r.data?.data?.patient?.id === patQ, `(nhận ${r.status})`);
    check("Chưa có KetQuaKham -> ket_qua_kham = null, không lỗi", r.data?.data?.ket_qua_kham === null && r.data?.data?.appointment === null);
    check("Hồ sơ Offline: nhãn B9, doctor lấy qua HangDoi", r.data?.data?.queue?.nhan_stt === "B9" && r.data?.data?.doctor?.id === docA.bsId);

    // ---- Quyền theo bác sĩ ----
    r = await get(`/examinations/${cur.hs}`, docB.token);
    check("Bác sĩ B đọc hồ sơ của bác sĩ A -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get(`/examinations/${cur.hs}/history`, docB.token);
    check("Bác sĩ B đọc lịch sử qua hồ sơ của bác sĩ A -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get(`/examinations/${curX.hs}`, docA.token);
    check("Bác sĩ A đọc hồ sơ của bác sĩ B -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get(`/examinations/${orphan}`, docA.token);
    check("Hồ sơ không thuộc bác sĩ nào -> 403", r.status === 403, `(nhận ${r.status})`);
    r = await get(`/examinations/${other.hs}`, docA.token);
    check("Hồ sơ của bệnh nhân khác nhưng do chính bác sĩ khám -> 200", r.status === 200 && r.data?.data?.patient?.id === patOther, `(nhận ${r.status})`);

    // ---- Lịch sử khám ----
    r = await get(`/examinations/${cur.hs}/history`, docA.token);
    const hist = r.data?.data?.history || [];
    const ids = hist.map((x) => x.ho_so_id);
    check("History -> 200", r.status === 200, `(nhận ${r.status})`);
    check("Lấy đúng 2 hồ sơ trước, mới nhất trước", JSON.stringify(ids) === JSON.stringify([old1.hs, old2.hs]), JSON.stringify(ids));
    check("Không có hồ sơ hiện tại, hồ sơ ngày mai, hay của bệnh nhân khác", !ids.includes(cur.hs) && !ids.includes(later.hs) && !ids.includes(other.hs));
    check("Mỗi lần có ngày, bác sĩ, triệu chứng, chẩn đoán, lời dặn, đơn thuốc", hist.length === 2 && hist.every((x) => x.ngay_kham && x.doctor?.ho_ten && x.trieu_chung && x.chan_doan && x.loi_dan && x.don_thuoc));
    check("Dữ liệu lịch sử đúng nội dung", hist[0]?.chan_doan === "Cam cum" && hist[0].doctor.id === docB.bsId && hist[1]?.don_thuoc === "Amoxicillin" && hist[1].doctor.id === docA.bsId);
    check("Lịch sử của hồ sơ ngày mai gồm 3 hồ sơ trước đó (cur, old1, old2)", JSON.stringify(((await get(`/examinations/${later.hs}/history`, docA.token)).data?.data?.history || []).map((x) => x.ho_so_id)) === JSON.stringify([cur.hs, old1.hs, old2.hs]));

    r = await get(`/examinations/${curQ.hs}/history`, docA.token);
    check("Bệnh nhân chưa có lịch sử -> 200, danh sách rỗng", r.status === 200 && Array.isArray(r.data?.data?.history) && r.data.data.history.length === 0, `(nhận ${r.status})`);

    r = await get(`/examinations/${cur.hs}/history?limit=1`, docA.token);
    check("limit=1 -> chỉ trả 1 hồ sơ gần nhất", r.status === 200 && r.data?.data?.history?.length === 1 && r.data.data.history[0].ho_so_id === old1.hs);
    for (const badLimit of ["0", "51", "abc", "-1", "1.5"]) {
      r = await get(`/examinations/${cur.hs}/history?limit=${badLimit}`, docA.token);
      check(`limit=${badLimit} -> 400`, r.status === 400, `(nhận ${r.status})`);
    }

    // ---- Chỉ đọc ----
    const after = await snapshot();
    check("Hai API chỉ đọc: dữ liệu HoSoBenhAn/KetQuaKham/HangDoi không đổi", before === after);

    // ---- Regression + tích hợp với Start Examination (C3-09 / C4-01) ----
    r = await get("/health");
    check("Regression /health -> 200", r.status === 200);

    const patS = await mkPatient("S");
    const hdS = (
      await pool.query(
        `INSERT INTO "HangDoi" (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
         VALUES ($1,11,$2,$3,'ONLINE','DANG_GOI',1,0) RETURNING id`,
        [patS, room1, docA.bsId]
      )
    ).rows[0].id;

    r = await api("POST", `/queue/${hdS}/start`, null, docA.token);
    const startData = r.data?.data;
    const hoSoFromStart = startData?.ho_so_id ?? startData?.ho_so?.id ?? startData?.queue?.ho_so_id ?? null;
    check("Regression C3: Start Examination -> 200", r.status === 200, `(nhận ${r.status}) ${JSON.stringify(r.data)}`);
    const hdAfter = (await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id=$1`, [hdS])).rows[0];
    check("Regression C3: HangDoi chuyển DANG_GOI -> DANG_KHAM", hdAfter?.trang_thai === "DANG_KHAM", `(thực tế: ${hdAfter?.trang_thai})`);
    check("Start Examination trả ho_so_id trong response", Number.isInteger(hoSoFromStart), JSON.stringify(r.data));

    const hsDb = (await pool.query(`SELECT id, trang_thai, bac_si_id FROM "HoSoBenhAn" WHERE hang_doi_id=$1 ORDER BY id DESC LIMIT 1`, [hdS])).rows[0];
    check("Start Examination tạo HoSoBenhAn gắn đúng HangDoi", !!hsDb, JSON.stringify(hsDb));
    if (hsDb) {
      console.log("INFO  HoSoBenhAn sau Start:", JSON.stringify(hsDb), "(đối chiếu HS_DANG_KHAM ở đầu file)");
      if (Number.isInteger(hoSoFromStart)) {
        check("ho_so_id trong response khớp HoSoBenhAn trong DB", hoSoFromStart === hsDb.id, `(response ${hoSoFromStart}, DB ${hsDb.id})`);
      }
      const hsId = Number.isInteger(hoSoFromStart) ? hoSoFromStart : hsDb.id;
      r = await get(`/examinations/${hsId}`, docA.token);
      check(
        "Integration C4-01 -> C4-02: mở hồ sơ bằng ho_so_id từ Start -> 200",
        r.status === 200 && r.data?.data?.patient?.id === patS && r.data?.data?.queue?.id === hdS && r.data?.data?.queue?.trang_thai === "DANG_KHAM",
        `(nhận ${r.status}) ${JSON.stringify(r.data?.message || "")}`
      );
      r = await get(`/examinations/${hsId}`, docB.token);
      check("Integration: bác sĩ khác mở hồ sơ vừa tạo từ Start -> 403", r.status === 403, `(nhận ${r.status})`);
      r = await get(`/examinations/${hsId}/history`, docA.token);
      check("Integration: bệnh nhân mới -> history rỗng", r.status === 200 && r.data?.data?.history?.length === 0, `(nhận ${r.status})`);
    }

    r = await api("POST", "/queue/next", {}, null);
    check("Regression C3-08: /queue/next vẫn yêu cầu đăng nhập", r.status === 401, `(nhận ${r.status})`);
    r = await get(`/reception/queue?phong_kham_id=${room1}`, lt.token);
    check("Regression C3-06: Lễ tân vẫn xem được hàng đợi", r.status === 200, `(nhận ${r.status})`);
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