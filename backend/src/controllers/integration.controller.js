const pool = require("../config/db");

const getIntegrationCheck = async (req, res) => {
  try {
    const chuyenKhoaRes = await pool.query(
      `SELECT id, ten_chuyen_khoa, mo_ta FROM "ChuyenKhoa" ORDER BY id;`
    );
    const vaiTroRes = await pool.query(`SELECT COUNT(*)::int AS total FROM "VaiTro";`);

    res.json({
      success: true,
      data: {
        database: "ok",
        vaiTro: vaiTroRes.rows[0].total,
        chuyenKhoa: chuyenKhoaRes.rows,
      },
    });
  } catch (error) {
    console.error("Lỗi truy vấn integration check:", error.message);
    res.status(500).json({
      success: false,
      message: "Không truy vấn được database",
    });
  }
};

module.exports = { getIntegrationCheck };
