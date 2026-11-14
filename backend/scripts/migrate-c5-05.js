const pool = require("../src/config/db");

// C5-05: thêm bảng ThongBao + trigger tạo thông báo khi ChiDinhXetNghiem chuyển sang DA_XONG.
// Chạy lặp an toàn (IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS). Cùng nội dung với cuối database/schema.sql.
const SQL = `
-- -----------------------------------------------------------------------------
-- NHÓM 7: THÔNG BÁO BỆNH NHÂN (C5-05)
-- -----------------------------------------------------------------------------
-- Thông báo tối thiểu cho Chặng 5: khi chỉ định xét nghiệm chuyển sang DA_XONG, bệnh nhân
-- (có tài khoản đăng nhập) nhận 1 thông báo cố định, KHÔNG chứa nội dung/số liệu xét nghiệm.
-- Trigger chạy cùng transaction với việc đổi trạng thái nên không thể lệch nhau;
-- UNIQUE (loai, chi_dinh_id) đảm bảo mỗi chỉ định chỉ có tối đa 1 thông báo.
CREATE TABLE IF NOT EXISTS "ThongBao" (
    "id" SERIAL PRIMARY KEY,
    "benh_nhan_id" INTEGER NOT NULL REFERENCES "BenhNhan"("id") ON DELETE CASCADE,
    "loai" VARCHAR(50) NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "ho_so_id" INTEGER REFERENCES "HoSoBenhAn"("id") ON DELETE CASCADE,
    "chi_dinh_id" INTEGER REFERENCES "ChiDinhXetNghiem"("id") ON DELETE CASCADE,
    "da_doc" BOOLEAN NOT NULL DEFAULT FALSE,
    "thoi_gian_tao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_thongbao_loai_chidinh"
    ON "ThongBao" ("loai", "chi_dinh_id");

CREATE INDEX IF NOT EXISTS "ix_thongbao_benhnhan_thoigian"
    ON "ThongBao" ("benh_nhan_id", "thoi_gian_tao" DESC);

CREATE OR REPLACE FUNCTION "fn_thongbao_ketqua_xetnghiem"() RETURNS trigger AS $fn$
BEGIN
    INSERT INTO "ThongBao" ("benh_nhan_id", "loai", "noi_dung", "ho_so_id", "chi_dinh_id")
    SELECT bn."id",
           'KET_QUA_XET_NGHIEM',
           'Đã có kết quả xét nghiệm, vui lòng quay lại phòng khám.',
           NEW."ho_so_id",
           NEW."id"
    FROM "HoSoBenhAn" hs
    JOIN "BenhNhan" bn ON bn."id" = hs."benh_nhan_id"
    WHERE hs."id" = NEW."ho_so_id"
      AND bn."tai_khoan_id" IS NOT NULL
    ON CONFLICT ("loai", "chi_dinh_id") DO NOTHING;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_thongbao_ketqua_xetnghiem" ON "ChiDinhXetNghiem";
CREATE TRIGGER "trg_thongbao_ketqua_xetnghiem"
    AFTER UPDATE OF "trang_thai" ON "ChiDinhXetNghiem"
    FOR EACH ROW
    WHEN (NEW."trang_thai" = 'DA_XONG' AND OLD."trang_thai" IS DISTINCT FROM 'DA_XONG')
    EXECUTE FUNCTION "fn_thongbao_ketqua_xetnghiem"();
`;

async function migrateC505() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026111301)");

    console.log("1. Tạo bảng ThongBao, index, hàm và trigger thông báo kết quả xét nghiệm...");
    await client.query(SQL);

    await client.query("COMMIT");
    console.log("C5-05 migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C5-05 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC505();
