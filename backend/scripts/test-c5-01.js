// Test C5-01: Foundation CSDL & quyền phòng xét nghiệm
// Chạy: `node scripts/test-c5-01.js` hoặc `npm run api:test-c5-01`
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

let passCount = 0;
let failCount = 0;

const check = (label, condition, extra = "") => {
  if (condition) {
    passCount++;
    console.log(`[PASS] ${label}`);
  } else {
    failCount++;
    console.log(`[FAIL] ${label} ${extra ? `(${extra})` : ""}`);
  }
};

async function runTest() {
  console.log("=== BẮT ĐẦU KIỂM THỬ C5-01: FOUNDATION CSDL & QUYỀN PHÒNG XÉT NGHIỆM ===\n");
  const sfx = Date.now().toString().slice(-6);
  const tag = `ZZT${sfx}`;

  let testRoleId = null;
  let testRoomId = null;
  let testAccountId = null;
  let testPatientId = null;
  let testHoSoId = null;
  let testOrder1Id = null;
  let testOrder2Id = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Kiểm tra cấu trúc cột mới của ChiDinhXetNghiem
    // -------------------------------------------------------------------------
    console.log("1. Kiểm tra các cột mới của ChiDinhXetNghiem:");
    const cdCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ChiDinhXetNghiem'
        AND column_name IN ('nhan_vien_xu_ly_id', 'thoi_gian_bat_dau', 'thoi_gian_hoan_thanh');
    `);

    const colMap = new Map(cdCols.rows.map((r) => [r.column_name, r]));
    const nvCol = colMap.get("nhan_vien_xu_ly_id");
    const tgbdCol = colMap.get("thoi_gian_bat_dau");
    const tgthCol = colMap.get("thoi_gian_hoan_thanh");

    check("ChiDinhXetNghiem.nhan_vien_xu_ly_id tồn tại", !!nvCol);
    check("ChiDinhXetNghiem.nhan_vien_xu_ly_id là integer", nvCol?.data_type === "integer");
    check("ChiDinhXetNghiem.nhan_vien_xu_ly_id là NULLABLE", nvCol?.is_nullable === "YES");

    check("ChiDinhXetNghiem.thoi_gian_bat_dau tồn tại", !!tgbdCol);
    check("ChiDinhXetNghiem.thoi_gian_bat_dau là timestamp with time zone", tgbdCol?.data_type === "timestamp with time zone");
    check("ChiDinhXetNghiem.thoi_gian_bat_dau là NULLABLE", tgbdCol?.is_nullable === "YES");

    check("ChiDinhXetNghiem.thoi_gian_hoan_thanh tồn tại", !!tgthCol);
    check("ChiDinhXetNghiem.thoi_gian_hoan_thanh là timestamp with time zone", tgthCol?.data_type === "timestamp with time zone");
    check("ChiDinhXetNghiem.thoi_gian_hoan_thanh là NULLABLE", tgthCol?.is_nullable === "YES");

    // -------------------------------------------------------------------------
    // 2. Kiểm tra cột phong_kham_id của TaiKhoan
    // -------------------------------------------------------------------------
    console.log("\n2. Kiểm tra cột phong_kham_id của TaiKhoan:");
    const tkCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'TaiKhoan'
        AND column_name = 'phong_kham_id';
    `);

    const pkCol = tkCols.rows[0];
    check("TaiKhoan.phong_kham_id tồn tại", !!pkCol);
    check("TaiKhoan.phong_kham_id là integer", pkCol?.data_type === "integer");
    check("TaiKhoan.phong_kham_id là NULLABLE (không ép buộc role khác)", pkCol?.is_nullable === "YES");

    // -------------------------------------------------------------------------
    // 3. Kiểm tra Foreign Keys
    // -------------------------------------------------------------------------
    console.log("\n3. Kiểm tra Foreign Keys:");
    const fks = await pool.query(`
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);

    const hasFk = (st, sc, tt, tc) =>
      fks.rows.some((r) => r.source_table === st && r.source_column === sc && r.target_table === tt && r.target_column === tc);

    check("FK: TaiKhoan.phong_kham_id -> PhongKham.id", hasFk("TaiKhoan", "phong_kham_id", "PhongKham", "id"));
    check("FK: ChiDinhXetNghiem.nhan_vien_xu_ly_id -> TaiKhoan.id", hasFk("ChiDinhXetNghiem", "nhan_vien_xu_ly_id", "TaiKhoan", "id"));

    // -------------------------------------------------------------------------
    // 4. Kiểm tra UNIQUE constraint của KetQuaXetNghiem(chi_dinh_id)
    // -------------------------------------------------------------------------
    console.log("\n4. Kiểm tra UNIQUE(chi_dinh_id) trên KetQuaXetNghiem:");
    const uniqueConstraint = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'uq_ketquaxetnghiem_chidinh' AND contype = 'u';
    `);
    check("Constraint uq_ketquaxetnghiem_chidinh tồn tại trong DB", uniqueConstraint.rowCount > 0);

    // Tạo test fixture để kiểm chứng ràng buộc thực tế
    const roleRes = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Xét nghiệm'`);
    testRoleId = roleRes.rows[0].id;

    const roomRes = await pool.query(`
      INSERT INTO "PhongKham" (ten_phong, loai_phong)
      VALUES ($1, 'Phòng xét nghiệm') RETURNING id;
    `, [`${tag} Phòng XN`]);
    testRoomId = roomRes.rows[0].id;

    const accRes = await pool.query(`
      INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai, phong_kham_id)
      VALUES ($1, 'hash_test', $2, 'HoatDong', $3) RETURNING id;
    `, [`${tag}_ktv`, testRoleId, testRoomId]);
    testAccountId = accRes.rows[0].id;

    const bnRes = await pool.query(`
      INSERT INTO "BenhNhan" (ho_ten) VALUES ($1) RETURNING id;
    `, [`${tag} Bệnh nhân`]);
    testPatientId = bnRes.rows[0].id;

    const hsRes = await pool.query(`
      INSERT INTO "HoSoBenhAn" (benh_nhan_id, trang_thai)
      VALUES ($1, 'DANG_KHAM') RETURNING id;
    `, [testPatientId]);
    testHoSoId = hsRes.rows[0].id;

    // C4 compat: Tạo chỉ định không truyền cột C5 -> vẫn thành công
    const o1Res = await pool.query(`
      INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, ten_xet_nghiem, trang_thai)
      VALUES ($1, $2, 'Test Blood', 'CHO_XU_LY') RETURNING id, nhan_vien_xu_ly_id, thoi_gian_bat_dau;
    `, [testHoSoId, testRoomId]);
    testOrder1Id = o1Res.rows[0].id;
    check("Tạo chỉ định theo format C4 thành công (nhan_vien_xu_ly_id = null)", o1Res.rows[0].nhan_vien_xu_ly_id === null);

    // Cập nhật thông tin xử lý xét nghiệm C5
    const now = new Date();
    await pool.query(`
      UPDATE "ChiDinhXetNghiem"
      SET nhan_vien_xu_ly_id = $1, thoi_gian_bat_dau = $2, trang_thai = 'DANG_XU_LY'
      WHERE id = $3;
    `, [testAccountId, now, testOrder1Id]);

    const updatedO1 = await pool.query(`
      SELECT nhan_vien_xu_ly_id, thoi_gian_bat_dau, trang_thai FROM "ChiDinhXetNghiem" WHERE id = $1;
    `, [testOrder1Id]);
    check("Cập nhật nhan_vien_xu_ly_id và thoi_gian_bat_dau thành công", updatedO1.rows[0].nhan_vien_xu_ly_id === testAccountId);

    // Tạo kết quả xét nghiệm lần 1 -> Thành công
    await pool.query(`
      INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta)
      VALUES ($1, '/uploads/test1.pdf', 'Kết quả bình thường');
    `, [testOrder1Id]);
    check("Thêm kết quả xét nghiệm lần 1 thành công", true);

    // Thử thêm kết quả xét nghiệm lần 2 cho CÙNG chi_dinh_id -> Phải vi phạm UNIQUE (error 23505)
    let duplicateRejected = false;
    try {
      await pool.query(`
        INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta)
        VALUES ($1, '/uploads/test2.pdf', 'Kết quả trùng lặp');
      `, [testOrder1Id]);
    } catch (err) {
      if (err.code === "23505") duplicateRejected = true;
    }
    check("Thêm kết quả trùng lặp cho cùng chi_dinh_id bị chặn bởi UNIQUE (23505)", duplicateRejected);

    // -------------------------------------------------------------------------
    // 5. Kiểm tra Seed Data mẫu cho nhân viên xét nghiệm
    // -------------------------------------------------------------------------
    console.log("\n5. Kiểm tra Seed Data mẫu:");
    const seedAccounts = [
      { username: "ktv_huyethoc", room: "Phòng Xét nghiệm Huyết học" },
      { username: "ktv_sinhhoa", room: "Phòng Xét nghiệm Sinh hóa" },
      { username: "ktv_cdha", room: "Phòng Chẩn đoán hình ảnh" },
    ];

    for (const acc of seedAccounts) {
      const r = await pool.query(`
        SELECT tk.id, tk.ten_dang_nhap, tk.mat_khau, vt.ten_vai_tro, pk.ten_phong
        FROM "TaiKhoan" tk
        JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
        LEFT JOIN "PhongKham" pk ON pk.id = tk.phong_kham_id
        WHERE tk.ten_dang_nhap = $1;
      `, [acc.username]);

      if (r.rowCount === 0) {
        check(`Tài khoản seed ${acc.username} tồn tại`, false, "Chưa tìm thấy trong DB");
      } else {
        const u = r.rows[0];
        check(`Tài khoản ${acc.username} tồn tại`, true);
        check(`Tài khoản ${acc.username} đúng vai trò 'Xét nghiệm'`, u.ten_vai_tro === "Xét nghiệm");
        check(`Tài khoản ${acc.username} gắn đúng phòng '${acc.room}'`, u.ten_phong === acc.room);
        const passOk = await bcrypt.compare("123456", u.mat_khau);
        check(`Mật khẩu tài khoản ${acc.username} là '123456'`, passOk);
      }
    }
  } catch (error) {
    console.error("LỖI trong test C5-01:", error);
    failCount++;
  } finally {
    // Dọn dẹp dữ liệu test fixture
    try {
      if (testOrder1Id) await pool.query(`DELETE FROM "KetQuaXetNghiem" WHERE chi_dinh_id = $1`, [testOrder1Id]);
      if (testHoSoId) await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE ho_so_id = $1`, [testHoSoId]);
      if (testHoSoId) await pool.query(`DELETE FROM "HoSoBenhAn" WHERE id = $1`, [testHoSoId]);
      if (testPatientId) await pool.query(`DELETE FROM "BenhNhan" WHERE id = $1`, [testPatientId]);
      if (testAccountId) await pool.query(`DELETE FROM "TaiKhoan" WHERE id = $1`, [testAccountId]);
      if (testRoomId) await pool.query(`DELETE FROM "PhongKham" WHERE id = $1`, [testRoomId]);
    } catch (cleanupErr) {
      console.error("Lỗi dọn dẹp fixture:", cleanupErr.message);
    }

    console.log(`\n=== TỔNG KẾT TEST C5-01: ${passCount} PASS, ${failCount} FAIL ===`);
    await pool.end();
    if (failCount > 0) process.exitCode = 1;
  }
}

runTest();

