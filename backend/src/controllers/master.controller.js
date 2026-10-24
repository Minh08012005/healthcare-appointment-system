const pool = require("../config/db");

// GET /api/master/chuyen-khoa
// Trả về danh sách chuyên khoa phục vụ UC006 (chọn chuyên khoa).
const getChuyenKhoa = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ck.id, ck.ten_chuyen_khoa, ck.mo_ta
       FROM "ChuyenKhoa" ck
       ORDER BY ck.id;`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Lỗi truy vấn danh sách chuyên khoa:", error.message);
    res.status(500).json({
      success: false,
      message: "Không truy vấn được database",
    });
  }
};

// GET /api/master/bac-si?chuyen_khoa_id=<id>
// Trả về danh sách bác sĩ (kèm tên chuyên khoa) phục vụ UC006.
// Không trả số slot còn trống - phần đó do C2-04 (Slot Availability) phụ trách.
const getBacSi = async (req, res) => {
  const { chuyen_khoa_id } = req.query;

  const params = [];
  let whereClause = "";

  // chuyen_khoa_id là tùy chọn: không truyền thì trả về tất cả bác sĩ
  if (chuyen_khoa_id !== undefined) {
    const chuyenKhoaId = Number(chuyen_khoa_id);

    if (!Number.isInteger(chuyenKhoaId) || chuyenKhoaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "chuyen_khoa_id không hợp lệ",
      });
    }

    params.push(chuyenKhoaId);
    whereClause = `WHERE bs.chuyen_khoa_id = $1`;
  }

  try {
    const result = await pool.query(
      `SELECT bs.id,
              bs.ho_ten,
              bs.cap_bac,
              bs.muc_phi::float8 AS muc_phi,
              bs.chuyen_khoa_id,
              ck.ten_chuyen_khoa
       FROM "BacSi" bs
       LEFT JOIN "ChuyenKhoa" ck ON ck.id = bs.chuyen_khoa_id
       ${whereClause}
       ORDER BY bs.id;`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Lỗi truy vấn danh sách bác sĩ:", error.message);
    res.status(500).json({
      success: false,
      message: "Không truy vấn được database",
    });
  }
};

module.exports = { getChuyenKhoa, getBacSi };
