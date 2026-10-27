# C2-08A — API lịch hẹn cho bệnh nhân

Tài liệu này mô tả API đang có trong backend. Các lịch trả về luôn thuộc bệnh nhân đăng nhập.

## Dùng chung

- Base path: `/api` (ví dụ `GET /api/appointments`).
- Cần đăng nhập: gửi header `Authorization: Bearer <JWT>` lấy từ luồng đăng nhập.
- Thành công dùng `{ "success": true, "data": ... }`; lỗi dùng `{ "success": false, "message": "..." }`.
- Không có query params hay request body cho các endpoint dưới đây. `:id` là `DatLichKham.id`, số nguyên dương. “GET /api/appointments không hỗ trợ status filter.”

## `GET /api/appointments`

Lấy toàn bộ lịch của bệnh nhân đang đăng nhập, mới nhất trước (ngày, giờ, rồi id giảm dần). Không có phân trang hay filter.

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "ma_dat_lich": "DL20261026-A7016282",
      "trang_thai": "Đã đặt",
      "ngay_kham": "2026-10-26",
      "gio_kham": "16:25:54",
      "phi_kham": "150000.00",
      "trieu_chung": "Đau đầu",
      "bac_si_id": 9,
      "bac_si_ten": "Nguyễn Văn An",
      "cap_bac": "Bác sĩ chuyên khoa I",
      "chuyen_khoa_id": 1,
      "ten_chuyen_khoa": "Nội tổng quát",
      "phong_kham_id": 2,
      "ten_phong": "Phòng khám 2",
      "qr_code": "DL20261026-A7016282",
      "co_the_huy": true
    }
  ]
}
```

`data` có thể là mảng rỗng. `GET /api/appointments/:id` trả cùng hình dạng một object trong `data`, không phải mảng:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "ma_dat_lich": "DL20261026-A7016282",
    "trang_thai": "Đã đặt",
    "ngay_kham": "2026-10-26",
    "gio_kham": "16:25:54",
    "phi_kham": "150000.00",
    "trieu_chung": "Đau đầu",
    "bac_si_id": 9,
    "bac_si_ten": "Nguyễn Văn An",
    "cap_bac": "Bác sĩ chuyên khoa I",
    "chuyen_khoa_id": 1,
    "ten_chuyen_khoa": "Nội tổng quát",
    "phong_kham_id": 2,
    "ten_phong": "Phòng khám 2",
    "qr_code": "DL20261026-A7016282",
    "co_the_huy": true
  }
}
```

## `GET /api/appointments/:id`

Lấy một lịch của bệnh nhân hiện tại. ID không hợp lệ trả `400`; lịch không tồn tại hoặc thuộc người khác trả `404`.

## Hủy lịch: `PATCH /api/appointments/:id/cancel`

Không cần body. Lịch phải thuộc bệnh nhân đang đăng nhập, đang ở trạng thái `Đã đặt`, và còn ít nhất 2 giờ đến giờ khám.

```json
{
  "success": true,
  "data": {
    "id": 5,
    "ma_dat_lich": "DL20261026-A7016282",
    "trang_thai": "Đã hủy"
  }
}
```

## Ý nghĩa field frontend cần dùng

| Field                                | Cách dùng                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `id`                                 | Dùng cho chi tiết và hủy lịch (`:id`).                                        |
| `ma_dat_lich`                        | Mã lịch hiển thị cho bệnh nhân.                                               |
| `trang_thai`                         | Trạng thái hiện tại; giá trị do backend lưu như `Đã đặt`, `Đã hủy`.           |
| `ngay_kham`, `gio_kham`              | Ngày `YYYY-MM-DD`, giờ `HH:MM:SS` theo dữ liệu lịch.                          |
| `phi_kham`                           | PostgreSQL NUMERIC trả thành chuỗi hoặc `null`; tự format khi hiển thị.       |
| `trieu_chung`                        | Triệu chứng đã ghi khi đặt lịch; có thể `null`.                               |
| `bac_si_id`, `bac_si_ten`, `cap_bac` | ID, tên và cấp bậc bác sĩ; thông tin nối có thể `null` nếu thiếu dữ liệu nền. |
| `chuyen_khoa_id`, `ten_chuyen_khoa`  | ID và tên chuyên khoa; có thể `null` nếu thiếu dữ liệu nền.                   |
| `phong_kham_id`, `ten_phong`         | ID và tên phòng; có thể `null` nếu thiếu dữ liệu nền.                         |
| `qr_code`                            | Chuỗi nội dung QR hoặc `null` theo quy tắc bên dưới.                          |
| `co_the_huy`                         | Boolean để bật/tắt thao tác hủy; vẫn cần xử lý lỗi khi gọi API.               |

