const pool = require("../config/db");

// C3-04 — UC-012: Lễ tân tiếp nhận bệnh nhân Offline -> cấp STT -> HangDoi OFFLINE + CHO_KHAM.

const ROLE_LE_TAN = "Lễ tân";
const LOAI_OFFLINE = "OFFLINE";
const TT_CHO_KHAM = "CHO_KHAM";
// STT hiển thị: hàng Offline = B1, B2, ... (hàng Online dùng tiền tố A). DB vẫn lưu số nguyên.
const TIEN_TO_OFFLINE = "B";
// Bệnh nhân đang nằm trong hàng đợi (chưa kết thúc) -> không tiếp nhận thêm lần nữa
const TT_DANG_TRONG_HANG = ["CHO_KHAM", "DANG_GOI", "DANG_KHAM"];
const NGAY_HOM_NAY_VN = `(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
const NGAY_CHECKIN_VN = `(h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
const LOCK_NAMESPACE_BENH_NHAN = 2026103001; // khóa theo bệnh nhân (tránh bấm 2 lần / 2 máy cùng lúc)
const INT_MAX = 2147483647;

const isString = (v) => typeof v === "string";
const clean = (v) => (isString(v) && v.trim() !== "" ? v.trim() : null);
const isOptionalString = (v) => v === undefined || v === null || isString(v);

const parseId = (v) => {
  let n = null;
  if (typeof v === "number" && Number.isInteger(v)) n = v;
  else if (typeof v === "string" && /^[1-9]\d{0,9}$/.test(v.trim())) n = Number(v.trim());
  return n !== null && n > 0 && n <= INT_MAX ? n : null;
};

// Chỉ Lễ tân được tiếp nhận (role lấy từ JWT do middleware authenticate giải mã)
const chiLeTan = (req, res, next) => {
  if (req.user?.role !== ROLE_LE_TAN) {
    return res
      .status(403)
      .json({ success: false, message: "Chỉ Lễ tân mới được tiếp nhận bệnh nhân" });
  }
  next();
};

const badRequest = (res, message) => res.status(400).json({ success: false, message });

const isValidPastDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  return d.getTime() <= Date.now();
};

// Trả { error } hoặc { value } — gom toàn bộ kiểm tra dữ liệu đầu vào ở một chỗ
function validateBody(body) {
  const { benh_nhan_id, patient, trieu_chung, chuyen_khoa_id, phong_kham_id, bac_si_id } = body;

  // --- Phòng / chuyên khoa / bác sĩ ---
  const phongId = parseId(phong_kham_id);
  if (!phongId) return { error: "phong_kham_id là bắt buộc và phải là số nguyên dương" };
  let chuyenKhoaId = null;
  if (chuyen_khoa_id !== undefined && chuyen_khoa_id !== null) {
    chuyenKhoaId = parseId(chuyen_khoa_id);
    if (!chuyenKhoaId) return { error: "chuyen_khoa_id không hợp lệ" };
  }
  let bacSiId = null;
  if (bac_si_id !== undefined && bac_si_id !== null) {
    bacSiId = parseId(bac_si_id);
    if (!bacSiId) return { error: "bac_si_id không hợp lệ" };
  }

  // --- Triệu chứng ---
  if (!isString(trieu_chung) || trieu_chung.trim() === "") {
    return { error: "trieu_chung là bắt buộc" };
  }
  const trieuChung = trieu_chung.trim();
  if (trieuChung.length > 1000) return { error: "Triệu chứng tối đa 1000 ký tự" };

  // --- Bệnh nhân: đã có hồ sơ (benh_nhan_id) hoặc thông tin hành chính (patient) ---
  let benhNhanId = null;
  if (benh_nhan_id !== undefined && benh_nhan_id !== null) {
    benhNhanId = parseId(benh_nhan_id);
    if (!benhNhanId) return { error: "benh_nhan_id không hợp lệ" };
  }
  if (patient !== undefined && patient !== null && (typeof patient !== "object" || Array.isArray(patient))) {
    return { error: "patient phải là object" };
  }
  const p = patient || {};
  if (![p.ho_ten, p.ngay_sinh, p.gioi_tinh, p.so_cccd_ho_chieu, p.ma_bhyt, p.dia_chi].every(isOptionalString)) {
    return { error: "Các trường trong patient phải là chuỗi" };
  }
  const info = {
    ho_ten: clean(p.ho_ten),
    ngay_sinh: clean(p.ngay_sinh),
    gioi_tinh: clean(p.gioi_tinh),
    so_cccd_ho_chieu: clean(p.so_cccd_ho_chieu),
    ma_bhyt: clean(p.ma_bhyt),
    dia_chi: clean(p.dia_chi),
  };
  if (!benhNhanId) {
    if (!info.ho_ten) return { error: "patient.ho_ten là bắt buộc khi không có benh_nhan_id" };
    if (!info.so_cccd_ho_chieu) {
      return { error: "patient.so_cccd_ho_chieu là bắt buộc khi không có benh_nhan_id" };
    }
  }
  if (info.ho_ten && info.ho_ten.length > 100) return { error: "Họ tên tối đa 100 ký tự" };
  if (info.so_cccd_ho_chieu && info.so_cccd_ho_chieu.length > 20) {
    return { error: "Số CCCD/Hộ chiếu tối đa 20 ký tự" };
  }
  if (info.ma_bhyt && info.ma_bhyt.length > 30) return { error: "Mã BHYT tối đa 30 ký tự" };
  if (info.gioi_tinh && info.gioi_tinh.length > 20) return { error: "Giới tính tối đa 20 ký tự" };
  if (info.ngay_sinh && !isValidPastDate(info.ngay_sinh)) {
    return { error: "Ngày sinh không hợp lệ (định dạng YYYY-MM-DD, không ở tương lai)" };
  }

  return { value: { benhNhanId, info, trieuChung, phongId, chuyenKhoaId, bacSiId } };
}

