const pool = require("../src/config/db");

const EXPECTED_TABLES = [
  "VaiTro",
  "TaiKhoan",
  "BenhNhan",
  "ChuyenKhoa",
  "BacSi",
  "PhongKham",
  "DatLichKham",
  "HangDoi",
  "LichKhamBacSi",
  "HoSoBenhAn",
  "KetQuaKham",
  "ChiDinhXetNghiem",
  "KetQuaXetNghiem",
  "TinTuc",
  "QuyTrinhKham",
];

const REQUIRED_FOREIGN_KEYS = [
  { sourceTable: "TaiKhoan", sourceColumn: "vai_tro_id", targetTable: "VaiTro", targetColumn: "id" },
  { sourceTable: "BenhNhan", sourceColumn: "tai_khoan_id", targetTable: "TaiKhoan", targetColumn: "id" },
  { sourceTable: "BacSi", sourceColumn: "chuyen_khoa_id", targetTable: "ChuyenKhoa", targetColumn: "id" },
  { sourceTable: "DatLichKham", sourceColumn: "benh_nhan_id", targetTable: "BenhNhan", targetColumn: "id" },
  { sourceTable: "HangDoi", sourceColumn: "dat_lich_id", targetTable: "DatLichKham", targetColumn: "id" },
  { sourceTable: "HoSoBenhAn", sourceColumn: "hang_doi_id", targetTable: "HangDoi", targetColumn: "id" },
  { sourceTable: "KetQuaKham", sourceColumn: "ho_so_id", targetTable: "HoSoBenhAn", targetColumn: "id" },
  { sourceTable: "ChiDinhXetNghiem", sourceColumn: "ho_so_id", targetTable: "HoSoBenhAn", targetColumn: "id" },
  { sourceTable: "KetQuaXetNghiem", sourceColumn: "chi_dinh_id", targetTable: "ChiDinhXetNghiem", targetColumn: "id" },
];

async function verifySchema() {
  console.log("=== BẮT ĐẦU XÁC MINH DATABASE SCHEMA TRÊN NEON ===\n");
  let allPass = true;

  try {
    // 1. Kiểm tra danh sách bảng trong public schema
    console.log("1. Kiểm tra danh sách bảng (public schema):");
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = tableRes.rows.map((r) => r.table_name);
    console.log(`- Tổng số bảng tìm thấy trong DB: ${existingTables.length}`);
    console.log(`- Danh sách bảng hiện có: ${existingTables.length > 0 ? existingTables.join(", ") : "(trống)"}`);

    // Kiểm tra 15 bảng baseline
    const missingTables = EXPECTED_TABLES.filter((t) => !existingTables.includes(t));
    const extraTables = existingTables.filter((t) => !EXPECTED_TABLES.includes(t));

    if (missingTables.length === 0 && extraTables.length === 0 && existingTables.length === 15) {
      console.log(` [PASS] Đầy đủ chính xác 15 bảng baseline!`);
    } else {
      if (missingTables.length > 0) {
        console.log(` [FAIL] Thiếu bảng: ${missingTables.join(", ")}`);
        allPass = false;
      }
      if (extraTables.length > 0) {
        console.log(` [CẢNH BÁO] Có bảng ngoài baseline: ${extraTables.join(", ")}`);
        allPass = false;
      }
      if (existingTables.length !== 15) {
        console.log(` [FAIL] Số lượng bảng không đúng 15 (hiện tại: ${existingTables.length})`);
        allPass = false;
      }
    }

    // 2. Kiểm tra Foreign Keys
    console.log("\n2. Kiểm tra các Foreign Key quan trọng:");
    const fkRes = await pool.query(`
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);

    const existingFks = fkRes.rows;

    for (const fk of REQUIRED_FOREIGN_KEYS) {
      const found = existingFks.find(
        (e) =>
          e.source_table === fk.sourceTable &&
          e.source_column === fk.sourceColumn &&
          e.target_table === fk.targetTable &&
          e.target_column === fk.targetColumn
      );

      const relationName = `${fk.sourceTable}.${fk.sourceColumn} -> ${fk.targetTable}.${fk.targetColumn}`;
      if (found) {
        console.log(`  [PASS] ${relationName} (Constraint: ${found.constraint_name})`);
      } else {
        console.log(`  [FAIL] ${relationName} (KHÔNG TÌM THẤY)`);
        allPass = false;
      }
    }

    console.log("\n=== KẾT QUẢ TỔNG QUAN ===");
    if (allPass) {
      console.log(" TẤT CẢ TIÊU CHÍ XÁC MINH ĐỀU ĐẠT (PASS)!");
    } else {
      console.log(" XÁC MINH CHƯA ĐẠT (FAIL/INCOMPLETE)!");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Lỗi khi xác minh schema:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

verifySchema();