## Quy tắc QR và hủy

- `qr_code` giữ giá trị đã lưu (hiện bằng `ma_dat_lich`) chỉ khi trạng thái là `Đã đặt` **và** còn ít nhất 10 phút đến giờ khám. Trường hợp khác trả `null`.
- `co_the_huy` là `true` chỉ khi đồng thời: trạng thái `Đã đặt`, QR còn hạn (ít nhất 10 phút), và còn ít nhất 2 giờ đến giờ khám. Các trường hợp khác là `false`.
- Điều kiện hủy trong API là `còn >= 2 giờ`, tính theo múi giờ `Asia/Ho_Chi_Minh`. Đúng 2 giờ vẫn hủy được; dưới 2 giờ bị từ chối (`400`).
- Hủy thành công đổi trạng thái sang `Đã hủy` và giảm số slot đã đặt đi 1 (không xuống dưới 0). Lịch đã hủy không thể hủy lại.

## Status và lỗi quan trọng

| HTTP  | Ý nghĩa                                                                              |
| ----- | ------------------------------------------------------------------------------------ |
| `200` | Đọc lịch hoặc hủy lịch thành công.                                                   |
| `400` | ID không hợp lệ; hoặc hủy khi còn dưới 2 giờ.                                        |
| `401` | Thiếu JWT, JWT sai hoặc hết hạn.                                                     |
| `403` | Tài khoản không gắn với bệnh nhân.                                                   |
| `404` | ID không có, hoặc lịch thuộc bệnh nhân khác (backend không tiết lộ lịch người khác). |
| `409` | Lịch đã hủy, hoặc trạng thái hiện tại không cho phép hủy.                            |
| `500` | Lỗi server; lúc hủy cũng có thể gồm lỗi thao tác trả slot.                           |

## Ghi chú cho C2-08B (BN14/BN15)

- Dùng `GET /api/appointments` để dựng danh sách; dùng `GET /api/appointments/:id` khi mở chi tiết. Cả hai lấy bệnh nhân từ JWT, không gửi `benh_nhan_id`.
- Dựa vào `co_the_huy` để hiển thị trạng thái nút hủy. Khi xác nhận, gọi `PATCH /api/appointments/:id/cancel` không body; cập nhật UI từ `data.trang_thai` khi thành công.
- UI không nên tự suy ra quyền hủy chỉ từ giờ phía máy khách: dùng `co_the_huy`, đồng thời hiển thị/ xử lý `message` nếu API từ chối do lịch thay đổi hoặc trạng thái không hợp lệ.
- Sau khi hủy, tải lại chi tiết/danh sách hoặc cập nhật trạng thái; các lượt đọc tiếp theo sẽ trả `qr_code: null`, `co_the_huy: false`.

## Đã đối chiếu với code

Response mẫu minh họa kiểu dữ liệu và các field từ controller; tên/ngày/giờ/mã cụ thể chỉ là dữ liệu ví dụ, không cam kết tồn tại trong database. Controller hiện trả lỗi: `400` `id không hợp lệ` / `Chỉ được hủy lịch trước giờ khám ít nhất 2 giờ`; `401` do middleware; `403` không phải bệnh nhân; `404` không tìm thấy; `409` đã hủy hoặc trạng thái không thể hủy; `500` lỗi server. Contract không thể kết luận UI cụ thể hoặc dữ liệu thực tế trong môi trường chạy.
