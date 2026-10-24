# C2-04 — Slot Availability API Contract (UC-007)

- **Trạng thái:** đã implement; đã chạy thật trên PostgreSQL Neon (2026-10-24) các ca `CON_SLOT`, `KHONG_CO_LICH`, lỗi 400 và 404 (xem mục 6).
- **Phạm vi:** API **chỉ đọc** cho bệnh nhân xem các khung giờ còn trống của một bác sĩ trong một ngày (UC-007).
- **KHÔNG thuộc task này:** tạo `DatLichKham`, tăng/giữ/trừ `so_slot_da_dat` (C2-06), QR, hủy lịch, Admin CRUD, Frontend (C2-05).
- **Phụ thuộc:** dữ liệu `LichKhamBacSi` đã seed ở C2-03.

---

## 1. Quy ước chung

| Nội dung            | Giá trị                                                                 |
|---------------------|-------------------------------------------------------------------------|
| Base URL (local)    | `http://localhost:3000`                                                 |
| Router              | `/api/slots` (mount trong `backend/src/routes/index.js`)                |
| Envelope thành công | `{ "success": true, "data": ... }`                                      |
| Envelope lỗi        | `{ "success": false, "message": "..." }`                                |
| Tên field           | `snake_case`, giống C2-03                                               |
| Thứ tự danh sách    | `ORDER BY gio_bat_dau` tăng dần                                         |
| Xác thực            | Chưa gắn middleware auth (nhánh C2-01 chưa merge); sẽ bổ sung sau       |

---

## 2. `GET /api/slots?bac_si_id=<id>&ngay=<YYYY-MM-DD>`

Lấy các khung giờ còn có thể đặt của một bác sĩ trong một ngày (bước sau khi bệnh nhân chọn bác sĩ và ngày).

| Parameter   | Vị trí | Kiểu               | Bắt buộc | Ghi chú                                      |
|-------------|--------|--------------------|----------|----------------------------------------------|
| `bac_si_id` | query  | integer > 0        | Có       | `BacSi.id` lấy từ `GET /api/master/bac-si`   |
| `ngay`      | query  | string `YYYY-MM-DD`| Có       | Ngày bệnh nhân chọn, phải là ngày hợp lệ     |

### Ba trạng thái nghiệp vụ (đều trả HTTP 200)

| `trang_thai`    | Ý nghĩa                                                         | `slots`        | UC |
|-----------------|-----------------------------------------------------------------|----------------|----|
| `CON_SLOT`      | Có lịch và còn ít nhất một khung giờ đặt được                   | danh sách > 0  | Luồng chính |
| `KHONG_CO_LICH` | Bác sĩ không có lịch làm việc trong ngày đã chọn                | `[]`           | 2a |
| `DA_DAY`        | Có lịch nhưng không còn khung giờ nào đặt được                  | `[]`           | 3a |

`message` là `null` khi `CON_SLOT`; với hai trạng thái còn lại, `message` là câu thông báo hiển thị cho bệnh nhân.

### Response 200 — `CON_SLOT` (output thật: `bac_si_id=2`, `ngay=2026-10-25`)

```json
{
  "success": true,
  "data": {
    "bac_si_id": 2,
    "ngay": "2026-10-25",
    "trang_thai": "CON_SLOT",
    "message": null,
    "slots": [
      {
        "lich_kham_id": 1,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "06:00",
        "gio_ket_thuc": "07:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 2,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "07:00",
        "gio_ket_thuc": "08:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 3,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "08:00",
        "gio_ket_thuc": "09:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 4,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "09:00",
        "gio_ket_thuc": "10:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 5,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "10:00",
        "gio_ket_thuc": "11:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 6,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "13:00",
        "gio_ket_thuc": "14:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 7,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "14:00",
        "gio_ket_thuc": "15:00",
        "slot_con_lai": 4
      },
      {
        "lich_kham_id": 8,
        "phong_kham_id": 1,
        "ten_phong": "Phòng 101 - Nội tổng quát",
        "gio_bat_dau": "15:00",
        "gio_ket_thuc": "16:00",
        "slot_con_lai": 4
      }
    ]
  }
}
```

> Bác sĩ 2 (Nguyễn Văn An) có đủ 8 khung giờ, cùng phòng 101, mỗi khung còn 4 chỗ.

### Response 200 — `KHONG_CO_LICH`

```json
{
  "success": true,
  "data": {
    "bac_si_id": 2,
    "ngay": "2026-12-31",
    "trang_thai": "KHONG_CO_LICH",
    "message": "Bác sĩ không có lịch làm việc trong ngày đã chọn. Vui lòng chọn ngày khác.",
    "slots": []
  }
}
```

### Response 200 — `DA_DAY` (output thật khi tạm đặt đầy `bac_si_id=6`, `ngay=2026-10-29`; đã khôi phục sau test)

```json
{
  "success": true,
  "data": {
    "bac_si_id": 6,
    "ngay": "2026-10-29",
    "trang_thai": "DA_DAY",
    "message": "Không còn khung giờ trống trong ngày đã chọn.",
    "slots": []
  }
}
```

### Field của mỗi phần tử trong `slots`

| Field           | Kiểu           | Ghi chú                                                          |
|-----------------|----------------|------------------------------------------------------------------|
| `lich_kham_id`  | number         | `LichKhamBacSi.id` — C2-06 dùng id này để đặt lịch               |
| `phong_kham_id` | number \| null | FK phòng khám                                                    |
| `ten_phong`     | string \| null | Tên phòng (LEFT JOIN `PhongKham`)                                |
| `gio_bat_dau`   | string `HH:MM` | Giờ bắt đầu khung giờ (24h)                                      |
| `gio_ket_thuc`  | string `HH:MM` | Giờ kết thúc khung giờ (24h)                                     |
| `slot_con_lai`  | number         | `so_slot_online - so_slot_da_dat` (luôn > 0 trong danh sách)     |

