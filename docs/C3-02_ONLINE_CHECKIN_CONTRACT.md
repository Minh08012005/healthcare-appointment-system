# C3-02 — Online Check-in API Contract (UC-011)

- **Phạm vi:** Lễ tân check-in bệnh nhân đã đặt lịch online: `DA_DAT -> DA_CHECK_IN`.
- **Người dùng contract:** C3-03 (Nam: đến giờ hẹn -> Queue Online), C3-05/LT-02 (Hạnh: màn hình check-in).
- **KHÔNG thuộc task này:** tạo `HangDoi`, chuyển `QUA_HAN_CHECK_IN`, trả slot (C3-03), check-in offline, UI.
- **Quan trọng:** check-in thành công **không** tạo `HangDoi`.

## 1. Endpoint

`POST /api/checkin/online`

| Nội dung | Giá trị |
|---|---|
| Xác thực | Bắt buộc `Authorization: Bearer <JWT>` |
| Quyền | Chỉ vai trò `Lễ tân` (bệnh nhân/vai trò khác -> 403) |
| Envelope thành công | `{ "success": true, "data": ... }` |
| Envelope lỗi | `{ "success": false, "message": "...", "code"?: "..." }` |

## 2. Request

```json
{ "ma_dat_lich": "DL20261030-A1B2C3D4" }
```
hoặc, khi quét QR:
```json
{ "qr_code": "DL20261030-A1B2C3D4" }
```
- Chỉ cần một trong hai field (`ma_dat_lich` được ưu tiên). Là chuỗi, 1 đến 100 ký tự sau khi trim.
- Mã không phân biệt hoa thường khi nhập tay.
- Frontend **không** tự tính rule thời gian, Backend quyết định.

## 3. Response 200

```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": 1,
      "ma_dat_lich": "DL20261030-A1B2C3D4",
      "trang_thai": "DA_CHECK_IN",
      "ngay_kham": "2026-10-30",
      "gio_kham": "08:00:00",
      "trieu_chung": "Đau đầu"
    },
    "patient": {
      "id": 1,
      "ho_ten": "Nguyễn Văn A",
      "ngay_sinh": "2000-01-01",
      "gioi_tinh": "Nam",
      "ma_bhyt": null,
      "so_dien_thoai": "0900000000"
    },
    "doctor": { "id": 2, "ho_ten": "<tên bác sĩ>", "cap_bac": "<cấp bậc>" },
    "specialty": { "id": 1, "ten_chuyen_khoa": "Nội tổng quát" },
    "room": { "id": 1, "ten_phong": "<tên phòng>" }
  }
}
```
> Thay ví dụ bằng response thật khi chốt PR. Các field của `patient`, `doctor`, `specialty`, `room` có thể là `null` nếu dữ liệu nền thiếu.

## 4. Lỗi

| HTTP | `code` | Khi nào | `message` |
|---|---|---|---|
| 401 | | Thiếu/sai/hết hạn token | `Chưa đăng nhập` / `Token không hợp lệ hoặc đã hết hạn` |
| 403 | | Không phải Lễ tân | `Chỉ Lễ tân mới được check-in` |
| 400 | | Mã thiếu/sai kiểu/rỗng/quá dài | `ma_dat_lich không hợp lệ` |
| 404 | | Không có lịch với mã đó | `Không tìm thấy lịch hẹn với mã này` |
| 409 | `INVALID_STATE` | Lịch không ở `DA_DAT` (đã check-in, quá hạn, đã hủy, hoàn thành) | thông báo theo trạng thái |
| 400 | `TOO_EARLY` | Sớm hơn 60 phút trước giờ hẹn (QR vẫn hợp lệ, quay lại sau) | `Chưa đến giờ check-in ...` |
| 400 | `TOO_LATE` | Còn dưới 10 phút hoặc đã qua giờ hẹn | `Đã quá hạn check-in ...` |
| 500 | | Lỗi server / thiếu cấu hình | |

## 5. Quy tắc nghiệp vụ

- Cửa sổ check-in đọc từ `CauHinhHeThong` (`checkin_som_nhat_phut` = 60, `checkin_toi_thieu_phut` = 10), giờ so sánh theo múi giờ `Asia/Ho_Chi_Minh`.
- Đúng 60 phút trước giờ hẹn: hợp lệ. Đúng 10 phút: hợp lệ. Sớm hơn 60 phút hoặc còn dưới 10 phút: từ chối.
- Kiểm tra trạng thái trước, kiểm tra thời gian sau (check-in lần hai báo "đã check-in", không báo "quá hạn").
- Khóa dòng lịch (`FOR UPDATE`): nhiều request cùng lúc chỉ một request thành công, các request còn lại nhận 409.

## 6. Dành cho C3-03 (Nam)

- Sau check-in, `DatLichKham.trang_thai = 'DA_CHECK_IN'`, **chưa có** dòng `HangDoi`.
- C3-03 chịu trách nhiệm: đến giờ hẹn chuyển `DA_CHECK_IN -> CHO_KHAM` và tạo `HangDoi` Online; chuyển `QUA_HAN_CHECK_IN` và trả slot.
- Dữ liệu lịch: `DatLichKham.ngay_kham`, `gio_kham`, `bac_si_id`, `phong_kham_id`, `benh_nhan_id`.

## 7. Cách test nhanh

1. Đăng nhập tài khoản Lễ tân: `POST /api/auth/login`.
2. Chuẩn bị lịch `DA_DAT` có giờ hẹn cách bây giờ 10 đến 60 phút.
3. `POST /api/checkin/online` với `{ "ma_dat_lich": "<mã>" }` kèm Bearer token.
4. Kiểm tra `DatLichKham.trang_thai = 'DA_CHECK_IN'` và bảng `HangDoi` không có dòng mới.