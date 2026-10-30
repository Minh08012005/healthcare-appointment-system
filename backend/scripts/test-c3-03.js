process.env.C3_JOB_DRY_RUN = "false"; // test phải ghi thật (chỉ lên dòng fixture)
const fs = require("fs");
const path = require("path");
const jobSrc = fs.readFileSync(
  path.join(__dirname, "../src/jobs/checkinBackground.job.js"),
  "utf8"
);
if (!jobSrc.includes("onlyIds")) {
  console.error(
    "DỪNG: file job chưa có tham số onlyIds. Chạy test lúc này sẽ GHI THẬT lên cả các lịch DA_DAT của người khác (116, 121, 120)."
  );
  process.exit(1);
}
const pool = require("../src/config/db");
const { xuLyQuaHan, xuLyDenGio } = require("../src/jobs/checkinBackground.job");

const ketQua = [];
const check = (ten, ok, chiTiet = "") => {
  ketQua.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${ten}${ok ? "" : "  -> " + chiTiet}`);
};
const one = async (sql, p = []) => (await pool.query(sql, p)).rows[0];

const lichIds = [];
let slotId = null;

const taoLich = async (b, trangThai, ngay, gio, duoi) => {
  const r = await pool.query(
        `INSERT INTO "DatLichKham"
       (ma_dat_lich, benh_nhan_id, bac_si_id, phong_kham_id, chuyen_khoa_id,
        ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai, qr_code)
     VALUES ($1::text, $2, $3, $4, $5, $6, $7, 'TEST C3-03', $8, $9, $1::text)
     RETURNING id;`,
    [`TESTC303-${Date.now()}-${duoi}`, b.benh_nhan_id, b.bac_si_id, b.phong_id,
     b.chuyen_khoa_id, ngay, gio, b.muc_phi, trangThai]
  );
  lichIds.push(r.rows[0].id);
  return r.rows[0].id;
};

const trangThaiLich = async (id) =>
  (await one(`SELECT trang_thai FROM "DatLichKham" WHERE id = $1;`, [id])).trang_thai;
const hangDoiCua = async (id) =>
  (await pool.query(
    `SELECT so_thu_tu, loai, trang_thai, so_lan_goi, so_lan_bo_luot
     FROM "HangDoi" WHERE dat_lich_id = $1;`, [id])).rows;

(async () => {
  try {
    const b = await one(
      `SELECT (SELECT id FROM "BenhNhan" ORDER BY id LIMIT 1) AS benh_nhan_id,
              bs.id AS bac_si_id, bs.chuyen_khoa_id, bs.muc_phi, pk.id AS phong_id
       FROM "LichKhamBacSi" l
       JOIN "BacSi" bs ON bs.id = l.bac_si_id
       JOIN "PhongKham" pk ON pk.id = l.phong_kham_id
       ORDER BY l.id LIMIT 1;`
    );
    if (!b || !b.benh_nhan_id) throw new Error("Thiếu dữ liệu nền (bệnh nhân/bác sĩ/phòng)");

    const d = await one(
      `SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 30)::text AS qua,
              ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 10)::text AS tuong_lai;`
    );
    const GIO_QUA = "03:33:00";

    // Slot fixture: đang có 3 lượt đặt để kiểm tra việc trả slot đúng 1 lần
    const slot = await one(
      `INSERT INTO "LichKhamBacSi"
         (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc,
          so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       VALUES ($1, $2, $3, $4, '04:33:00', 6, 4, 3, 'HoatDong') RETURNING id;`,
      [b.bac_si_id, b.phong_id, d.qua, GIO_QUA]
    );
    slotId = slot.id;

    const qh = await taoLich(b, "DA_DAT", d.qua, GIO_QUA, "qh");          // quá hạn
    const chuaHan = await taoLich(b, "DA_DAT", d.tuong_lai, "10:00:00", "ch"); // chưa tới hạn
    const a1 = await taoLich(b, "DA_CHECK_IN", d.qua, "05:00:00", "a1");   // đã tới giờ
    const a2 = await taoLich(b, "DA_CHECK_IN", d.qua, "05:30:00", "a2");   // đã tới giờ
    const aTuongLai = await taoLich(b, "DA_CHECK_IN", d.tuong_lai, "10:00:00", "at");

    console.log("=== Việc B: quá hạn ===");
    await Promise.all([
      xuLyQuaHan(10, [qh, chuaHan, a1]),
      xuLyQuaHan(10, [qh, chuaHan, a1]),
    ]);
    check("DA_DAT đã quá giờ -> QUA_HAN_CHECK_IN", (await trangThaiLich(qh)) === "QUA_HAN_CHECK_IN");
    check("DA_DAT còn xa giờ hẹn -> giữ nguyên DA_DAT", (await trangThaiLich(chuaHan)) === "DA_DAT");
    check("DA_CHECK_IN không bị việc B đụng tới", (await trangThaiLich(a1)) === "DA_CHECK_IN");
    let s = await one(`SELECT so_slot_da_dat FROM "LichKhamBacSi" WHERE id = $1;`, [slotId]);
    check("Chạy trùng 2 lần song song: trả slot đúng 1 lần (3 -> 2)", s.so_slot_da_dat === 2, `da_dat=${s.so_slot_da_dat}`);
    await xuLyQuaHan(10, [qh, chuaHan, a1]);
    s = await one(`SELECT so_slot_da_dat FROM "LichKhamBacSi" WHERE id = $1;`, [slotId]);
    check("Chạy lại lần nữa: không trả thêm slot (vẫn 2)", s.so_slot_da_dat === 2, `da_dat=${s.so_slot_da_dat}`);

    console.log("=== Việc A: đến giờ -> hàng đợi Online ===");
    const maxTruoc = Number(
      (await one(
        `SELECT COALESCE(MAX(so_thu_tu) FILTER (WHERE loai = 'ONLINE'), 0) AS m
         FROM "HangDoi"
         WHERE phong_kham_id = $1
           AND (thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
               = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;`,
        [b.phong_id]
      )).m
    );
    await Promise.all([
      xuLyDenGio([a1, a2, aTuongLai]),
      xuLyDenGio([a1, a2, aTuongLai]),
    ]);
    const h1 = await hangDoiCua(a1);
    const h2 = await hangDoiCua(a2);
    const hf = await hangDoiCua(aTuongLai);
    check("Lịch đã tới giờ có đúng 1 dòng HangDoi (kể cả khi chạy song song)", h1.length === 1 && h2.length === 1, `${h1.length}/${h2.length}`);
    check("Lịch chưa tới giờ chưa vào hàng đợi", hf.length === 0);
    check("Dòng HangDoi: ONLINE, CHO_KHAM, bộ đếm = 0",
      h1[0] && h1[0].loai === "ONLINE" && h1[0].trang_thai === "CHO_KHAM" &&
      h1[0].so_lan_goi === 0 && h1[0].so_lan_bo_luot === 0, JSON.stringify(h1[0]));
    const stt = [h1[0].so_thu_tu, h2[0].so_thu_tu].sort((x, y) => x - y);
    check("STT liên tiếp, không trùng", stt[0] === maxTruoc + 1 && stt[1] === maxTruoc + 2, `${stt} (max trước=${maxTruoc})`);
    check("DatLichKham vẫn là DA_CHECK_IN", (await trangThaiLich(a1)) === "DA_CHECK_IN");
    await xuLyDenGio([a1, a2, aTuongLai]);
    check("Chạy lại: không tạo trùng hàng đợi", (await hangDoiCua(a1)).length === 1 && (await hangDoiCua(a2)).length === 1);
  } catch (err) {
    console.error("LỖI khi chạy test:", err.message);
    ketQua.push(false);
  } finally {
    // Dọn sạch dữ liệu fixture
    try {
      if (lichIds.length) {
        await pool.query(`DELETE FROM "HangDoi" WHERE dat_lich_id = ANY($1::int[]);`, [lichIds]);
        await pool.query(`DELETE FROM "DatLichKham" WHERE id = ANY($1::int[]);`, [lichIds]);
      }
      if (slotId) await pool.query(`DELETE FROM "LichKhamBacSi" WHERE id = $1;`, [slotId]);
      console.log(`Đã dọn: ${lichIds.length} lịch hẹn fixture, ${slotId ? 1 : 0} dòng lịch khám fixture`);
    } catch (e) {
      console.error("KHÔNG DỌN ĐƯỢC fixture, cần xóa tay các lịch có mã TESTC303-%:", e.message);
      ketQua.push(false);
    }
    await pool.end();
    const pass = ketQua.filter(Boolean).length;
    console.log(`\nKết quả: ${pass}/${ketQua.length} PASS`);
    process.exitCode = ketQua.every(Boolean) ? 0 : 1;
  }
})();