const pool = require("../src/config/db");

const STANDARD_SPECIALTIES = [
  "Nội tổng quát",
  "Tim mạch",
  "Nhi",
  "Tai Mũi Họng",
];

const STANDARD_ROOMS = [
  "Phòng 101 - Nội tổng quát",
  "Phòng 102 - Nội tổng quát",
  "Phòng 201 - Tim mạch",
  "Phòng 202 - Tim mạch",
  "Phòng 301 - Nhi",
  "Phòng 401 - Tai Mũi Họng",
  "Phòng Xét nghiệm Huyết học",
  "Phòng Xét nghiệm Sinh hóa",
  "Phòng Chẩn đoán hình ảnh",
];

const STANDARD_DOCTORS = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Hoàng Cường",
  "Phạm Minh Dũng",
  "Võ Thị Hạnh",
  "Đặng Quốc Khánh",
];

const STANDARD_ACCOUNTS = [
  "admin",
  "letan_01",
  "letan_02",
  "bs_an",
  "bs_binh",
  "bs_cuong",
  "bs_dung",
  "bs_hanh",
  "bs_khanh",
  "ktv_huyethoc",
  "ktv_sinhhoa",
  "ktv_cdha",
  "benhnhan_01",
  "benhnhan_02",
];

async function cleanJunkData() {
  console.log("=== BẮT ĐẦU DỌN DẸP DỮ LIỆU RÁC & LÀM SẠCH DATABASE ===");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026112001)");

    console.log("1. Xóa toàn bộ dữ liệu giao dịch cũ (transactional data)...");
    await client.query('DELETE FROM "KetQuaXetNghiem"');
    await client.query('DELETE FROM "ThongBao"');
    await client.query('DELETE FROM "ChiDinhXetNghiem"');
    await client.query('DELETE FROM "KetQuaKham"');
    await client.query('DELETE FROM "HoSoBenhAn"');
    await client.query('DELETE FROM "HangDoi"');
    await client.query('DELETE FROM "DatLichKham"');
    console.log("   -> Đã xóa dữ liệu giao dịch khám bệnh / hàng đợi / xét nghiệm cũ.");

    console.log("2. Xóa toàn bộ lịch khám cũ / lịch ngoài bác sĩ chuẩn...");
    await client.query('DELETE FROM "LichKhamBacSi"');
    console.log("   -> Đã xóa các slot lịch khám cũ (sẽ được seed lại từ ngày hôm nay).");

    console.log("3. Gỡ liên kết phòng và tài khoản tạm thời để dọn dẹp...");
    await client.query(
      `UPDATE "TaiKhoan" SET phong_kham_id = NULL
       WHERE NOT (ten_dang_nhap = ANY($1::text[]))`,
      [STANDARD_ACCOUNTS]
    );
    await client.query(
      `UPDATE "BacSi" SET tai_khoan_id = NULL
       WHERE NOT (ho_ten = ANY($1::text[]))`,
      [STANDARD_DOCTORS]
    );

    console.log("4. Xóa các hồ sơ bệnh nhân rác...");
    const delBn = await client.query(
      `DELETE FROM "BenhNhan"
       WHERE tai_khoan_id IS NULL
          OR tai_khoan_id IN (
            SELECT id FROM "TaiKhoan" WHERE NOT (ten_dang_nhap = ANY($1::text[]))
          )`,
      [STANDARD_ACCOUNTS]
    );
    console.log(`   -> Đã xóa ${delBn.rowCount} hồ sơ bệnh nhân rác.`);

    console.log("5. Xóa các bác sĩ không thuộc danh sách chuẩn...");
    const delBs = await client.query(
      `DELETE FROM "BacSi" WHERE NOT (ho_ten = ANY($1::text[]))`,
      [STANDARD_DOCTORS]
    );
    console.log(`   -> Đã xóa ${delBs.rowCount} bác sĩ rác.`);

    console.log("6. Xóa các tài khoản không thuộc danh sách chuẩn...");
    const delTk = await client.query(
      `DELETE FROM "TaiKhoan" WHERE NOT (ten_dang_nhap = ANY($1::text[]))`,
      [STANDARD_ACCOUNTS]
    );
    console.log(`   -> Đã xóa ${delTk.rowCount} tài khoản rác/test.`);

    console.log("7. Xóa các phòng không thuộc danh sách chuẩn...");
    const delPk = await client.query(
      `DELETE FROM "PhongKham" WHERE NOT (ten_phong = ANY($1::text[]))`,
      [STANDARD_ROOMS]
    );
    console.log(`   -> Đã xóa ${delPk.rowCount} phòng rác.`);

    console.log("8. Xóa các chuyên khoa không thuộc danh sách chuẩn...");
    const delCk = await client.query(
      `DELETE FROM "ChuyenKhoa" WHERE NOT (ten_chuyen_khoa = ANY($1::text[]))`,
      [STANDARD_SPECIALTIES]
    );
    console.log(`   -> Đã xóa ${delCk.rowCount} chuyên khoa rác.`);

    console.log("9. Chuẩn hóa QuyTrinhKham & TinTuc...");
    await client.query('DELETE FROM "QuyTrinhKham"');
    await client.query(
      `DELETE FROM "TinTuc" WHERE tieu_de NOT IN (
        'Lịch làm việc và hướng dẫn đăng ký khám bệnh tại MEDICARE',
        'Khuyến cáo phòng ngừa bệnh đường hô hấp giao mùa',
        'Quy trình xét nghiệm cận lâm sàng nhanh chóng và tiện lợi'
      )`
    );

    await client.query("COMMIT");
    console.log("\n THỰC THI DỌN DẸP DỮ LIỆU RÁC THÀNH CÔNG!");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(" LỖI KHI DỌN DẸP DỮ LIỆU:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanJunkData();
