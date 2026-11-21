const pool = require("../src/config/db");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../src/config/jwt");

async function verifyManualTestFixtures() {
  console.log("=== KIỂM TRA TOÀN DIỆN MANUAL-TEST FIXTURES & CÁCH LY GOLDEN E2E ===\n");
  let passCount = 0;
  let failCount = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failCount++;
    }
  }

  try {
    // 1. Kiểm tra Fixture Reception (Minh)
    const recRes = await pool.query(`
      SELECT d.id, d.ma_dat_lich, d.qr_code, d.trang_thai,
             to_char(d.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
             to_char(d.gio_kham, 'HH24:MI') AS gio_kham,
             EXTRACT(EPOCH FROM ((d.ngay_kham + d.gio_kham) - (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))) AS giay_con_lai,
             bn.ho_ten, bn.so_cccd_ho_chieu,
             bs.ho_ten AS bac_si_ten, pk.ten_phong
      FROM "DatLichKham" d
      JOIN "BenhNhan" bn ON bn.id = d.benh_nhan_id
      JOIN "BacSi" bs ON bs.id = d.bac_si_id
      JOIN "PhongKham" pk ON pk.id = d.phong_kham_id
      WHERE d.ma_dat_lich = 'MT-REC-001'
    `);

    assert(recRes.rowCount === 1, "Tìm thấy lịch hẹn MT-REC-001");
    if (recRes.rowCount === 1) {
      const row = recRes.rows[0];
      assert(row.trang_thai === "DA_DAT", "MT-REC-001 ở trạng thái DA_DAT");
      assert(row.so_cccd_ho_chieu === "001099000001", "Bệnh nhân CCCD = 001099000001 (Lê Văn Minh Test)");
      assert(row.bac_si_ten === "Trần Thị Bình", "Khám với BS Trần Thị Bình (Phòng 102, khác BS An)");
      assert(row.giay_con_lai > 600 && row.giay_con_lai <= 3600, `Giờ hẹn hợp lệ trong khung check-in (${Math.round(row.giay_con_lai / 60)} phút còn lại)`);
    }

    // 2. Kiểm tra Fixture Doctor (Nam)
    // Lấy ID tài khoản bs_cuong
    const docAcc = await pool.query(`
      SELECT t.id AS tai_khoan_id, b.id AS bac_si_id, b.ho_ten
      FROM "TaiKhoan" t
      JOIN "BacSi" b ON b.tai_khoan_id = t.id
      WHERE t.ten_dang_nhap = 'bs_cuong'
    `);
    assert(docAcc.rowCount === 1, "Tài khoản bác sĩ bs_cuong tồn tại");

    if (docAcc.rowCount === 1) {
      const doc = docAcc.rows[0];
      const queueRes = await pool.query(`
        SELECT h.id, h.so_thu_tu, h.loai, h.trang_thai,
               bn.ho_ten, bn.so_cccd_ho_chieu, pk.ten_phong
        FROM "HangDoi" h
        JOIN "BenhNhan" bn ON bn.id = h.benh_nhan_id
        JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
        WHERE h.bac_si_id = $1
          AND (h.thoi_gian_check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          AND h.trang_thai = 'CHO_KHAM'
      `, [doc.bac_si_id]);

      assert(queueRes.rowCount >= 1, "Bác sĩ Cường thấy ít nhất 1 bệnh nhân trong hàng đợi CHO_KHAM");
      if (queueRes.rowCount >= 1) {
        const q = queueRes.rows[0];
        assert(q.so_thu_tu === 1 && q.loai === "ONLINE", "Bệnh nhân có số thứ tự A1 (ONLINE)");
        assert(q.so_cccd_ho_chieu === "001099000002", "Bệnh nhân là Hoàng Nam Doctor Test (CCCD 001099000002)");
        assert(q.ten_phong === "Phòng 201 - Tim mạch", "Đúng phòng 201 - Tim mạch");
      }
    }

    // 3. Kiểm tra Fixture Lab (Chúc)
    const labAcc = await pool.query(`
      SELECT t.id AS tai_khoan_id, t.phong_kham_id, pk.ten_phong
      FROM "TaiKhoan" t
      LEFT JOIN "PhongKham" pk ON pk.id = t.phong_kham_id
      WHERE t.ten_dang_nhap = 'ktv_sinhhoa'
    `);
    assert(labAcc.rowCount === 1, "Tài khoản ktv_sinhhoa tồn tại và có phòng khám");

    if (labAcc.rowCount === 1) {
      const lab = labAcc.rows[0];
      assert(lab.ten_phong === "Phòng Xét nghiệm Sinh hóa", "ktv_sinhhoa gán đúng Phòng Xét nghiệm Sinh hóa");

      const labOrders = await pool.query(`
        SELECT c.id, c.ten_xet_nghiem, c.trang_thai,
               bn.ho_ten, hs.trang_thai AS hs_trang_thai
        FROM "ChiDinhXetNghiem" c
        JOIN "HoSoBenhAn" hs ON hs.id = c.ho_so_id
        JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
        WHERE c.phong_kham_id = $1 AND c.trang_thai = 'CHO_XU_LY'
      `, [lab.phong_kham_id]);

      assert(labOrders.rowCount >= 1, "Phòng Xét nghiệm Sinh hóa có phiếu xét nghiệm CHO_XU_LY");
      if (labOrders.rowCount >= 1) {
        const o = labOrders.rows[0];
        assert(o.ho_ten === "Trần Thị Chúc Test", "Phiếu xét nghiệm của bệnh nhân Trần Thị Chúc Test");
        assert(o.trang_thai === "CHO_XU_LY", "Trạng thái chỉ định là CHO_XU_LY");
      }
    }

    // 4. KIỂM TRA CÁCH LY GOLDEN E2E DATA (KHÔNG BỊ ĐỤNG)
    console.log("\n--- KIỂM TRA BẢO TOÀN DỮ LIỆU GOLDEN E2E ---");

    // Golden Patient 1: benhnhan_01
    const p1Check = await pool.query(`
      SELECT count(*) AS total_appts
      FROM "DatLichKham" d
      JOIN "BenhNhan" bn ON bn.id = d.benh_nhan_id
      JOIN "TaiKhoan" t ON t.id = bn.tai_khoan_id
      WHERE t.ten_dang_nhap = 'benhnhan_01'
    `);
    assert(Number(p1Check.rows[0].total_appts) === 0, "Golden Patient benhnhan_01 sạch 100% (0 lịch hẹn)");

    // Golden Patient 2: benhnhan_02
    const p2Check = await pool.query(`
      SELECT count(*) AS total_appts
      FROM "DatLichKham" d
      JOIN "BenhNhan" bn ON bn.id = d.benh_nhan_id
      JOIN "TaiKhoan" t ON t.id = bn.tai_khoan_id
      WHERE t.ten_dang_nhap = 'benhnhan_02'
    `);
    assert(Number(p2Check.rows[0].total_appts) === 0, "Patient benhnhan_02 (Ngọc Anh) sạch 100% (0 lịch hẹn, sẵn sàng test booking)");

    // Golden Doctor: bs_an
    const docAnCheck = await pool.query(`
      SELECT count(*) AS total_queue
      FROM "HangDoi" h
      JOIN "BacSi" b ON b.id = h.bac_si_id
      JOIN "TaiKhoan" t ON t.id = b.tai_khoan_id
      WHERE t.ten_dang_nhap = 'bs_an'
    `);
    assert(Number(docAnCheck.rows[0].total_queue) === 0, "Golden Doctor bs_an sạch 100% (0 hàng đợi)");

    // Golden Lab: ktv_huyethoc & Phòng Huyết học
    const labHhCheck = await pool.query(`
      SELECT count(*) AS total_orders
      FROM "ChiDinhXetNghiem" c
      JOIN "PhongKham" pk ON pk.id = c.phong_kham_id
      WHERE pk.ten_phong = 'Phòng Xét nghiệm Huyết học'
    `);
    assert(Number(labHhCheck.rows[0].total_orders) === 0, "Golden Lab Phòng Xét nghiệm Huyết học sạch 100% (0 chỉ định)");

    // Golden Room 101
    const room101Check = await pool.query(`
      SELECT count(*) AS total_queue
      FROM "HangDoi" h
      JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
      WHERE pk.ten_phong = 'Phòng 101 - Nội tổng quát'
    `);
    assert(Number(room101Check.rows[0].total_queue) === 0, "Golden Room 101 sạch 100% (0 hàng đợi)");

    console.log(`\n=== TỔNG KẾT: ${passCount} PASS, ${failCount} FAIL ===`);
    if (failCount > 0) process.exitCode = 1;
  } catch (error) {
    console.error("Lỗi khi kiểm tra fixtures:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

verifyManualTestFixtures();
