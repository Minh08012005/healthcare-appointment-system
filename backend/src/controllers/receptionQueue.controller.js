const pool = require("../config/db");

// C3-06 — Lễ tân xem hàng đợi theo phòng (chỉ ĐỌC dữ liệu HangDoi, không đổi trạng thái nào).
// Không chứa logic gọi bệnh nhân (C3-08) hay bỏ lượt / recall (C3-09).

const LOAI_HOP_LE = ["ONLINE", "OFFLINE"];
const TIEN_TO_STT = { ONLINE: "A", OFFLINE: "B" };
const TRANG_THAI_HOP_LE = ["CHO_KHAM", "DANG_GOI", "DANG_KHAM", "BO_LUOT", "VANG_MAT", "DA_XONG"];
// Mặc định chỉ lấy các lượt đang nằm trong hàng; muốn xem cả lượt đã xong/bỏ lượt dùng trang_thai=ALL
const TRANG_THAI_MAC_DINH = ["CHO_KHAM", "DANG_GOI", "DANG_KHAM"];
const INT_MAX = 2147483647;

const badRequest = (res, message) => res.status(400).json({ success: false, message });

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return n <= INT_MAX ? n : null;
};

const isValidDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// GET /api/reception/queue?phong_kham_id=<id>[&ngay=YYYY-MM-DD][&loai=ONLINE|OFFLINE][&trang_thai=A,B|ALL]
const getReceptionQueue = async (req, res) => {
  const q = req.query || {};

  // --- Kiểm tra tham số ---
  const phongId = parseId(q.phong_kham_id);
  if (!phongId) return badRequest(res, "phong_kham_id là bắt buộc và phải là số nguyên dương");

  let ngay = null; // null = hôm nay (giờ VN)
  if (q.ngay !== undefined) {
    if (typeof q.ngay !== "string" || !isValidDate(q.ngay)) {
      return badRequest(res, "ngay không hợp lệ (định dạng YYYY-MM-DD)");
    }
    ngay = q.ngay;
  }

  let loai = null;
  if (q.loai !== undefined) {
    if (typeof q.loai !== "string" || !LOAI_HOP_LE.includes(q.loai.toUpperCase())) {
      return badRequest(res, "loai chỉ nhận ONLINE hoặc OFFLINE");
    }
    loai = q.loai.toUpperCase();
  }

  let trangThai = TRANG_THAI_MAC_DINH;
  if (q.trang_thai !== undefined) {
    if (typeof q.trang_thai !== "string" || q.trang_thai.trim() === "") {
      return badRequest(res, "trang_thai không hợp lệ");
    }
    if (q.trang_thai.trim().toUpperCase() === "ALL") {
      trangThai = TRANG_THAI_HOP_LE;
    } else {
      trangThai = q.trang_thai.split(",").map((s) => s.trim().toUpperCase());
      if (trangThai.some((s) => !TRANG_THAI_HOP_LE.includes(s))) {
        return badRequest(res, `trang_thai chỉ nhận: ${TRANG_THAI_HOP_LE.join(", ")} hoặc ALL`);
      }
    }
  }

  try {
    // --- Phòng khám phải tồn tại ---
    const roomRes = await pool.query(
      `SELECT pk.id, pk.ten_phong, pk.loai_phong, pk.chuyen_khoa_id, ck.ten_chuyen_khoa
       FROM "PhongKham" pk
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
       WHERE pk.id = $1`,
      [phongId]
    );
    if (roomRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng khám" });
    }
    const room = roomRes.rows[0];

    // --- Lấy hàng đợi thật từ HangDoi, chỉ của phòng này, đúng ngày (giờ VN) ---
    // Thứ tự ổn định: hàng Online (A) trước, Offline (B) sau; trong mỗi hàng theo STT,
    // rồi theo giờ vào hàng và id để không bao giờ bị đảo vị trí giữa các lần gọi.
    const result = await pool.query(
      `SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai, h.thoi_gian_check_in,
              h.so_lan_goi, h.so_lan_bo_luot, h.dat_lich_id,
              d.ma_dat_lich,
              bn.id AS benh_nhan_id, bn.ho_ten AS benh_nhan_ho_ten,
              to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS benh_nhan_ngay_sinh,
              bn.gioi_tinh AS benh_nhan_gioi_tinh,
              bs.id AS bac_si_id, bs.ho_ten AS bac_si_ho_ten, bs.cap_bac AS bac_si_cap_bac
       FROM "HangDoi" h
       JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
       LEFT JOIN "BacSi" bs ON bs.id = h.bac_si_id
       LEFT JOIN "DatLichKham" d ON d.id = h.dat_lich_id
       WHERE h.phong_kham_id = $1
         AND (h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
             = COALESCE($2::date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
         AND h.trang_thai = ANY($3::text[])
         AND ($4::text IS NULL OR h.loai = $4)
       ORDER BY CASE h.loai WHEN 'ONLINE' THEN 0 WHEN 'OFFLINE' THEN 1 ELSE 2 END,
                h.so_thu_tu, h.thoi_gian_check_in, h.id`,
      [phongId, ngay, trangThai, loai]
    );

    const ngayTraVe = ngay
      ? ngay
      : (await pool.query(`SELECT to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS d`))
          .rows[0].d;

    const queue = result.rows.map((r) => ({
      id: r.id,
      so_thu_tu: r.so_thu_tu,
      stt_hien_thi: `${TIEN_TO_STT[r.loai] || ""}${r.so_thu_tu}`,
      loai: r.loai,
      trang_thai: r.trang_thai,
      thoi_gian_check_in: r.thoi_gian_check_in,
      so_lan_goi: r.so_lan_goi,
      so_lan_bo_luot: r.so_lan_bo_luot,
      dat_lich_id: r.dat_lich_id,
      ma_dat_lich: r.ma_dat_lich,
      patient: {
        id: r.benh_nhan_id,
        ho_ten: r.benh_nhan_ho_ten,
        ngay_sinh: r.benh_nhan_ngay_sinh,
        gioi_tinh: r.benh_nhan_gioi_tinh,
      },
      doctor: r.bac_si_id
        ? { id: r.bac_si_id, ho_ten: r.bac_si_ho_ten, cap_bac: r.bac_si_cap_bac }
        : null,
    }));

    const theoTrangThai = {};
    for (const item of queue) {
      theoTrangThai[item.trang_thai] = (theoTrangThai[item.trang_thai] || 0) + 1;
    }

    return res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          ten_phong: room.ten_phong,
          loai_phong: room.loai_phong,
          chuyen_khoa_id: room.chuyen_khoa_id,
          ten_chuyen_khoa: room.ten_chuyen_khoa,
        },
        ngay: ngayTraVe,
        summary: {
          tong: queue.length,
          online: queue.filter((x) => x.loai === "ONLINE").length,
          offline: queue.filter((x) => x.loai === "OFFLINE").length,
          theo_trang_thai: theoTrangThai,
        },
        queue,
      },
    });
  } catch (err) {
    console.error("Lỗi truy vấn hàng đợi Lễ tân:", err.message);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

module.exports = { getReceptionQueue };
