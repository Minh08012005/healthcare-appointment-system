const pool = require("../config/db");

// C4-06 — Chỉ định xét nghiệm của bác sĩ trong lúc khám (bảng ChiDinhXetNghiem).
// Chỉ TẠO và ĐỌC chỉ định. Không xử lý / ghi kết quả xét nghiệm (Chặng 5), không đóng hồ sơ (C4-08).
// Quy tắc quyền giống C4-02/C4-04 (examination.controller.js): vai trò "Bác sĩ",
// chủ hồ sơ = HoSoBenhAn.bac_si_id; nếu NULL thì lấy HangDoi.bac_si_id.

const ROLE_BAC_SI = "Bác sĩ";
const HS_DANG_KHAM = "DANG_KHAM";
const CD_CHO_XU_LY = "CHO_XU_LY"; // State đầu tiên của ChiDinhXetNghiem (CHO_XU_LY -> DANG_XU_LY -> DA_XONG)
const MAX_TEN_XET_NGHIEM = 255; // khớp VARCHAR(255) trong schema
const MAX_GHI_CHU = 10000;
const INT_MAX = 2147483647;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const parseId = (v) => {
  let n = null;
  if (typeof v === "number" && Number.isInteger(v)) n = v;
  else if (typeof v === "string" && /^[1-9]\d{0,9}$/.test(v.trim())) n = Number(v.trim());
  return n !== null && n > 0 && n <= INT_MAX ? n : null;
};

const onlyDoctor = (req, res, message) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    fail(res, 403, message);
    return false;
  }
  return true;
};

const toChiDinh = (r) => ({
  id: r.id,
  ho_so_id: r.ho_so_id,
  phong_kham_id: r.phong_kham_id,
  phong: r.phong_kham_id ? { id: r.phong_kham_id, ten_phong: r.ten_phong } : null,
  ten_xet_nghiem: r.ten_xet_nghiem,
  ghi_chu: r.ghi_chu,
  trang_thai: r.trang_thai,
  thoi_gian_chi_dinh: r.thoi_gian_chi_dinh,
});

// Chuẩn hoá body tạo chỉ định. Trả { value } hoặc { message }.
const parseCreateBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Body phải là JSON object" };
  }
  const hoSoId = parseId(body.ho_so_id);
  if (!hoSoId) return { message: "ho_so_id là bắt buộc và phải là số nguyên dương" };

  const phongId = parseId(body.phong_kham_id);
  if (!phongId) return { message: "phong_kham_id là bắt buộc và phải là số nguyên dương" };

  if (typeof body.ten_xet_nghiem !== "string" || body.ten_xet_nghiem.trim() === "") {
    return { message: "ten_xet_nghiem là bắt buộc và không được để trống" };
  }
  const ten = body.ten_xet_nghiem.trim();
  if (ten.length > MAX_TEN_XET_NGHIEM) {
    return { message: `ten_xet_nghiem không được vượt quá ${MAX_TEN_XET_NGHIEM} ký tự` };
  }

  let ghiChu = null;
  if (body.ghi_chu !== undefined && body.ghi_chu !== null) {
    if (typeof body.ghi_chu !== "string") return { message: "ghi_chu phải là chuỗi" };
    const t = body.ghi_chu.trim();
    if (t.length > MAX_GHI_CHU) return { message: `ghi_chu không được vượt quá ${MAX_GHI_CHU} ký tự` };
    ghiChu = t === "" ? null : t;
  }

  return { value: { hoSoId, phongId, ten, ghiChu } };
};

// POST /api/lab-orders
// Body: { ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu? }
const createLabOrder = async (req, res) => {
  if (!onlyDoctor(req, res, "Chỉ bác sĩ mới được tạo chỉ định xét nghiệm")) return;

  const parsed = parseCreateBody(req.body);
  if (!parsed.value) return fail(res, 400, parsed.message);
  const { hoSoId, phongId, ten, ghiChu } = parsed.value;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    }

    // Khoá dòng hồ sơ: trạng thái hồ sơ không đổi giữa lúc kiểm tra và lúc tạo chỉ định
    const hs = await client.query(
      `SELECT hs.id, hs.trang_thai, COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id
       FROM "HoSoBenhAn" hs
       LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
       WHERE hs.id = $1
       FOR UPDATE OF hs`,
      [hoSoId]
    );
    if (hs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Không tìm thấy hồ sơ khám");
    }
    const record = hs.rows[0];
    if (record.owner_bs_id !== bs.rows[0].id) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Bạn không có quyền tạo chỉ định cho hồ sơ này");
    }
    if (record.trang_thai !== HS_DANG_KHAM) {
      await client.query("ROLLBACK");
      return fail(
        res,
        409,
        `Chỉ được tạo chỉ định khi hồ sơ đang khám (trạng thái hiện tại: ${record.trang_thai})`
      );
    }

    const room = await client.query(`SELECT id, ten_phong FROM "PhongKham" WHERE id = $1`, [phongId]);
    if (room.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 400, "phong_kham_id không hợp lệ: không có phòng này");
    }

    // trang_thai do ứng dụng truyền (DB không có DEFAULT); thoi_gian_chi_dinh lấy DEFAULT của DB
    const ins = await client.query(
      `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu, trang_thai)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu, trang_thai, thoi_gian_chi_dinh`,
      [hoSoId, phongId, ten, ghiChu, CD_CHO_XU_LY]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: "Đã tạo chỉ định xét nghiệm",
      data: { chi_dinh: toChiDinh({ ...ins.rows[0], ten_phong: room.rows[0].ten_phong }) },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi createLabOrder:", err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

// GET /api/lab-orders?ho_so_id=<id>
// Danh sách chỉ định của một hồ sơ (cũ nhất trước). Chỉ bác sĩ là chủ hồ sơ được xem.
const listLabOrders = async (req, res) => {
  if (!onlyDoctor(req, res, "Chỉ bác sĩ mới được xem chỉ định xét nghiệm")) return;

  const raw = req.query ? req.query.ho_so_id : undefined;
  const hoSoId = typeof raw === "string" ? parseId(raw) : null;
  if (!hoSoId) return fail(res, 400, "ho_so_id là bắt buộc và phải là số nguyên dương");

  try {
    const bs = await pool.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) return fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");

    const hs = await pool.query(
      `SELECT hs.id, hs.trang_thai, COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id
       FROM "HoSoBenhAn" hs
       LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
       WHERE hs.id = $1`,
      [hoSoId]
    );
    if (hs.rowCount === 0) return fail(res, 404, "Không tìm thấy hồ sơ khám");
    if (hs.rows[0].owner_bs_id !== bs.rows[0].id) {
      return fail(res, 403, "Bạn không có quyền xem chỉ định của hồ sơ này");
    }

    const list = await pool.query(
      `SELECT c.id, c.ho_so_id, c.phong_kham_id, pk.ten_phong, c.ten_xet_nghiem, c.ghi_chu,
              c.trang_thai, c.thoi_gian_chi_dinh
       FROM "ChiDinhXetNghiem" c
       LEFT JOIN "PhongKham" pk ON pk.id = c.phong_kham_id
       WHERE c.ho_so_id = $1
       ORDER BY c.thoi_gian_chi_dinh, c.id`,
      [hoSoId]
    );

    return res.json({
      success: true,
      data: {
        ho_so: { id: hoSoId, trang_thai: hs.rows[0].trang_thai },
        tong: list.rowCount,
        chi_dinh: list.rows.map(toChiDinh),
      },
    });
  } catch (err) {
    console.error("Lỗi listLabOrders:", err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { createLabOrder, listLabOrders };
