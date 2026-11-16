# C6-05 — Queue / Check-in / Call Settings (UC-032)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/queue-settings` | Read the current system settings |
| PUT | `/api/admin/queue-settings` | Replace all supported settings |

Both endpoints require a valid bearer token for the `Quản trị viên` role.
Other roles receive `403`; missing or invalid tokens receive `401`.

## Request and response

`PUT` requires all seven integer fields. Values must be between `1` and
`2147483647`; incomplete or invalid input returns `400` without changing any
settings.

```json
{
  "ti_le_online": 1,
  "ti_le_offline": 1,
  "checkin_som_nhat_phut": 60,
  "checkin_toi_thieu_phut": 10,
  "so_lan_goi_toi_da": 3,
  "khoang_cach_goi_phut": 1,
  "chu_ky_quet_phut": 1
}
```

Successful GET and PUT responses use `{ "success": true, "data": { ... } }`,
where `data` contains only the seven fields above. The API updates the existing
`CauHinhHeThong` row; it does not create a replacement row. A missing row
returns `404`, and duplicate rows return `500` as a configuration integrity
error.

## Integration notes

- Admin UI: `/admin/queue-settings`.
- Check-in, Doctor Call, and background processing continue reading the
  existing `CauHinhHeThong` row; this task does not change their algorithms.
- Log in using an existing `Quản trị viên` account. No test credentials are
  defined by this feature.

## Quick check

1. Log in as `Quản trị viên` and open `/admin/queue-settings`.
2. Confirm current values load; update a value and save.
3. Reload the page and confirm the saved values remain.
4. Try `0`, a negative value, a decimal, or a value above `2147483647`; the
   update must be rejected.
5. Call either endpoint with a non-admin token and confirm it returns `403`.
