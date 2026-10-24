# C2-03 — Master API Contract (Booking Data)

- **Trạng thái:** đã implement + verify trên PostgreSQL Neon (2026-10-24).
- **Phạm vi:** dữ liệu nền (chuyên khoa, bác sĩ, phòng khám, lịch khám) + API đọc phục vụ UC006.
- **KHÔNG thuộc task này:** tính slot availability (C2-04), tạo `DatLichKham`, QR, Admin CRUD, Frontend.

---

## 1. Quy ước chung

| Nội dung | Giá trị |
|---|---|
| Base URL (local) | `http://localhost:3000` |
| Router | `/api/master` (mount trong `backend/src/routes/index.js`) |
| Envelope thành công | `{ "success": true, "data": ... }` |
| Envelope lỗi | `{ "success": false, "message": "..." }` |
| Tên field | `snake_case`, giống tên cột DB (trừ `muc_phi` được cast sang number) |
| Thứ tự danh sách | `ORDER BY id` tăng dần |
| CORS | đã bật cho `http://localhost:5173` (cấu hình sẵn trong `app.js`) |

---

## 2. `GET /api/master/chuyen-khoa`

Lấy danh sách chuyên khoa (bước 1 của UC006). Không có parameter.

**Response 200 (dữ liệu thật):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ten_chuyen_khoa": "Nội tổng quát",
      "mo_ta": "Khám, chẩn đoán và điều trị các bệnh lý nội khoa thông thường và tổng quát."
    },
    {
      "id": 2,
      "ten_chuyen_khoa": "Tim mạch",
      "mo_ta": "Chẩn đoán và điều trị các bệnh lý tim mạch, huyết áp và hệ tuần hoàn."
    },
    {
      "id": 3,
      "ten_chuyen_khoa": "Nhi",
      "mo_ta": "Khám và chăm sóc sức khỏe toàn diện cho trẻ sơ sinh và trẻ nhỏ."
    },
    {
      "id": 4,
      "ten_chuyen_khoa": "Tai Mũi Họng",
      "mo_ta": "Khám, tầm soát và điều trị các bệnh lý vùng tai, mũi và họng."
    }
  ]
}
```

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | number | Khóa chính `ChuyenKhoa.id` |
| `ten_chuyen_khoa` | string | Tên hiển thị |
| `mo_ta` | string \| null | Mô tả ngắn |

Không trả `so_bac_si` (đã chốt: giữ API tối giản theo Q4).

**Lỗi:** `500` → `{ "success": false, "message": "Không truy vấn được database" }`

---

## 3. `GET /api/master/bac-si?chuyen_khoa_id=<id>`

Lấy danh sách bác sĩ theo chuyên khoa (bước 2 của UC006).

| Parameter | Vị trí | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| `chuyen_khoa_id` | query | integer > 0 | Không | Bỏ trống → trả **tất cả** bác sĩ (tiện test) |

**Response 200 (dữ liệu thật, `chuyen_khoa_id=1`):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ho_ten": "Trần Thị Bình",
      "cap_bac": "Thạc sĩ, Bác sĩ",
      "muc_phi": 350000,
      "chuyen_khoa_id": 1,
      "ten_chuyen_khoa": "Nội tổng quát"
    },
    {
      "id": 2,
      "ho_ten": "Nguyễn Văn An",
      "cap_bac": "Bác sĩ chuyên khoa I",
      "muc_phi": 300000,
      "chuyen_khoa_id": 1,
      "ten_chuyen_khoa": "Nội tổng quát"
    }
  ]
}
```

