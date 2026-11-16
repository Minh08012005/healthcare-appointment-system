const pool = require("../config/db");

const QUEUE_SETTINGS_FIELDS = [
  "ti_le_online",
  "ti_le_offline",
  "checkin_som_nhat_phut",
  "checkin_toi_thieu_phut",
  "so_lan_goi_toi_da",
  "khoang_cach_goi_phut",
  "chu_ky_quet_phut",
];
const MAX_INTEGER_VALUE = 2147483647;

const selectSettings = `SELECT ${QUEUE_SETTINGS_FIELDS.join(", ")}
                        FROM "CauHinhHeThong"`;

const findSingleSettingsRow = async (client) => {
  const result = await client.query(
    `SELECT id FROM "CauHinhHeThong" ORDER BY id LIMIT 2 FOR UPDATE`,
  );

  if (result.rowCount === 0) {
    return { error: "Chưa có cấu hình hệ thống", status: 404 };
  }
  if (result.rowCount > 1) {
    return { error: "Có nhiều hơn một dòng cấu hình hệ thống", status: 500 };
  }

  return { id: result.rows[0].id };
};

const validateQueueSettings = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Dữ liệu cấu hình không hợp lệ" };
  }

  const errors = [];
  for (const field of QUEUE_SETTINGS_FIELDS) {
    const value = body[field];
    if (
      !Number.isInteger(value) ||
      value <= 0 ||
      value > MAX_INTEGER_VALUE
    ) {
      errors.push(`${field} phải là số nguyên từ 1 đến ${MAX_INTEGER_VALUE}`);
    }
  }

  if (errors.length > 0) return { message: errors.join("; ") };

  return {
    values: QUEUE_SETTINGS_FIELDS.map((field) => body[field]),
  };
};

const getQueueSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `${selectSettings} ORDER BY id LIMIT 2`,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Chưa có cấu hình hệ thống",
      });
    }
    if (result.rowCount > 1) {
      console.error("CauHinhHeThong có nhiều hơn một dòng");
      return res.status(500).json({
        success: false,
        message: "Dữ liệu cấu hình hệ thống không hợp lệ",
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Lỗi khi đọc cấu hình hàng đợi:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải cấu hình hệ thống",
    });
  }
};

const updateQueueSettings = async (req, res) => {
  const validation = validateQueueSettings(req.body);
  if (validation.message) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;

    const config = await findSingleSettingsRow(client);
    if (config.error) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      if (config.status === 500) console.error(config.error);
      return res.status(config.status).json({
        success: false,
        message:
          config.status === 500
            ? "Dữ liệu cấu hình hệ thống không hợp lệ"
            : config.error,
      });
    }

    const assignments = QUEUE_SETTINGS_FIELDS.map(
      (field, index) => `"${field}" = $${index + 1}`,
    ).join(", ");
    const result = await client.query(
      `UPDATE "CauHinhHeThong"
       SET ${assignments}
       WHERE id = $${QUEUE_SETTINGS_FIELDS.length + 1}
       RETURNING ${QUEUE_SETTINGS_FIELDS.join(", ")}`,
      [...validation.values, config.id],
    );

    await client.query("COMMIT");
    transactionOpen = false;
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Lỗi rollback cấu hình hàng đợi:", rollbackError);
      }
    }
    console.error("Lỗi khi cập nhật cấu hình hàng đợi:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật cấu hình hệ thống",
    });
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  getQueueSettings,
  updateQueueSettings,
  validateQueueSettings,
};
