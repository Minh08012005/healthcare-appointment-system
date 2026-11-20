import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminTimeSlotApi, adminTimeSlotPaths } from "../../api/adminTimeSlots";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import "./admin.css";

const CA_GROUPS = [
  { ca: "SANG", label: "Ca sáng", range: "06:00 – 11:00" },
  { ca: "CHIEU", label: "Ca chiều", range: "13:00 – 16:00" },
];

// Kiểm tra giống backend để báo lỗi ngay trên form (backend vẫn là nơi quyết định)
const validate = (totalStr, onlineStr) => {
  if (!/^\d+$/.test(totalStr)) return "Số slot tối đa phải là số nguyên.";
  if (!/^\d+$/.test(onlineStr)) return "Số slot online phải là số nguyên không âm.";
  const total = Number(totalStr);
  const online = Number(onlineStr);
  if (total <= 0) return "Số slot tối đa phải lớn hơn 0.";
  if (online > total) return "Số slot online không được lớn hơn số slot tối đa.";
  return null;
};

export default function AdminTimeSlotsPage() {
  const { data, loading, error, reload } = useFetch(adminTimeSlotPaths.list());
  const items = data?.items || [];

  const [editing, setEditing] = useState(null); // khung đang sửa
  const [form, setForm] = useState({ total: "", online: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null); // { type, message }

  const openEdit = (slot) => {
    setEditing(slot);
    setForm({ total: String(slot.so_slot_toi_da), online: String(slot.so_slot_online) });
    setFormError("");
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(null);
    setFormError("");
  };

  const total = form.total.trim();
  const online = form.online.trim();
  const liveError = editing ? validate(total, online) : null;
  const offline = !liveError ? Number(total) - Number(online) : null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (liveError) return setFormError(liveError);
    setSaving(true);
    setFormError("");
    try {
      await adminTimeSlotApi.update(editing.id, {
        so_slot_toi_da: Number(total),
        so_slot_online: Number(online),
      });
      setFlash({
        type: "success",
        message: `Đã lưu khung giờ ${editing.gio_bat_dau} – ${editing.gio_ket_thuc}.`,
      });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message || "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <header className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Cấu hình lịch khám</span>
            <h1 className="admin-header__title">Khung giờ &amp; Slot</h1>
            <p className="admin-header__desc">
              Thiết lập số slot tối đa và số slot đặt online cho từng khung giờ khám. Cấu hình chỉ áp dụng cho lịch
              trực tạo mới, không thay đổi lịch đã có.
            </p>
          </div>
        </div>
      </header>

      {flash && (
        <div className={`admin-flash admin-flash--${flash.type}`} role="status" aria-live="polite">
          <span>{flash.message}</span>
          <button
            type="button"
            className="admin-modal__close"
            style={{ fontSize: "16px" }}
            onClick={() => setFlash(null)}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="admin-state-box" role="status">
          <div className="admin-spinner" aria-hidden="true" />
          <p>Đang tải cấu hình khung giờ...</p>
        </div>
      )}

      {!loading && error && (
        <div className="admin-state-box" role="alert">
          <Notice variant="error" title="Không thể tải dữ liệu">
            {error.message || "Có lỗi xảy ra khi kết nối tới máy chủ."}
          </Notice>
          <Button variant="outline" onClick={reload}>
            Thử lại
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="admin-state-box">
          <p>Chưa có cấu hình khung giờ trong hệ thống.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 20, flex: "2 1 520px", minWidth: 0 }}>
            {CA_GROUPS.map((g) => {
              const rows = items.filter((x) => x.ca === g.ca);
              return (
                <section key={g.ca}>
                  <h2 className="admin-section__title" style={{ margin: "0 0 8px" }}>
                    {g.label} <span className="admin-form-hint">({g.range})</span>
                  </h2>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Giờ bắt đầu</th>
                          <th>Giờ kết thúc</th>
                          <th style={{ textAlign: "right" }}>Tối đa</th>
                          <th style={{ textAlign: "right" }}>Online</th>
                          <th style={{ textAlign: "right" }}>Offline</th>
                          <th style={{ width: 90, textAlign: "center" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((slot) => (
                          <tr
                            key={slot.id}
                            style={editing?.id === slot.id ? { background: "var(--primary-light, #e8f1fd)" } : undefined}
                          >
                            <td>
                              <strong>{slot.gio_bat_dau}</strong>
                            </td>
                            <td>{slot.gio_ket_thuc}</td>
                            <td style={{ textAlign: "right" }}>{slot.so_slot_toi_da}</td>
                            <td style={{ textAlign: "right" }}>{slot.so_slot_online}</td>
                            <td style={{ textAlign: "right" }}>{slot.so_slot_offline}</td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className="admin-btn-sm admin-btn-sm--outline"
                                onClick={() => openEdit(slot)}
                                disabled={saving}
                              >
                                Sửa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="admin-table-wrap" style={{ padding: 20, flex: "1 1 280px", minWidth: 0 }}>
            {!editing ? (
              <p className="admin-form-hint" style={{ margin: 0 }}>
                Chọn <strong>Sửa</strong> ở một khung giờ để chỉnh số slot.
              </p>
            ) : (
              <form onSubmit={handleSave} style={{ display: "grid", gap: 14 }}>
                <h2 className="admin-section__title" style={{ margin: 0 }}>
                  Sửa khung giờ {editing.gio_bat_dau} – {editing.gio_ket_thuc}
                </h2>

                {formError && <Notice variant="error">{formError}</Notice>}

                <div className="admin-form-group">
                  <label htmlFor="slot-total" className="admin-label admin-label--required">
                    Số slot tối đa
                  </label>
                  <input
                    id="slot-total"
                    type="number"
                    min="1"
                    step="1"
                    className="admin-input"
                    value={form.total}
                    onChange={(e) => setForm({ ...form, total: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="slot-online" className="admin-label admin-label--required">
                    Số slot online
                  </label>
                  <input
                    id="slot-online"
                    type="number"
                    min="0"
                    step="1"
                    className="admin-input"
                    value={form.online}
                    onChange={(e) => setForm({ ...form, online: e.target.value })}
                  />
                  <span className="admin-form-hint">Số bệnh nhân tối đa được đặt online trong khung giờ này.</span>
                </div>

                <div className="admin-form-group">
                  <span className="admin-label">Số slot offline (tự tính)</span>
                  <strong>{offline ?? "—"}</strong>
                  {liveError && <span className="admin-form-hint" style={{ color: "var(--danger, #d32f2f)" }}>{liveError}</span>}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Button variant="outline" type="button" onClick={cancelEdit} disabled={saving}>
                    Hủy
                  </Button>
                  <Button type="submit" loading={saving} disabled={Boolean(liveError)}>
                    Lưu
                  </Button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}