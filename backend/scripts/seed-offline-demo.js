// C3-04 — Tạo dữ liệu mẫu để C3-05 / C3-06 / C3-08 test nhanh.
// Việc làm: (1) tạo tài khoản Lễ tân demo (nếu chưa có), (2) tiếp nhận 3 bệnh nhân Offline mẫu
// vào phòng đầu tiên của chuyên khoa "Nội tổng quát" qua chính API tiếp nhận.
// Chạy: backend đang chạy ở localhost:3000, rồi `npm run db:seed-offline-demo`.
// Chạy lại nhiều lần an toàn: bệnh nhân đã đang trong hàng đợi sẽ bị API từ chối (409) và được bỏ qua.
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE = "http://localhost:3000/api";
const USERNAME = "lt_demo";
const PASSWORD = "123456";

const SAMPLES = [
  { ho_ten: "Demo Offline Một", so_cccd_ho_chieu: "DEMO000000001", ngay_sinh: "1990-01-15", gioi_tinh: "Nam", dia_chi: "Hà Nội", trieu_chung: "Đau đầu, chóng mặt" },
  { ho_ten: "Demo Offline Hai", so_cccd_ho_chieu: "DEMO000000002", ngay_sinh: "1985-07-02", gioi_tinh: "Nữ", dia_chi: "Hà Nội", trieu_chung: "Ho kéo dài 1 tuần" },
  { ho_ten: "Demo Offline Ba", so_cccd_ho_chieu: "DEMO000000003", ngay_sinh: "2001-11-30", gioi_tinh: "Nam", dia_chi: "Hải Phòng", trieu_chung: "Đau bụng" },
];

async function main() {
  const role = await pool.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = 'Lễ tân'`);
  if (role.rowCount === 0) throw new Error("Chưa có vai trò 'Lễ tân' (chạy npm run db:seed trước)");

  const exists = await pool.query(`SELECT id FROM "TaiKhoan" WHERE ten_dang_nhap = $1`, [USERNAME]);
  if (exists.rowCount === 0) {
    await pool.query(
      `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1, $2, $3, 'HoatDong')`,
      [USERNAME, await bcrypt.hash(PASSWORD, 10), role.rows[0].id]
    );
    console.log(`Đã tạo tài khoản Lễ tân demo: ${USERNAME} / ${PASSWORD}`);
  } else {
    console.log(`Tài khoản Lễ tân demo đã có: ${USERNAME} / ${PASSWORD}`);
  }

  const room = await pool.query(
    `SELECT pk.id, pk.ten_phong, pk.chuyen_khoa_id
     FROM "PhongKham" pk JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
     WHERE ck.ten_chuyen_khoa = 'Nội tổng quát' ORDER BY pk.id LIMIT 1`
  );
  if (room.rowCount === 0) throw new Error("Không có phòng thuộc 'Nội tổng quát' (chạy npm run db:seed trước)");
  const { id: phongId, ten_phong: tenPhong, chuyen_khoa_id: chuyenKhoaId } = room.rows[0];

  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  }).catch(() => null);
  if (!login) throw new Error("Không gọi được Backend. Hãy chạy `npm run dev` ở một terminal khác trước.");
  const token = (await login.json())?.data?.token;
  if (!token) throw new Error("Đăng nhập tài khoản demo thất bại");

  console.log(`\nPhòng dùng để tạo mẫu: id=${phongId} (${tenPhong})`);
  for (const s of SAMPLES) {
    const { trieu_chung, ...patient } = s;
    const res = await fetch(`${BASE}/reception/offline-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patient, trieu_chung, chuyen_khoa_id: chuyenKhoaId, phong_kham_id: phongId }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 201) {
      const q = json.data.queue;
      console.log(`  + ${s.ho_ten}: STT ${q.stt_hien_thi} | ${q.loai} | ${q.trang_thai} | queue id ${q.id}`);
    } else {
      console.log(`  - ${s.ho_ten}: bỏ qua (HTTP ${res.status}: ${json.message})`);
    }
  }
}

main()
  .catch((e) => {
    console.error("LỖI:", e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