### Lỗi

| HTTP | Khi nào                                   | Body                                                                          |
|------|-------------------------------------------|-------------------------------------------------------------------------------|
| 400  | `bac_si_id` thiếu / không phải số nguyên > 0 | `{ "success": false, "message": "bac_si_id không hợp lệ" }`                |
| 400  | `ngay` thiếu / sai định dạng / ngày không tồn tại | `{ "success": false, "message": "ngay không hợp lệ (định dạng YYYY-MM-DD)" }` |
| 404  | Không có bác sĩ với `bac_si_id` đó        | `{ "success": false, "message": "Không tìm thấy bác sĩ" }`                    |
| 500  | Lỗi truy vấn database                     | `{ "success": false, "message": "Không truy vấn được database" }`             |

---

## 3. Quy tắc tính slot

Dựa trên semantics C2-03 (mỗi record `LichKhamBacSi` = 1 bác sĩ + 1 ngày + 1 phòng + 1 khung giờ 1 tiếng):

```
slot_con_lai = so_slot_online - so_slot_da_dat

Một khung giờ được trả trong `slots` khi:
  - trang_thai = 'HoatDong'
  - slot_con_lai > 0
  - giờ bắt đầu còn cách hiện tại (giờ VN) hơn 10 phút   (điều kiện UC-008, áp dụng khi xem ngày hôm nay)

Record 'DaHuy' bị bỏ qua hoàn toàn (coi như không có lịch).
Record 'HetCho' vẫn tính là "có lịch" nhưng không đặt được (góp vào trạng thái DA_DAY).

KHONG_CO_LICH : không có record HoatDong/HetCho nào của bác sĩ trong ngày
DA_DAY        : có record nhưng không record nào đặt được
CON_SLOT      : còn ít nhất một khung giờ đặt được
```

**API này chỉ đọc.** Không tạo `DatLichKham`, không thay đổi `so_slot_da_dat`. C2-06 phải kiểm tra lại slot khi bệnh nhân xác nhận đặt lịch (vì slot có thể bị người khác đặt giữa lúc xem và lúc xác nhận).

---

## 4. Cách Frontend (C2-05) gọi API

`apiClient` trả về **nguyên envelope**, nên đọc `res.data`:

```js
import { apiClient } from '../api/client'

const res = await apiClient.get(`/api/slots?bac_si_id=${doctorId}&ngay=${date}`) // date: 'YYYY-MM-DD'
const { trang_thai, message, slots } = res.data

if (trang_thai === 'CON_SLOT') {
  // render slots: gio_bat_dau - gio_ket_thuc, slot_con_lai
} else {
  // KHONG_CO_LICH hoặc DA_DAY: hiển thị `message`, yêu cầu chọn ngày khác
}
```

Khi bệnh nhân chọn một khung giờ, giữ lại `lich_kham_id` để gửi sang bước xác nhận đặt lịch (C2-06).

---

## 5. Dữ liệu dùng để test (từ seed C2-03)

- Bác sĩ `bac_si_id` 1–6; ngày có lịch: ngày mai → +5 ngày (tính theo giờ VN, xem contract C2-03 mục 4).
- Mỗi cặp bác sĩ/ngày có 8 khung giờ, mỗi khung `so_slot_online = 4`, `so_slot_da_dat = 0` → `slot_con_lai = 4`.

---

## 6. Kiểm chứng

> Đã chạy thật bằng `Invoke-RestMethod` trên DB Neon (2026-10-24). Các mục chưa tick là chưa kiểm chứng.

- [x] Có lịch + còn chỗ → `CON_SLOT` (`bac_si_id=2`, `ngay=2026-10-25`)
- [x] `CON_SLOT` trả đúng 8 khung giờ (06:00–11:00 và 13:00–16:00), mỗi khung còn 4 chỗ
- [x] Ngày không có lịch (`ngay=2026-12-31`) → `KHONG_CO_LICH`, `slots` rỗng, có `message`
- [x] Ngày đầy → `DA_DAY`, `slots` rỗng, có `message` (test tạm `bac_si_id=6`, `ngay=2026-10-29`: đặt `so_slot_da_dat = so_slot_online` cho 8 dòng, sau đó khôi phục về 0)
- [x] Chỉ trả dữ liệu đúng bác sĩ + đúng ngày (`bac_si_id=3` trả `phong_kham_id = 4`, khác bác sĩ 2)
- [x] `bac_si_id=abc` → 400 "bac_si_id không hợp lệ"
- [x] `ngay=2026-13-01` hoặc thiếu `ngay` → 400 "ngay không hợp lệ (định dạng YYYY-MM-DD)"
- [x] `bac_si_id=99` → 404 "Không tìm thấy bác sĩ"
- [x] `SUM(so_slot_da_dat)` trước và sau khi gọi API không đổi (0 → 0)
- [x] Regression: `/api/health`, `/api/master/chuyen-khoa`, `/api/master/bac-si` vẫn PASS

---

## 7. Ngoài phạm vi C2-04

- Không tạo `DatLichKham`, không giữ/trừ slot (C2-06).
- Không có Frontend chọn ngày/slot (C2-05), QR, hủy lịch, Admin CRUD lịch bác sĩ.
- Chưa có middleware xác thực bệnh nhân (chờ C2-01).
