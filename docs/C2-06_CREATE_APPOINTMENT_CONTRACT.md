# C2-06 — Create Appointment API Contract (UC-008)

- **Trạng thái:** đã implement; test script 29 PASS / 0 FAIL trên PostgreSQL Neon (2026-10-26), đã dọn dữ liệu test.
- **Phạm vi:** tạo lịch hẹn `DatLichKham` từ một khung giờ (`lich_kham_id` của C2-04).
- **Người dùng contract:** C2-07 (màn hình đặt lịch thành công + QR), C2-08A (danh sách/chi tiết lịch hẹn).
- **KHÔNG thuộc task này:** danh sách/chi tiết lịch, hủy lịch, check-in/queue, thanh toán, lưu BHYT, UI.

## 1. Quy ước chung

| Nội dung | Giá trị |
|---|---|
| Endpoint | `POST /api/appointments` |
| Xác thực | Bắt buộc `Authorization: Bearer <JWT>` (middleware `authenticate` của C2-01) |
| Envelope thành công | `{ "success": true, "data": ... }` |
| Envelope lỗi | `{ "success": false, "message": "..." }` |
| Tên field | `snake_case` |

## 2. Request

```json
{ "lich_kham_id": 3, "trieu_chung": "Đau đầu" }
```

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `lich_kham_id` | integer > 0 | Có | `lich_kham_id` trong response của `GET /api/slots` (= `LichKhamBacSi.id`) |
| `trieu_chung` | string | Không | Tối đa 1000 ký tự; chuỗi rỗng/chỉ khoảng trắng coi như không có |

- **Không** gửi `benh_nhan_id`, `bac_si_id`, `phong_kham_id`, giờ, phí: backend tự lấy từ token và từ dòng lịch.
- Bệnh nhân được xác định từ tài khoản đang đăng nhập (`BenhNhan.tai_khoan_id = token.id`).

## 3. Cách lưu `DatLichKham` (map từ `lich_kham_id`)

| Cột `DatLichKham` | Giá trị |
|---|---|
| `ma_dat_lich` | Sinh tự động: `DL<YYYYMMDD>-<8 ký tự hex in hoa>`, ví dụ `DL20261028-A1B2C3D4` (UNIQUE) |
| `benh_nhan_id` | `BenhNhan.id` của tài khoản đang đăng nhập |
| `bac_si_id` | `LichKhamBacSi.bac_si_id` |
| `phong_kham_id` | `LichKhamBacSi.phong_kham_id` |
| `chuyen_khoa_id` | `BacSi.chuyen_khoa_id` của bác sĩ đó |
| `ngay_kham` | `LichKhamBacSi.ngay` |
| `gio_kham` | `LichKhamBacSi.gio_bat_dau` |
| `trieu_chung` | Từ request (đã trim), hoặc `NULL` |
| `phi_kham` | `BacSi.muc_phi` (phí tham khảo, hoặc `NULL`) |
| `trang_thai` | `Đã đặt` |
| `qr_code` | Bằng `ma_dat_lich` |

Đồng thời tăng `LichKhamBacSi.so_slot_da_dat` đúng 1, trong cùng một transaction.

**Lưu ý:** `DatLichKham` **không có cột `lich_kham_id`** (không sửa schema ở task này).

## 4. Response 201

```json
{
    "success":true,
    "data":{
        "appointment":{"id":5,"ma_dat_lich":"DL20261026-A7016282","trang_thai":"Đã đặt","ngay_kham":"2026-10-26","gio_kham":"16:25:54","phi_kham":"150000.00","trieu_chung":"Dau dau","qr_code":"DL20261026-A7016282"},"doctor":{"id":9,"ho_ten":"ZZ TEST BS 148414","cap_bac":"Test"},"specialty":{"id":1,"ten_chuyen_khoa":"Nội tổng quát"},"room":{"id":null,"ten_phong":null}
    }
}
```

> Thay phần ví dụ trên bằng response thật khi chốt PR.

| Field | Kiểu | Ghi chú |
|---|---|---|
| `appointment.id` | number | `DatLichKham.id` |
| `appointment.ma_dat_lich` | string | **Mã hiển thị cho bệnh nhân** |
| `appointment.qr_code` | string | **Nội dung để vẽ QR** (hiện bằng `ma_dat_lich`) |
| `appointment.trang_thai` | string | Luôn là `Đã đặt` khi tạo mới |
| `appointment.ngay_kham` | string `YYYY-MM-DD` | |
| `appointment.gio_kham` | string `HH:MM:SS` | Lưu ý: C2-04 trả `HH:MM`, API này trả `HH:MM:SS` |
| `appointment.phi_kham` | string \| null | PostgreSQL NUMERIC trả về dạng chuỗi (ví dụ `"150000.00"`), frontend tự format |
| `appointment.trieu_chung` | string \| null | |
| `doctor` / `specialty` / `room` | object | Các field bên trong có thể là `null` nếu dữ liệu nền thiếu |

