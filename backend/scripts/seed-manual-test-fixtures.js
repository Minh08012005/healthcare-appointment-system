const pool = require("../src/config/db");

const PASSWORD_HASH = "$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi"; // 123456

async function seedManualTestFixtures() {
  console.log("=== BẮT ĐẦU TẠO MANUAL-TEST FIXTURES (ĐỘC LẬP - KHÔNG ĐỤNG GOLDEN E2E) ===");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026112101)");

    // 1. Dọn dẹp sạch sẽ các fixture manual-test cũ trước khi gieo lại (Idempotent & State Restoration)
    console.log("1. Khôi phục các manual-test fixture về trạng thái ban đầu...");
    await client.query(`
      DELETE FROM "KetQuaXetNghiem"
      WHERE chi_dinh_id IN (
        SELECT cd.id FROM "ChiDinhXetNghiem" cd
        JOIN "HoSoBenhAn" hs ON hs.id = cd.ho_so_id
        JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
        WHERE bn.so_cccd_ho_chieu LIKE '001099000%'
      ) OR chi_dinh_id IN (
        SELECT id FROM "ChiDinhXetNghiem" WHERE ten_xet_nghiem LIKE '%Manual Test%'
      );
    `);
    await client.query(`
      DELETE FROM "ChiDinhXetNghiem"
      WHERE ho_so_id IN (
        SELECT hs.id FROM "HoSoBenhAn" hs
        JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
        WHERE bn.so_cccd_ho_chieu LIKE '001099000%'
      ) OR ten_xet_nghiem LIKE '%Manual Test%';
    `);
    await client.query(`
      DELETE FROM "KetQuaKham"
      WHERE ho_so_id IN (
        SELECT id FROM "HoSoBenhAn"
        WHERE benh_nhan_id IN (
          SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE '001099000%'
        )
      );
    `);
    await client.query(`
      DELETE FROM "HoSoBenhAn"
      WHERE benh_nhan_id IN (
        SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE '001099000%'
      );
    `);
    await client.query(`
      DELETE FROM "HangDoi"
      WHERE benh_nhan_id IN (
        SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE '001099000%'
      ) OR dat_lich_id IN (
        SELECT id FROM "DatLichKham" WHERE ma_dat_lich IN ('MT-REC-001', 'MT-DOC-001')
      );
    `);
    await client.query(`
      DELETE FROM "DatLichKham"
      WHERE ma_dat_lich IN ('MT-REC-001', 'MT-DOC-001')
         OR benh_nhan_id IN (
           SELECT id FROM "BenhNhan" WHERE so_cccd_ho_chieu LIKE '001099000%'
         )
         OR benh_nhan_id IN (
           SELECT bn.id FROM "BenhNhan" bn
           JOIN "TaiKhoan" t ON t.id = bn.tai_khoan_id
           WHERE t.ten_dang_nhap = 'benhnhan_02'
         );
    `);
    await client.query(`
      DELETE FROM "BenhNhan"
      WHERE so_cccd_ho_chieu LIKE '001099000%';
    `);
    await client.query(`
      DELETE FROM "TaiKhoan"
      WHERE ten_dang_nhap IN ('benhnhan_mt_rec', 'benhnhan_mt_doc', 'benhnhan_mt_lab');
    `);
    console.log("   -> Đã dọn dẹp các fixture manual-test cũ an toàn.");

    // Lấy ID vai trò Bệnh nhân
    const roleBnRes = await client.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Bệnh nhân'`);
    const roleBnId = roleBnRes.rows[0].id;

    // Lấy danh sách ID bác sĩ & phòng
    const doctorsRes = await client.query(`
      SELECT b.id, b.ho_ten, b.chuyen_khoa_id, b.muc_phi, ck.ten_chuyen_khoa
      FROM "BacSi" b
      JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id
    `);
    const docMap = new Map(doctorsRes.rows.map((r) => [r.ho_ten, r]));

    const roomsRes = await client.query(`SELECT id, ten_phong, loai_phong FROM "PhongKham"`);
    const roomMap = new Map(roomsRes.rows.map((r) => [r.ten_phong, r.id]));

    // 2. Tạo 3 tài khoản bệnh nhân chuyên dụng cho 3 manual test fixture
    console.log("\n2. Tạo 3 tài khoản bệnh nhân chuyên dụng cho manual test...");
    const patientsData = [
      {
        username: "benhnhan_mt_rec",
        email: "mt_rec@medicare.vn",
        phone: "0909000001",
        name: "Lê Văn Minh Test",
        birth: "1992-04-10",
        gender: "Nam",
        cccd: "001099000001",
        bhyt: "DN401990000001",
        address: "789 Hoàng Hoa Thám, Ba Đình, Hà Nội",
      },
      {
        username: "benhnhan_mt_doc",
        email: "mt_doc@medicare.vn",
        phone: "0909000002",
        name: "Hoàng Nam Doctor Test",
        birth: "1988-08-18",
        gender: "Nam",
        cccd: "001099000002",
        bhyt: "DN401990000002",
        address: "12 Kim Mã, Ba Đình, Hà Nội",
      },
      {
        username: "benhnhan_mt_lab",
        email: "mt_lab@medicare.vn",
        phone: "0909000003",
        name: "Trần Thị Chúc Test",
        birth: "1996-12-25",
        gender: "Nữ",
        cccd: "001099000003",
        bhyt: "GD401990000003",
        address: "45 Lê Duẩn, Hoàn Kiếm, Hà Nội",
      },
    ];

    const patientMap = new Map();
    for (const p of patientsData) {
      const tkRes = await client.query(
        `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, email, so_dien_thoai, vai_tro_id, trang_thai)
         VALUES ($1, $2, $3, $4, $5, 'HoatDong')
         RETURNING id`,
        [p.username, PASSWORD_HASH, p.email, p.phone, roleBnId]
      );
      const tkId = tkRes.rows[0].id;

      const bnRes = await client.query(
        `INSERT INTO "BenhNhan" (tai_khoan_id, ho_ten, ngay_sinh, gioi_tinh, so_cccd_ho_chieu, ma_bhyt, dia_chi)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7)
         RETURNING id`,
        [tkId, p.name, p.birth, p.gender, p.cccd, p.bhyt, p.address]
      );
      patientMap.set(p.username, { tkId, bnId: bnRes.rows[0].id, name: p.name, cccd: p.cccd });
      console.log(`   + [${p.username}] ${p.name} (CCCD: ${p.cccd})`);
    }

    // 3. FIXTURE 1: RECEPTION FIXTURE (Cho Minh test Check-in Online & Offline)
    console.log("\n3. Tạo Fixture 1: Reception (Cho Minh test tiếp đón)...");
    // Dùng bác sĩ Trần Thị Bình (Nội tổng quát, Phòng 102) để không đụng Golden Flow (BS Nguyễn Văn An - P.101)
    const docBinh = docMap.get("Trần Thị Bình");
    const room102Id = roomMap.get("Phòng 102 - Nội tổng quát");
    const recPatient = patientMap.get("benhnhan_mt_rec");

    // Giờ khám = thời điểm hiện tại + 30 phút (đảm bảo luôn rơi vào khung checkin 10 - 60 phút)
    const recAppt = await client.query(
      `INSERT INTO "DatLichKham" (
         ma_dat_lich, qr_code, benh_nhan_id, bac_si_id, phong_kham_id,
         chuyen_khoa_id, ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai
       )
       VALUES (
         'MT-REC-001',
         'MT-REC-001',
         $1,
         $2,
         $3,
         $4,
         (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
         date_trunc('minute', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '30 minutes')::time,
         'Khám nội tổng quát định kỳ (Manual Test Minh)',
         $5,
         'DA_DAT'
       )
       RETURNING id, ma_dat_lich, to_char(ngay_kham, 'YYYY-MM-DD') AS ngay_kham, to_char(gio_kham, 'HH24:MI') AS gio_kham, trang_thai`,
      [recPatient.bnId, docBinh.id, room102Id, docBinh.chuyen_khoa_id, docBinh.muc_phi]
    );
    console.log(`   -> Tạo lịch hẹn ${recAppt.rows[0].ma_dat_lich} thành công!`);
    console.log(`      Bệnh nhân: ${recPatient.name} (CCCD: ${recPatient.cccd})`);
    console.log(`      Bác sĩ: Trần Thị Bình (Phòng 102) | Giờ: ${recAppt.rows[0].gio_kham} hôm nay | Trạng thái: ${recAppt.rows[0].trang_thai}`);

    // 4. FIXTURE 2: DOCTOR FIXTURE (Cho Nam mở workspace là thấy queue và khám ngay)
    console.log("\n4. Tạo Fixture 2: Doctor (Cho Nam test gọi số & khám bệnh)...");
    // Dùng bác sĩ Lê Hoàng Cường (Tim mạch, Phòng 201)
    const docCuong = docMap.get("Lê Hoàng Cường");
    const room201Id = roomMap.get("Phòng 201 - Tim mạch");
    const docPatient = patientMap.get("benhnhan_mt_doc");

    // Tạo lịch hẹn đã check-in
    const docAppt = await client.query(
      `INSERT INTO "DatLichKham" (
         ma_dat_lich, qr_code, benh_nhan_id, bac_si_id, phong_kham_id,
         chuyen_khoa_id, ngay_kham, gio_kham, trieu_chung, phi_kham, trang_thai
       )
       VALUES (
         'MT-DOC-001',
         'MT-DOC-001',
         $1,
         $2,
         $3,
         $4,
         (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
         '08:00:00'::time,
         'Đau tức ngực trái khi gắng sức (Manual Test Nam)',
         $5,
         'DA_CHECK_IN'
       )
       RETURNING id, ma_dat_lich`,
      [docPatient.bnId, docCuong.id, room201Id, docCuong.chuyen_khoa_id, docCuong.muc_phi]
    );

    // Đưa vào Hàng đợi Phòng 201 (trạng thái CHO_KHAM)
    const docQueue = await client.query(
      `INSERT INTO "HangDoi" (
         dat_lich_id, benh_nhan_id, so_thu_tu, phong_kham_id, bac_si_id,
         loai, trang_thai, thoi_gian_check_in, so_lan_goi, so_lan_bo_luot
       )
       VALUES (
         $1,
         $2,
         1,
         $3,
         $4,
         'ONLINE',
         'CHO_KHAM',
         NOW(),
         0,
         0
       )
       RETURNING id, so_thu_tu, loai, trang_thai`,
      [docAppt.rows[0].id, docPatient.bnId, room201Id, docCuong.id]
    );
    console.log(`   -> Đưa bệnh nhân ${docPatient.name} vào Hàng đợi Phòng 201!`);
    console.log(`      Bác sĩ: Lê Hoàng Cường (bs_cuong) | STT: A${docQueue.rows[0].so_thu_tu} | Trạng thái: ${docQueue.rows[0].trang_thai}`);

    // 5. FIXTURE 3: LAB FIXTURE (Cho Chúc mở Lab là thấy phiếu XN để xử lý ngay)
    console.log("\n5. Tạo Fixture 3: Lab (Cho Chúc test xử lý & tải kết quả XN)...");
    // Dùng Phòng Xét nghiệm Sinh hóa (KTV sinhhoa phụ trách)
    const roomSinhHoaId = roomMap.get("Phòng Xét nghiệm Sinh hóa");
    const docDung = docMap.get("Phạm Minh Dũng");
    const labPatient = patientMap.get("benhnhan_mt_lab");

    // Tạo hồ sơ bệnh án đang khám
    const labHs = await client.query(
      `INSERT INTO "HoSoBenhAn" (benh_nhan_id, bac_si_id, ngay_kham, trang_thai)
       VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'DANG_KHAM')
       RETURNING id`,
      [labPatient.bnId, docDung.id]
    );
    const hsId = labHs.rows[0].id;

    await client.query(
      `INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan)
       VALUES ($1, 'Bệnh nhân chóng mặt, nghi ngờ rối loạn chuyển hóa đường huyết (Manual Test Chúc)')`,
      [hsId]
    );

    // Tạo chỉ định xét nghiệm CHO_XU_LY
    const labOrder = await client.query(
      `INSERT INTO "ChiDinhXetNghiem" (
         ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu,
         trang_thai, thoi_gian_chi_dinh
       )
       VALUES (
         $1,
         $2,
         'Sinh hóa máu: Định lượng Glucose và Acid Uric (Manual Test Chúc)',
         'Lấy mẫu máu tĩnh mạch lúc đói',
         'CHO_XU_LY',
         NOW()
       )
       RETURNING id, ten_xet_nghiem, trang_thai`,
      [hsId, roomSinhHoaId]
    );
    console.log(`   -> Tạo chỉ định xét nghiệm ID ${labOrder.rows[0].id} tại Phòng Xét nghiệm Sinh hóa!`);
    console.log(`      Bệnh nhân: ${labPatient.name} | Xét nghiệm: ${labOrder.rows[0].ten_xet_nghiem} | Trạng thái: ${labOrder.rows[0].trang_thai}`);

    await client.query("COMMIT");
    console.log("\n KHỞI TẠO MANUAL-TEST FIXTURES THÀNH CÔNG 100%!");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(" LỖI KHI TẠO FIXTURES:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedManualTestFixtures();
