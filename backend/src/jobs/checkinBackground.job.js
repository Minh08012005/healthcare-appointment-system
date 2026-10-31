const pool = require("../config/db");
// Lỗi từ kết nối đang rảnh trong pool (ví dụ Neon cắt kết nối): chỉ ghi log, không sập server
pool.on("error", (err) => console.error("[C3-03] Lỗi kết nối rảnh trong pool:", err.message));

// Mã trạng thái theo C3-01
const DAT_LICH = {
  DA_DAT: "DA_DAT",
  DA_CHECK_IN: "DA_CHECK_IN",
  QUA_HAN: "QUA_HAN_CHECK_IN",
};
const HANG_DOI = { ONLINE: "ONLINE", CHO_KHAM: "CHO_KHAM" };

const NOW_VN = `(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
const GIO_HEN = `(d.ngay_kham + d.gio_kham)`;
const BATCH = 200;
const RETRY_PHUT = 1; // chỉ dùng khi chưa đọc được cấu hình
const isDryRun = () => process.env.C3_JOB_DRY_RUN === "true";

// Mốc thời gian lấy từ CauHinhHeThong (không hard-code rule)
const layCauHinh = async () => {
  const r = await pool.query(
    `SELECT chu_ky_quet_phut, checkin_toi_thieu_phut
     FROM "CauHinhHeThong" ORDER BY id LIMIT 1;`
  );
  if (r.rowCount === 0) throw new Error("Chưa có dòng nào trong CauHinhHeThong");
  const { chu_ky_quet_phut, checkin_toi_thieu_phut } = r.rows[0];
  if (![chu_ky_quet_phut, checkin_toi_thieu_phut].every((v) => Number.isInteger(v) && v > 0)) {
    throw new Error("Cấu hình C3 không hợp lệ");
  }
  return { chu_ky_quet_phut, checkin_toi_thieu_phut };
};

// Mỗi lịch hẹn một transaction riêng: một dòng lỗi không chặn các dòng khác
const withTx = async (fn) => {
  const client = await pool.connect();
  // Không có listener thì lỗi kết nối làm sập cả tiến trình server
  const onError = (err) => console.error("[C3-03] Lỗi kết nối CSDL:", err.message);
  client.on("error", onError);
  let releaseErr = null;
  try {
    await client.query("BEGIN");
    const kq = await fn(client);
    await client.query("COMMIT");
    return kq;
  } catch (err) {
    releaseErr = err;
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.removeListener("error", onError);
    client.release(releaseErr);
  }
};

// Việc B: DA_DAT, còn dưới N phút tới giờ hẹn (hoặc đã qua) => QUA_HAN_CHECK_IN + trả 1 slot
const xuLyQuaHan = async (toiThieuPhut, onlyIds = null) => {
  const ung = await pool.query(
    `SELECT d.id, d.ma_dat_lich, d.ngay_kham::text AS ngay_kham, d.gio_kham::text AS gio_kham
     FROM "DatLichKham" d
     WHERE d.trang_thai = $1
       AND (${GIO_HEN} - ${NOW_VN}) < ($2::int * interval '1 minute')
       AND ($4::int[] IS NULL OR d.id = ANY($4::int[]))
     ORDER BY d.ngay_kham, d.gio_kham
     LIMIT $3;`,
    [DAT_LICH.DA_DAT, toiThieuPhut, BATCH, onlyIds]
  );
  if (isDryRun()) {
    if (ung.rowCount > 0) console.log("[C3-03][DRY-RUN] Sẽ chuyển QUÁ HẠN:", ung.rows);
    return 0;
  }

  let daXuLy = 0;
  for (const { id } of ung.rows) {
    try {
      const kq = await withTx(async (client) => {
        // Khóa dòng + kiểm tra lại điều kiện bên trong khóa => chạy lặp không xử lý hai lần
        const r = await client.query(
          `SELECT d.id, d.bac_si_id, d.ngay_kham::text AS ngay_kham, d.gio_kham::text AS gio_kham
           FROM "DatLichKham" d
           WHERE d.id = $1 AND d.trang_thai = $2
             AND (${GIO_HEN} - ${NOW_VN}) < ($3::int * interval '1 minute')
           FOR UPDATE SKIP LOCKED;`,
          [id, DAT_LICH.DA_DAT, toiThieuPhut]
        );
        if (r.rowCount === 0) return "bo_qua";
        const l = r.rows[0];

        await client.query(`UPDATE "DatLichKham" SET trang_thai = $1 WHERE id = $2;`, [
          DAT_LICH.QUA_HAN,
          id,
        ]);
        // Trả đúng 1 slot (cùng cách hủy lịch của C2-08A)
        const slot = await client.query(
          `UPDATE "LichKhamBacSi"
           SET so_slot_da_dat = GREATEST(COALESCE(so_slot_da_dat, 0) - 1, 0)
           WHERE bac_si_id = $1 AND ngay = $2 AND gio_bat_dau = $3;`,
          [l.bac_si_id, l.ngay_kham, l.gio_kham]
        );
        if (slot.rowCount !== 1) {
          throw new Error(`Trả slot thất bại: cập nhật ${slot.rowCount} dòng`);
        }
        return "da_xu_ly";
      });
      if (kq === "da_xu_ly") daXuLy += 1;
    } catch (err) {
      console.error(`[C3-03] Lỗi xử lý quá hạn lịch #${id}:`, err.message);
    }
  }
  if (daXuLy > 0) console.log(`[C3-03] Đã chuyển ${daXuLy} lịch sang QUA_HAN_CHECK_IN`);
  return daXuLy;
};