const SELECT_BN = `SELECT id, ho_ten, to_char(ngay_sinh, 'YYYY-MM-DD') AS ngay_sinh, gioi_tinh,
                          so_cccd_ho_chieu, ma_bhyt, dia_chi
                   FROM "BenhNhan"`;

// POST /api/reception/offline-checkin
const offlineCheckIn = async (req, res) => {
  const v = validateBody(req.body || {});
  if (v.error) return badRequest(res, v.error);
  const { benhNhanId, info, trieuChung, phongId, chuyenKhoaId, bacSiId } = v.value;

  const client = await pool.connect();
  // Giữ listener 'error' trong lúc mượn client để connection đứt không làm crash process
  const onClientError = (err) => console.error("Lỗi kết nối CSDL khi tiếp nhận offline:", err.message);
  client.on("error", onClientError);
  let releaseErr = null;

  try {
    await client.query("BEGIN");

    // 1. Khóa dòng phòng khám: các lượt tiếp nhận vào cùng phòng xếp hàng lần lượt
    //    => STT không bao giờ trùng, kể cả khi 2 Lễ tân bấm cùng lúc.
    const roomRes = await client.query(
      `SELECT pk.id, pk.ten_phong, pk.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "PhongKham" pk
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
       WHERE pk.id = $1
       FOR UPDATE OF pk`,
      [phongId]
    );
    if (roomRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng khám" });
    }
    const room = roomRes.rows[0];
    if (chuyenKhoaId && room.chuyen_khoa_id !== chuyenKhoaId) {
      await client.query("ROLLBACK");
      return badRequest(res, "Phòng khám không thuộc chuyên khoa đã chọn");
    }

    // 2. Bác sĩ (không bắt buộc): phải tồn tại và cùng chuyên khoa với phòng
    let doctor = null;
    if (bacSiId) {
      const d = await client.query(
        `SELECT id, ho_ten, cap_bac, chuyen_khoa_id FROM "BacSi" WHERE id = $1`,
        [bacSiId]
      );
      if (d.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Không tìm thấy bác sĩ" });
      }
      doctor = d.rows[0];
      if (doctor.chuyen_khoa_id !== room.chuyen_khoa_id) {
        await client.query("ROLLBACK");
        return badRequest(res, "Bác sĩ không thuộc chuyên khoa của phòng đã chọn");
      }
    }

    // 3. Tìm / tạo / cập nhật bệnh nhân
    let patient = null;
    let isNew = false;
    if (benhNhanId) {
      const r = await client.query(`${SELECT_BN} WHERE id = $1 FOR UPDATE`, [benhNhanId]);
      patient = r.rows[0] || null;
      if (!patient) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Không tìm thấy bệnh nhân" });
      }
    } else {
      const r = await client.query(`${SELECT_BN} WHERE so_cccd_ho_chieu = $1 FOR UPDATE`, [
        info.so_cccd_ho_chieu,
      ]);
      patient = r.rows[0] || null;
    }

    if (patient) {
      // Bệnh nhân đã có: chỉ BỔ SUNG trường còn trống, không ghi đè dữ liệu đã lưu
      const upd = await client.query(
        `UPDATE "BenhNhan" SET
           ngay_sinh = COALESCE(ngay_sinh, $2::date),
           gioi_tinh = COALESCE(gioi_tinh, $3),
           so_cccd_ho_chieu = COALESCE(so_cccd_ho_chieu, $4),
           ma_bhyt = COALESCE(ma_bhyt, $5),
           dia_chi = COALESCE(dia_chi, $6)
         WHERE id = $1
         RETURNING id`,
        [patient.id, info.ngay_sinh, info.gioi_tinh, info.so_cccd_ho_chieu, info.ma_bhyt, info.dia_chi]
      );
      const again = await client.query(`${SELECT_BN} WHERE id = $1`, [upd.rows[0].id]);
      patient = again.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh, so_cccd_ho_chieu, ma_bhyt, dia_chi)
         VALUES ($1, $2::date, $3, $4, $5, $6)
         RETURNING id`,
        [info.ho_ten, info.ngay_sinh, info.gioi_tinh, info.so_cccd_ho_chieu, info.ma_bhyt, info.dia_chi]
      );
      const created = await client.query(`${SELECT_BN} WHERE id = $1`, [ins.rows[0].id]);
      patient = created.rows[0];
      isNew = true;
    }

    // 4. Chặn tiếp nhận trùng: bệnh nhân đang nằm trong hàng đợi hôm nay
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [LOCK_NAMESPACE_BENH_NHAN, patient.id]);
    const dup = await client.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, pk.ten_phong
       FROM "HangDoi" h
       LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
       WHERE h.benh_nhan_id = $1
         AND h.trang_thai = ANY($2::text[])
         AND ${NGAY_CHECKIN_VN} = ${NGAY_HOM_NAY_VN}
       LIMIT 1`,
      [patient.id, TT_DANG_TRONG_HANG]
    );
    if (dup.rowCount > 0) {
      await client.query("ROLLBACK");
      const d = dup.rows[0];
      return res.status(409).json({
        success: false,
        message: `Bệnh nhân đã được tiếp nhận hôm nay (STT ${d.loai === LOAI_OFFLINE ? TIEN_TO_OFFLINE : "A"}${d.so_thu_tu}, ${d.ten_phong || "chưa rõ phòng"}) và đang trong hàng đợi`,
      });
    }

    // 5. Cấp STT hàng Offline: số lớn nhất của hàng OFFLINE trong phòng hôm nay + 1
    //    (dãy riêng với hàng Online; phòng đang bị khóa nên không thể trùng)
    const stt = await client.query(
      `SELECT COALESCE(MAX(h.so_thu_tu) FILTER (WHERE h.loai = $3), 0) + 1 AS so_thu_tu,
              COUNT(*) FILTER (WHERE h.trang_thai = $2) AS dang_cho
       FROM "HangDoi" h
       WHERE h.phong_kham_id = $1 AND ${NGAY_CHECKIN_VN} = ${NGAY_HOM_NAY_VN}`,
      [phongId, TT_CHO_KHAM, LOAI_OFFLINE]
    );
    const soThuTu = Number(stt.rows[0].so_thu_tu);
    const soNguoiChoTruoc = Number(stt.rows[0].dang_cho);

    // 6. Tạo HangDoi OFFLINE + CHO_KHAM (không gắn lịch hẹn online)
    const queue = await client.query(
      `INSERT INTO "HangDoi"
         (dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id,
          loai, trang_thai, so_lan_goi, so_lan_bo_luot)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, 0, 0)
       RETURNING id, thoi_gian_check_in`,
      [patient.id, soThuTu, phongId, bacSiId, LOAI_OFFLINE, TT_CHO_KHAM]
    );
    const queueRow = queue.rows[0];

    // 7. Lượt khám Offline: hồ sơ bệnh án gắn với HangDoi + triệu chứng ghi nhận lúc tiếp nhận
    const hoSo = await client.query(
      `INSERT INTO "HoSoBenhAn" (hang_doi_id, benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1, $2, $3, ${NGAY_HOM_NAY_VN}, $4)
       RETURNING id`,
      [queueRow.id, patient.id, bacSiId, TT_CHO_KHAM]
    );
    await client.query(
      `INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan) VALUES ($1, $2)`,
      [hoSo.rows[0].id, trieuChung]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        queue: {
          id: queueRow.id,
          so_thu_tu: soThuTu,
          stt_hien_thi: `${TIEN_TO_OFFLINE}${soThuTu}`,
          loai: LOAI_OFFLINE,
          trang_thai: TT_CHO_KHAM,
          so_lan_goi: 0,
          so_lan_bo_luot: 0,
          dat_lich_id: null,
          thoi_gian_check_in: queueRow.thoi_gian_check_in,
          so_nguoi_cho_truoc: soNguoiChoTruoc,
        },
        patient: { ...patient, is_new: isNew },
        room: { id: room.id, ten_phong: room.ten_phong },
        specialty: { id: room.chuyen_khoa_id, ten_chuyen_khoa: room.ten_chuyen_khoa },
        doctor: doctor ? { id: doctor.id, ho_ten: doctor.ho_ten, cap_bac: doctor.cap_bac } : null,
        trieu_chung: trieuChung,
        ho_so_id: hoSo.rows[0].id,
      },
    });
  } catch (err) {
    releaseErr = err;
    console.error(err);
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Không ROLLBACK được (connection có thể đã mất):", rollbackErr.message);
    }

    if (err.code === "23505") {
      let message = "Thông tin đã tồn tại";
      if (err.constraint && err.constraint.includes("so_cccd_ho_chieu")) {
        message = "Số CCCD/Hộ chiếu đã thuộc về hồ sơ bệnh nhân khác";
      } else if (err.constraint && err.constraint.includes("ma_bhyt")) {
        message = "Mã BHYT đã thuộc về hồ sơ bệnh nhân khác";
      }
      return res.status(409).json({ success: false, message });
    }
    if (err.code === "22001") return badRequest(res, "Dữ liệu nhập quá dài");
    if (err.code === "22007" || err.code === "22008") return badRequest(res, "Ngày sinh không hợp lệ");
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.removeListener("error", onClientError);
    client.release(releaseErr);
  }
};

module.exports = { chiLeTan, offlineCheckIn };
