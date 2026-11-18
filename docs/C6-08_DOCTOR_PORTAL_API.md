# C6-08 — Doctor Portal API Contract

## Quy ước

- Base URL local: `http://localhost:3000`
- Bắt buộc gửi `Authorization: Bearer <JWT>` của tài khoản Bác sĩ.
- Thành công: `{ "success": true, "data": ... }`
- Lỗi: `{ "success": false, "message": "...", "code"?: "..." }`
- Backend xác định `BacSi` qua `req.user.id`; client không chọn bác sĩ bằng `bac_si_id`.
- Ngày dùng `YYYY-MM-DD`; tuần bắt đầu Thứ 2, kết thúc Chủ nhật; ngày vận hành lấy theo `Asia/Ho_Chi_Minh`.

## `GET /api/doctor/schedules`

Trả lịch của chính bác sĩ đang đăng nhập. Không có tham số thì trả tuần hiện tại.

| Query | Mô tả |
|---|---|
| `start_date=YYYY-MM-DD` | Ngày Thứ 2 của tuần cần xem; nếu thiếu `end_date`, backend tính Chủ nhật |
| `end_date=YYYY-MM-DD` | Tùy chọn; phải đúng 6 ngày sau `start_date` |
| `date=YYYY-MM-DD` | Tùy chọn thay cho `start_date/end_date`; backend lấy tuần chứa ngày này |

Không gửi đồng thời `date` và `start_date/end_date`. Tham số `bac_si_id` nếu có sẽ không được dùng để chọn dữ liệu.

Response `200`:

```json
{
  "success": true,
  "data": {
    "start_date": "2026-11-16",
    "end_date": "2026-11-22",
    "items": [
      {
        "id": 105,
        "bac_si_id": 2,
        "ngay": "2026-11-18",
        "gio_bat_dau": "08:00",
        "gio_ket_thuc": "09:00",
        "trang_thai": "HoatDong",
        "phong_kham": { "id": 1, "ten_phong": "Phòng 101", "loai_phong": "Phòng khám" },
        "chuyen_khoa": { "id": 1, "ten_chuyen_khoa": "Nội tổng quát" }
      }
    ]
  }
}
```

Tuần không có lịch trả `200` với `items: []`. Ngày/khoảng tuần sai trả `400 INVALID_DATE_RANGE`.

## `GET /api/doctor/patients?status=CHO_KHAM`

Trả bệnh nhân trong phòng của ca phù hợp hôm nay. Nếu bác sĩ chưa có lịch hôm nay, `room` là `null` và `items` là `[]`.

`status` nhận `CHO_KHAM`, `DANG_KHAM` hoặc `DA_XONG`; mặc định là `CHO_KHAM`. Backend giới hạn dữ liệu theo tài khoản bác sĩ, phòng ca hôm nay và ngày check-in Việt Nam. Lượt chưa gán bác sĩ chỉ được hiển thị nếu nằm trong phòng ca của bác sĩ.

Response `200`:

```json
{
  "success": true,
  "data": {
    "doctor": { "id": 2, "ho_ten": "Nguyễn Văn An" },
    "room": { "id": 1, "ten_phong": "Phòng 101" },
    "status": "CHO_KHAM",
    "items": [
      {
        "hang_doi_id": 41,
        "ho_so_id": null,
        "patient": { "id": 9, "ho_ten": "Nguyễn Thị B" },
        "loai": "ONLINE",
        "so_thu_tu": 3,
        "nhan_stt": "A3",
        "trang_thai": "CHO_KHAM",
        "gio_check_in": "08:05",
        "room": { "id": 1, "ten_phong": "Phòng 101" }
      }
    ],
    "current_examination": null,
    "current_examination_conflict": false
  }
}
```

`current_examination` được truy vấn từ hồ sơ `DANG_KHAM` của bác sĩ, độc lập với filter và trạng thái lịch sử dụng trong trình duyệt. Nếu có đúng một hồ sơ, response gồm `ho_so_id`, bệnh nhân, hàng đợi và phòng để tạo đường dẫn `/doctor/examination/:hoSoId`. Nếu có nhiều hồ sơ `DANG_KHAM`, API không tự chọn hồ sơ nào: `current_examination` là `null` và `current_examination_conflict` là `true`.

Trạng thái không hỗ trợ trả `400 INVALID_STATUS`; không phải bác sĩ trả `403`.

## Kiểm thử

```powershell
npm --prefix backend run api:test-c6-08
npm --prefix frontend run lint
npm --prefix frontend run build
```
