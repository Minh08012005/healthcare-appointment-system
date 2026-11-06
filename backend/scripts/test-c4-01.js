const pool = require("../src/config/db");
const { startExamination } = require("../src/controllers/callNext.controller");

let pass = 0;
let fail = 0;

function check(label, condition, extra = "") {
  if (condition) {
    pass++;
    console.log(`[PASS] ${label}`);
  } else {
    fail++;
    console.error(`[FAIL] ${label} ${extra}`);
  }
}

async function runTest() {
  console.log("=== BẮT ĐẦU KIỂM THỬ C4-01 (FOUNDATION CSDL CHẶNG 4) ===\n");
  const sfx = Date.now().toString().slice(-6);
  const cleanupIds = {
    taiKhoan: [],
    bacSi: [],
    phongKham: [],
    lichKham: [],
    benhNhan: [],
    hangDoi: [],
    hoSo: [],
    chiDinh: [],
  };

  try {
    // -------------------------------------------------------------------------
    // 1. KIỂM TRA SCHEMA CỦA BẢNG ChiDinhXetNghiem
    // -------------------------------------------------------------------------
    console.log("1. Kiểm tra cấu trúc 3 cột mới của ChiDinhXetNghiem:");
    const colRes = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ChiDinhXetNghiem'
      ORDER BY ordinal_position;
    `);

    const cols = Object.fromEntries(colRes.rows.map((r) => [r.column_name, r]));

    // Cột 1: ten_xet_nghiem VARCHAR(255) NOT NULL
    check(
      "Cột ten_xet_nghiem tồn tại",
      Boolean(cols.ten_xet_nghiem)
    );
    check(
      "Cột ten_xet_nghiem có kiểu VARCHAR(255)",
      cols.ten_xet_nghiem?.data_type === "character varying" &&
        cols.ten_xet_nghiem?.character_maximum_length === 255
    );
    check(
      "Cột ten_xet_nghiem có ràng buộc NOT NULL",
      cols.ten_xet_nghiem?.is_nullable === "NO"
    );

    // Cột 2: ghi_chu TEXT (cho phép NULL)
    check(
      "Cột ghi_chu tồn tại",
      Boolean(cols.ghi_chu)
    );
    check(
      "Cột ghi_chu có kiểu TEXT",
      cols.ghi_chu?.data_type === "text"
    );
    check(
      "Cột ghi_chu cho phép NULL",
      cols.ghi_chu?.is_nullable === "YES"
    );

    // Cột 3: thoi_gian_chi_dinh TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    check(
      "Cột thoi_gian_chi_dinh tồn tại",
      Boolean(cols.thoi_gian_chi_dinh)
    );
    check(
      "Cột thoi_gian_chi_dinh có kiểu TIMESTAMPTZ",
      cols.thoi_gian_chi_dinh?.data_type === "timestamp with time zone"
    );
    check(
      "Cột thoi_gian_chi_dinh có default CURRENT_TIMESTAMP/now()",
      Boolean(cols.thoi_gian_chi_dinh?.column_default?.toLowerCase().includes("now()") ||
        cols.thoi_gian_chi_dinh?.column_default?.toLowerCase().includes("current_timestamp"))
    );

    // Cột trạng thái: VARCHAR(50) không default theo đúng quyết định
    check(
      "Cột trang_thai giữ nguyên VARCHAR(50)",
      cols.trang_thai?.data_type === "character varying"
    );

    // -------------------------------------------------------------------------
    // 2. TẠO TEST FIXTURE ĐỂ THỬ NGHIỆM INSERT VÀ REGRESSION
    // -------------------------------------------------------------------------
    console.log("\n2. Chuẩn bị dữ liệu kiểm thử (Bác sĩ, Phòng khám, Lịch trực, Bệnh nhân):");

    // Lấy chuyên khoa đầu tiên
    const ckRes = await pool.query(`SELECT id FROM "ChuyenKhoa" LIMIT 1`);
    const chuyenKhoaId = ckRes.rows[0]?.id || 1;

    // Lấy vai trò Bác sĩ
    const vtRes = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bác sĩ'`);
    const vaiTroBacSiId = vtRes.rows[0]?.id;

    // Tạo phòng khám
    const pkRes = await pool.query(
      `INSERT INTO "PhongKham" (ten_phong, chuyen_khoa_id, loai_phong)
       VALUES ($1, $2, 'KhamBenh') RETURNING id`,
      [`Phòng Test C401 ${sfx}`, chuyenKhoaId]
    );
    const phongKhamId = pkRes.rows[0].id;
    cleanupIds.phongKham.push(phongKhamId);

    // Tạo tài khoản & bác sĩ
    const tkRes = await pool.query(
      `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai)
       VALUES ($1, 'hash_test', $2, 'HoatDong') RETURNING id`,
      [`bs_c401_${sfx}`, vaiTroBacSiId]
    );
    const taiKhoanId = tkRes.rows[0].id;
    cleanupIds.taiKhoan.push(taiKhoanId);

    const bsRes = await pool.query(
      `INSERT INTO "BacSi" (tai_khoan_id, ho_ten, chuyen_khoa_id, muc_phi, cap_bac)
       VALUES ($1, $2, $3, 100000, 'BS Test') RETURNING id`,
      [taiKhoanId, `BS Test C401 ${sfx}`, chuyenKhoaId]
    );
    const bacSiId = bsRes.rows[0].id;
    cleanupIds.bacSi.push(bacSiId);

    // Tạo lịch khám hôm nay cho bác sĩ tại phòng khám
    const lkRes = await pool.query(
      `INSERT INTO "LichKhamBacSi"
         (bac_si_id, phong_kham_id, ngay, gio_bat_dau, gio_ket_thuc, so_slot_toi_da, so_slot_online, so_slot_da_dat, trang_thai)
       VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, '07:00:00', '17:00:00', 10, 5, 0, 'HoatDong')
       RETURNING id`,
      [bacSiId, phongKhamId]
    );
    cleanupIds.lichKham.push(lkRes.rows[0].id);

    // Tạo bệnh nhân
    const bnRes = await pool.query(
      `INSERT INTO "BenhNhan" (ho_ten, ngay_sinh, gioi_tinh)
       VALUES ($1, '1995-05-15', 'Nam') RETURNING id`,
      [`Bệnh nhân Test C401 ${sfx}`]
    );
    const benhNhanId = bnRes.rows[0].id;
    cleanupIds.benhNhan.push(benhNhanId);

    // -------------------------------------------------------------------------
    // 3. THỬ NGHIỆM INSERT ChiDinhXetNghiem (STATE: CHO_XU_LY) & RÀNG BUỘC
    // -------------------------------------------------------------------------
    console.log("\n3. Thử nghiệm tạo record ChiDinhXetNghiem:");

    // Tạo 1 hồ sơ bệnh án mẫu
    const hsRes = await pool.query(
      `INSERT INTO "HoSoBenhAn" (benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'DANG_KHAM')
       RETURNING id`,
      [benhNhanId, bacSiId]
    );
    const hoSoId = hsRes.rows[0].id;
    cleanupIds.hoSo.push(hoSoId);

    // Insert record với state CHO_XU_LY
    const insertRes = await pool.query(
      `INSERT INTO "ChiDinhXetNghiem"
         (ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu, trang_thai)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ten_xet_nghiem, ghi_chu, thoi_gian_chi_dinh, trang_thai`,
      [hoSoId, phongKhamId, "Xét nghiệm công thức máu toàn phần", "Nhịn ăn sáng", "CHO_XU_LY"]
    );
    const cd = insertRes.rows[0];
    cleanupIds.chiDinh.push(cd.id);

    check("Tạo thành công record ChiDinhXetNghiem với state CHO_XU_LY", Boolean(cd && cd.id));
    check("ten_xet_nghiem lưu chính xác", cd.ten_xet_nghiem === "Xét nghiệm công thức máu toàn phần");
    check("ghi_chu lưu chính xác", cd.ghi_chu === "Nhịn ăn sáng");
    check("trang_thai lưu chính xác là CHO_XU_LY", cd.trang_thai === "CHO_XU_LY");
    check("thoi_gian_chi_dinh tự động sinh default timestamp", Boolean(cd.thoi_gian_chi_dinh));

    // Thử nghiệm ràng buộc NOT NULL trên ten_xet_nghiem (phải fail)
    let notNullBlocked = false;
    try {
      await pool.query(
        `INSERT INTO "ChiDinhXetNghiem" (ho_so_id, phong_kham_id, ten_xet_nghiem, trang_thai)
         VALUES ($1, $2, NULL, 'CHO_XU_LY')`,
        [hoSoId, phongKhamId]
      );
    } catch (err) {
      if (err.message.includes("null value in column \"ten_xet_nghiem\"") || err.code === "23502") {
        notNullBlocked = true;
      }
    }
    check("Ràng buộc NOT NULL trên ten_xet_nghiem hoạt động chuẩn xác (chặn NULL)", notNullBlocked);

    // -------------------------------------------------------------------------
    // 4. REGRESSION TEST: LUỒNG START EXAMINATION (CHẶNG 3)
    // -------------------------------------------------------------------------
    console.log("\n4. Regression test: Luồng Start Examination (DANG_GOI -> DANG_KHAM + ho_so_id):");

    // Tạo lượt khám trong HangDoi ở trạng thái DANG_GOI
    const hdRes = await pool.query(
      `INSERT INTO "HangDoi"
         (benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id, loai, trang_thai, so_lan_goi, so_lan_bo_luot)
       VALUES ($1, 99, $2, $3, 'OFFLINE', 'DANG_GOI', 1, 0)
       RETURNING id`,
      [benhNhanId, phongKhamId, bacSiId]
    );
    const queueId = hdRes.rows[0].id;
    cleanupIds.hangDoi.push(queueId);

    // Mock Express req & res để gọi trực tiếp startExamination controller
    const mockReq = {
      user: { id: taiKhoanId, role: "Bác sĩ" },
      params: { id: queueId },
    };

    let controllerResponse = null;
    let controllerStatus = 200;
    const mockRes = {
      status(code) {
        controllerStatus = code;
        return this;
      },
      json(data) {
        controllerResponse = data;
        return this;
      },
    };

    await startExamination(mockReq, mockRes);

    check(
      "Controller startExamination trả status 200",
      controllerStatus === 200,
      `Status nhận: ${controllerStatus}`
    );
    check(
      "startExamination trả success: true",
      controllerResponse?.success === true,
      JSON.stringify(controllerResponse)
    );
    check(
      "startExamination trả đúng trạng thái DANG_KHAM",
      controllerResponse?.data?.trang_thai === "DANG_KHAM"
    );
    check(
      "API Start Examination trả ho_so_id hợp lệ",
      Boolean(controllerResponse?.data?.ho_so_id && Number(controllerResponse.data.ho_so_id) > 0),
      `ho_so_id: ${controllerResponse?.data?.ho_so_id}`
    );

    if (controllerResponse?.data?.ho_so_id) {
      cleanupIds.hoSo.push(controllerResponse.data.ho_so_id);
    }

    // Kiểm tra DB: HangDoi và HoSoBenhAn đều đã chuyển sang DANG_KHAM
    const qCheck = await pool.query(`SELECT trang_thai FROM "HangDoi" WHERE id = $1`, [queueId]);
    check(
      "DB HangDoi đã chuyển sang DANG_KHAM",
      qCheck.rows[0]?.trang_thai === "DANG_KHAM"
    );

    const hsCheck = await pool.query(
      `SELECT trang_thai FROM "HoSoBenhAn" WHERE id = $1`,
      [controllerResponse?.data?.ho_so_id]
    );
    check(
      "DB HoSoBenhAn có trạng thái DANG_KHAM",
      hsCheck.rows[0]?.trang_thai === "DANG_KHAM"
    );
  } catch (error) {
    console.error("LỖI NGOẠI LỆ TRONG KHI TEST:", error);
    fail++;
  } finally {
    // -------------------------------------------------------------------------
    // 5. DỌN DẸP DỮ LIỆU TEST (CLEANUP)
    // -------------------------------------------------------------------------
    console.log("\n5. Dọn dẹp dữ liệu test:");
    try {
      if (cleanupIds.chiDinh.length > 0) {
        await pool.query(`DELETE FROM "ChiDinhXetNghiem" WHERE id = ANY($1::int[])`, [cleanupIds.chiDinh]);
      }
      if (cleanupIds.hoSo.length > 0) {
        await pool.query(`DELETE FROM "HoSoBenhAn" WHERE id = ANY($1::int[])`, [cleanupIds.hoSo]);
      }
      if (cleanupIds.hangDoi.length > 0) {
        await pool.query(`DELETE FROM "HangDoi" WHERE id = ANY($1::int[])`, [cleanupIds.hangDoi]);
      }
      if (cleanupIds.lichKham.length > 0) {
        await pool.query(`DELETE FROM "LichKhamBacSi" WHERE id = ANY($1::int[])`, [cleanupIds.lichKham]);
      }
      if (cleanupIds.bacSi.length > 0) {
        await pool.query(`DELETE FROM "BacSi" WHERE id = ANY($1::int[])`, [cleanupIds.bacSi]);
      }
      if (cleanupIds.benhNhan.length > 0) {
        await pool.query(`DELETE FROM "BenhNhan" WHERE id = ANY($1::int[])`, [cleanupIds.benhNhan]);
      }
      if (cleanupIds.phongKham.length > 0) {
        await pool.query(`DELETE FROM "PhongKham" WHERE id = ANY($1::int[])`, [cleanupIds.phongKham]);
      }
      if (cleanupIds.taiKhoan.length > 0) {
        await pool.query(`DELETE FROM "TaiKhoan" WHERE id = ANY($1::int[])`, [cleanupIds.taiKhoan]);
      }
      console.log("[PASS] Đã dọn dẹp sạch sẽ toàn bộ test fixture!");
    } catch (cleanupErr) {
      console.warn("Cảnh báo dọn dẹp:", cleanupErr.message);
    } finally {
      await pool.end();
    }
  }

  console.log("\n=== TỔNG KẾT KIỂM THỬ ===");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}

runTest();