// STT hàng Online: theo phòng + ngày, dãy riêng (giống cách C3-04 làm cho Offline)
// CHỜ MINH XÁC NHẬN quy tắc này; gom vào một hàm để sửa dễ.
const capSttOnline = async (client, phongKhamId) => {
  const r = await client.query(
    `SELECT COALESCE(MAX(h.so_thu_tu) FILTER (WHERE h.loai = $2), 0) + 1 AS so_thu_tu
     FROM "HangDoi" h
     WHERE h.phong_kham_id = $1
       AND (h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${NOW_VN}::date;`,
    [phongKhamId, HANG_DOI.ONLINE]
  );
  return Number(r.rows[0].so_thu_tu);
};

// Việc A: DA_CHECK_IN đã đến giờ hẹn và chưa có hàng đợi => tạo HangDoi ONLINE / CHO_KHAM
const xuLyDenGio = async (onlyIds = null) => {
  const ung = await pool.query(
    `SELECT d.id, d.ma_dat_lich, d.ngay_kham::text AS ngay_kham, d.gio_kham::text AS gio_kham
     FROM "DatLichKham" d
     WHERE d.trang_thai = $1
       AND ${GIO_HEN} <= ${NOW_VN}
       AND NOT EXISTS (SELECT 1 FROM "HangDoi" h WHERE h.dat_lich_id = d.id)
       AND ($3::int[] IS NULL OR d.id = ANY($3::int[]))
     ORDER BY d.ngay_kham, d.gio_kham
     LIMIT $2;`,
    [DAT_LICH.DA_CHECK_IN, BATCH, onlyIds]
  );
  if (isDryRun()) {
    if (ung.rowCount > 0) console.log("[C3-03][DRY-RUN] Sẽ đưa vào hàng đợi Online:", ung.rows);
    return 0;
  }

  let daXuLy = 0;
  for (const { id } of ung.rows) {
    try {
      const kq = await withTx(async (client) => {
        const r = await client.query(
          `SELECT d.id, d.benh_nhan_id, d.bac_si_id, d.phong_kham_id
           FROM "DatLichKham" d
           WHERE d.id = $1 AND d.trang_thai = $2 AND ${GIO_HEN} <= ${NOW_VN}
           FOR UPDATE SKIP LOCKED;`,
          [id, DAT_LICH.DA_CHECK_IN]
        );
        if (r.rowCount === 0) return "bo_qua";
        const l = r.rows[0];
        if (!l.phong_kham_id) {
          console.warn(`[C3-03] Lịch #${id} chưa có phòng khám, bỏ qua`);
          return "bo_qua";
        }

        // Khóa phòng như C3-04 để hai nơi cấp STT cùng lúc không trùng số
        await client.query(`SELECT id FROM "PhongKham" WHERE id = $1 FOR UPDATE;`, [
          l.phong_kham_id,
        ]);

        // Kiểm tra lại BÊN TRONG khóa, không lọc theo trạng thái hàng đợi
        const da = await client.query(
          `SELECT 1 FROM "HangDoi" WHERE dat_lich_id = $1 LIMIT 1;`,
          [id]
        );
        if (da.rowCount > 0) return "bo_qua";

        const stt = await capSttOnline(client, l.phong_kham_id);
        await client.query(
          `INSERT INTO "HangDoi"
             (dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id,
              loai, trang_thai, so_lan_goi, so_lan_bo_luot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0);`,
          [id, l.benh_nhan_id, stt, l.phong_kham_id, l.bac_si_id, HANG_DOI.ONLINE, HANG_DOI.CHO_KHAM]
        );
        return "da_xu_ly";
      });
      if (kq === "da_xu_ly") daXuLy += 1;
    } catch (err) {
      console.error(`[C3-03] Lỗi đưa lịch #${id} vào hàng đợi:`, err.message);
    }
  }
  if (daXuLy > 0) console.log(`[C3-03] Đã đưa ${daXuLy} lịch vào hàng đợi Online`);
  return daXuLy;
};

// Lượt kế tiếp chỉ được hẹn SAU KHI lượt trước xong => không bao giờ chạy chồng nhau
let timer = null;
let dung = false;
const lap = async () => {
  let chuKyPhut = RETRY_PHUT;
  try {
    const cfg = await layCauHinh();
    chuKyPhut = cfg.chu_ky_quet_phut;
    await xuLyQuaHan(cfg.checkin_toi_thieu_phut);
    await xuLyDenGio();
    if (isDryRun()) console.log("[C3-03][DRY-RUN] Lượt quét hoàn tất");
  } catch (err) {
    console.error("[C3-03] Lỗi lượt quét:", err.message);
  }
  if (!dung) timer = setTimeout(lap, chuKyPhut * 60 * 1000);
};

const batDauJobCheckin = () => {
  dung = false;
  console.log(`[C3-03] Job check-in nền: BẬT${isDryRun() ? " (DRY-RUN, không ghi DB)" : ""}`);
  lap();
};
const dungJobCheckin = () => {
  dung = true;
  clearTimeout(timer);
};

module.exports = { batDauJobCheckin, dungJobCheckin, xuLyQuaHan, xuLyDenGio };