## 5. Mã và thông báo lỗi

| HTTP | Khi nào | `message` |
|---|---|---|
| 401 | Thiếu/sai/hết hạn token | `Chưa đăng nhập` / `Token không hợp lệ hoặc đã hết hạn` |
| 400 | `lich_kham_id` thiếu/không phải số nguyên > 0 | `lich_kham_id không hợp lệ` |
| 400 | `trieu_chung` không phải chuỗi / quá 1000 ký tự | `trieu_chung phải là chuỗi` / `Triệu chứng tối đa 1000 ký tự` |
| 400 | Giờ bắt đầu đã qua | `Lịch khám đã qua` |
| 400 | Còn dưới 10 phút | `Chỉ được đặt lịch khi còn ít nhất 10 phút` |
| 403 | Tài khoản không phải bệnh nhân | `Chỉ bệnh nhân mới được đặt lịch` |
| 404 | Không có lịch với `lich_kham_id` | `Không tìm thấy lịch khám` |
| 409 | Lịch không ở trạng thái `HoatDong` | `Lịch khám không còn hoạt động` |
| 409 | `so_slot_da_dat >= so_slot_online` | `Lịch khám đã hết chỗ đặt online` |
| 500 | Lỗi server | `Lỗi server` |

## 6. Quy tắc nghiệp vụ

- Giờ so sánh theo múi giờ `Asia/Ho_Chi_Minh`, **cùng quy tắc với C2-04**: còn `>= 10 phút` thì được đặt (đúng 10 phút vẫn đặt được), `< 10 phút` hoặc đã qua thì từ chối.
- Chống overbooking: trong một transaction, `SELECT ... FOR UPDATE` khóa dòng `LichKhamBacSi`, kiểm tra quota, `INSERT DatLichKham`, `UPDATE so_slot_da_dat + 1`. Có lỗi thì `ROLLBACK`.

## 7. Dành cho C2-07 (Hạnh)

- Hiển thị mã đặt lịch bằng `appointment.ma_dat_lich`.
- Vẽ QR từ `appointment.qr_code`.
- Hiển thị thông tin khám từ `doctor`, `specialty`, `room`, `appointment.ngay_kham`, `appointment.gio_kham`, `appointment.phi_kham` (chỉ là phí tham khảo).
- Tên bệnh nhân/SĐT lấy từ `GET /api/auth/me` (không nằm trong response này).

## 8. Dành cho C2-08A (Nam): đọc lại lịch đã tạo

Không cần `lich_kham_id`. Mọi thông tin đã nằm sẵn trong `DatLichKham` và các FK của nó.

**Lấy bệnh nhân hiện tại:** `benh_nhan_id` từ `GET /api/auth/me`, hoặc `SELECT id FROM "BenhNhan" WHERE tai_khoan_id = req.user.id`. Chỉ trả lịch của chính bệnh nhân đó.

**List/Detail:**
```sql
SELECT d.id, d.ma_dat_lich, d.trang_thai, d.ngay_kham, d.gio_kham,
       d.phi_kham, d.trieu_chung, d.qr_code,
       bs.id AS bac_si_id, bs.ho_ten AS bac_si_ten, bs.cap_bac,
       ck.id AS chuyen_khoa_id, ck.ten_chuyen_khoa,
       pk.id AS phong_kham_id, pk.ten_phong
FROM "DatLichKham" d
LEFT JOIN "BacSi" bs ON bs.id = d.bac_si_id
LEFT JOIN "ChuyenKhoa" ck ON ck.id = d.chuyen_khoa_id
LEFT JOIN "PhongKham" pk ON pk.id = d.phong_kham_id
WHERE d.benh_nhan_id = $1
ORDER BY d.ngay_kham DESC, d.gio_kham DESC;
```
Detail thêm điều kiện `AND d.id = $2` (hoặc `d.ma_dat_lich = $2`), nhớ giữ điều kiện `benh_nhan_id` để bệnh nhân không xem được lịch của người khác.

**Tìm lại dòng `LichKhamBacSi` của một lịch hẹn** (cần khi hủy lịch để trả slot):
```sql
SELECT id FROM "LichKhamBacSi"
WHERE bac_si_id = $1 AND ngay = $2 AND gio_bat_dau = $3;
```
với `$1 = DatLichKham.bac_si_id`, `$2 = ngay_kham`, `$3 = gio_kham`. Giả định: mỗi bác sĩ chỉ có một dòng cho mỗi ngày và giờ bắt đầu (đúng với dữ liệu seed C2-03; schema không ép UNIQUE).

## 9. Chưa làm / điểm cần thống nhất

- **BHYT (có/không)** trong UC-008: bảng `DatLichKham` không có cột này nên chưa lưu.
- Chưa chặn cùng một bệnh nhân đặt nhiều lần cùng một khung giờ.
- Hủy lịch (trả slot, vô hiệu QR) thuộc task khác.
- Hiệu lực QR theo khung check-in thuộc UC-011.