**Response 200 (dữ liệu thật, `chuyen_khoa_id=3`):**

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "ho_ten": "Võ Thị Hạnh",
      "cap_bac": "Bác sĩ chuyên khoa I",
      "muc_phi": 300000,
      "chuyen_khoa_id": 3,
      "ten_chuyen_khoa": "Nhi"
    }
  ]
}
```

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | number | `BacSi.id` – dùng làm `bac_si_id` cho C2-04 |
| `ho_ten` | string | Tên bác sĩ (không kèm học vị) |
| `cap_bac` | string \| null | Học vị/cấp bậc hiển thị trên card |
| `muc_phi` | number \| null | **Số** tiền VND (đã cast `::float8`, KHÔNG phải string) |
| `chuyen_khoa_id` | number \| null | FK chuyên khoa |
| `ten_chuyen_khoa` | string \| null | Tên chuyên khoa (LEFT JOIN) |

**Lỗi 400 (dữ liệu thật):**

```json
HTTP 400
{ "success": false, "message": "chuyen_khoa_id không hợp lệ" }
```

Áp dụng khi `chuyen_khoa_id` = `abc`, `0`, `-1`, `1.5`, rỗng.

**Chuyên khoa không tồn tại (dữ liệu thật):**

```json
HTTP 200
{ "success": true, "data": [] }
```

> Endpoint này **không** trả số slot còn trống và **không** trả phòng khám.
> Phòng khám là thuộc tính của từng khung giờ → do API của C2-04 trả (`LichKhamBacSi.phong_kham_id`).

---

## 4. Dữ liệu nền seed sẵn (bàn giao C2-04)

Bảng thật trong DB sau khi chạy `npm run db:seed` (ID lấy trực tiếp từ DB):

| `bac_si_id` | Bác sĩ | Chuyên khoa | `phong_kham_id` | Phòng |
|---|---|---|---|---|
| 1 | Trần Thị Bình | Nội tổng quát (1) | 2 | Phòng 102 - Nội tổng quát |
| 2 | Nguyễn Văn An | Nội tổng quát (1) | 1 | Phòng 101 - Nội tổng quát |
| 3 | Phạm Minh Dũng | Tim mạch (2) | 4 | Phòng 202 - Tim mạch |
| 4 | Lê Hoàng Cường | Tim mạch (2) | 3 | Phòng 201 - Tim mạch |
| 5 | Võ Thị Hạnh | Nhi (3) | 5 | Phòng 301 - Nhi |
| 6 | Đặng Quốc Khánh | Tai Mũi Họng (4) | 6 | Phòng 401 - Tai Mũi Họng |

**`LichKhamBacSi`:** **240 record** = 6 bác sĩ × 5 ngày × 8 khung giờ.

Mỗi record = **1 bác sĩ + 1 ngày + 1 phòng + 1 khung giờ (dài 1 tiếng)**. Không có record đại diện cho cả ca.

| Khung giờ (UC-030) | Số record | `so_slot_toi_da` | `so_slot_online` | `so_slot_da_dat` | Online còn lại |
|---|---|---|---|---|---|
| `06:00–07:00` | 30 | 6 | 4 | 0 | 4 |
| `07:00–08:00` | 30 | 6 | 4 | 0 | 4 |
| `08:00–09:00` | 30 | 6 | 4 | 0 | 4 |
| `09:00–10:00` | 30 | 6 | 4 | 0 | 4 |
| `10:00–11:00` | 30 | 6 | 4 | 0 | 4 |
| `13:00–14:00` | 30 | 6 | 4 | 0 | 4 |
| `14:00–15:00` | 30 | 6 | 4 | 0 | 4 |
| `15:00–16:00` | 30 | 6 | 4 | 0 | 4 |

Ngày: `2026-10-25` → `2026-10-29` (ngày mai → +5 ngày tính theo giờ VN, tự dời khi seed lại).
Cấu hình `6 / 4 / 0` là **demo config**, không phải business rule — Admin có thể đổi theo UC-031.

**Ví dụ dữ liệu thật** — bác sĩ `bac_si_id = 2` (Nguyễn Văn An), ngày `2026-10-25`, phòng `1` (Phòng 101):

```text
06:00–07:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
07:00–08:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
08:00–09:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
09:00–10:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
10:00–11:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
13:00–14:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
14:00–15:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
15:00–16:00 | phong_kham_id=1 | max=6 | online=4 | booked=0 | còn 4
```

**Semantics cuối cùng (mỗi record là một khung giờ):**

```text
MỖI RECORD "LichKhamBacSi" = 1 bác sĩ + 1 ngày + 1 phòng + 1 khung giờ (1 giờ)
gio_bat_dau / gio_ket_thuc = giới hạn của chính khung giờ đó
so_slot_toi_da             = tổng sức chứa của khung giờ (UC-031, Admin cấu hình)
so_slot_online             = phần sức chứa của khung giờ dành cho bệnh nhân online
so_slot_da_dat             = số lượt online đã đặt TRONG CHÍNH khung giờ đó
available_online           = so_slot_online - so_slot_da_dat
offline_capacity           = so_slot_toi_da - so_slot_online
trang_thai                 = 'HoatDong' (được đặt) | 'DaHuy' (bỏ qua) | 'HetCho' (đầy)
unique index               = ux_lichkhambacsi_bacsi_ngay_gio (bac_si_id, ngay, gio_bat_dau)
```

> **Không** chia một record `06:00–11:00` thành các mốc bên trong nữa; mỗi khung 1 giờ đã là một record riêng.

**Handoff C2-04 (đơn giản, không cần sinh mốc giờ):**

```sql
SELECT l.id,
       l."phong_kham_id", p."ten_phong",
       l."ngay"::text        AS ngay,           -- tránh lệch ngày do timezone
       l."gio_bat_dau"::text AS gio_bat_dau,
       l."gio_ket_thuc"::text AS gio_ket_thuc,
       (l."so_slot_online" - l."so_slot_da_dat")::int AS slot_con_lai
FROM "LichKhamBacSi" l
LEFT JOIN "PhongKham" p ON p.id = l."phong_kham_id"
WHERE l."bac_si_id" = $1
  AND l."ngay" = $2
  AND l."trang_thai" = 'HoatDong'
  AND (l."so_slot_online" - l."so_slot_da_dat") > 0
  -- UC-008: khung còn dưới 10 phút trước giờ hẹn thì không được đặt
  AND (l."ngay" + l."gio_bat_dau") > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '10 minutes'
ORDER BY l."gio_bat_dau";
```

- Mỗi row trả về **chính là một khung giờ** hiển thị cho UC-007.
- UC-008 do C2-04/C2-06 thực thi (điều kiện 10 phút ở trên); C2-03 không implement booking.

> **Điểm UC chưa nói rõ (không ảnh hưởng schema):** lịch áp dụng những ngày nào trong tuần —
> seed hiện tạo mọi ngày từ ngày mai đến +5 ngày; và "giờ hẹn" trong UC-008 đang được hiểu là
> `gio_bat_dau` của khung giờ.

**Lưu ý serialize DATE (bắt buộc cho C2-04):** cột `ngay` là `DATE`, node-postgres parse thành
`Date` nên `JSON.stringify` sẽ ra `"2026-10-25T00:00:00.000Z"` (lệch ngày khi client ở GMT+7).
API lịch của C2-04 phải `SELECT ngay::text AS ngay` để trả `"2026-10-25"`.

---

## 5. Cách Frontend (C2-05) gọi API

`apiClient` trả về **nguyên envelope**, nên đọc `res.data`:

```js
import { apiClient } from '../api/client'

// Bước 1: danh sách chuyên khoa
const specialtyRes = await apiClient.get('/api/master/chuyen-khoa')
const specialties = specialtyRes.data // [{ id, ten_chuyen_khoa, mo_ta }]

// Bước 2: bác sĩ theo chuyên khoa đã chọn
const doctorRes = await apiClient.get(`/api/master/bac-si?chuyen_khoa_id=${specialtyId}`)
const doctors = doctorRes.data // [{ id, ho_ten, cap_bac, muc_phi, chuyen_khoa_id, ten_chuyen_khoa }]

// muc_phi là number (VND), ví dụ hiển thị:
const phi = doctor.muc_phi?.toLocaleString('vi-VN') + ' đ'
```

---

## 6. Kiểm chứng (đã chạy PASS)

```powershell
cd backend
npm run db:schema         # tạo index (idempotent)
npm run db:verify         # 15 bảng + 9 FK: PASS
npm run db:seed           # seed idempotent (chạy 2 lần vẫn 6 bác sĩ / 6 phòng / 240 khung)
npm run db:verify-seed    # 5 khối kiểm tra (có kiểm tra 8 khung 1 giờ theo UC-030): PASS
npm run api:verify-master # 49 PASS / 0 FAIL
```

`db:verify-seed` kiểm tra thêm: mọi record phải thuộc đúng 8 khung 1 tiếng
(`06:00–07:00` … `10:00–11:00`, `13:00–14:00` … `15:00–16:00`), không có record cho cả ca
`06:00–11:00`/`13:00–16:00`, mỗi cặp bác sĩ/ngày có đúng 8 khung, và
`so_slot_da_dat <= so_slot_online <= so_slot_toi_da`.

---

## 7. Ngoài phạm vi C2-03

- Không có API tính slot còn trống / danh sách ngày (C2-04).
- Không có API tạo `DatLichKham`, mã `ma_dat_lich`, QR (C2-05/C2-06).
- Không có Admin CRUD cho chuyên khoa/bác sĩ/phòng/lịch.
- Không có tài khoản đăng nhập cho bác sĩ (`BacSi.tai_khoan_id = NULL`).
