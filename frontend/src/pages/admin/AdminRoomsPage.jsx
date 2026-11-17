import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminRoomApi, adminRoomPaths } from "../../api/adminRooms";
import { adminSpecialtyPaths } from "../../api/adminSpecialties";
import { adminAccountPaths } from "../../api/adminAccounts";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const LOAI_KHAM = "Phòng khám";
const LOAI_XN = "Phòng xét nghiệm";
const MAX_TEN = 100;
// Theo backend C6-04: vai trò được gán theo loại phòng
const STAFF_ROLE_BY_TYPE = { [LOAI_XN]: "Xét nghiệm", [LOAI_KHAM]: "Lễ tân" };
const EMPTY_FORM = { ten_phong: "", loai_phong: LOAI_KHAM, chuyen_khoa_id: "" };

const REF_LABELS = [
  ["so_lich_truc", "Lịch trực"],
  ["so_lich_hen", "Lịch hẹn"],
  ["so_luot_kham", "Lượt khám"],
  ["so_chi_dinh", "Chỉ định xét nghiệm"],
  ["so_nhan_vien", "Nhân viên được gán"],
];

function RefList({ refs }) {
  if (!refs) return null;
  const rows = REF_LABELS.filter(([key]) => refs[key] > 0);
  if (rows.length === 0) return null;
  return (
    <ul>
      {rows.map(([key, label]) => (
        <li key={key}>
          {label}: <strong>{refs[key]}</strong>
        </li>
      ))}
    </ul>
  );
}

function Modal({ title, onClose, disabled, children, footer }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">{title}</h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={disabled}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {children}
        {footer && <div className="admin-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

// Panel gán / gỡ / chuyển nhân viên của 1 phòng
function StaffModal({ room, rooms, onClose, onChanged }) {
  const role = STAFF_ROLE_BY_TYPE[room.loai_phong];
  const accounts = useFetch(
    role ? adminAccountPaths.list({ vaiTro: role, trangThai: "HoatDong", limit: 200 }) : null,
  );
  const [selectedId, setSelectedId] = useState("");
  const [transfer, setTransfer] = useState(null); // { accountId, ten_dang_nhap, ten_phong }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roomName = (id) => rooms.find((r) => r.id === id)?.ten_phong || `#${id}`;
  const candidates = (accounts.data?.items || []).filter((a) => a.phong_kham_id !== room.id);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const assign = (accountId, confirm) =>
    run(async () => {
      try {
        await adminRoomApi.assignStaff(room.id, accountId, confirm);
        setSelectedId("");
        setTransfer(null);
        accounts.reload();
        onChanged("Đã cập nhật nhân viên của phòng.");
      } catch (err) {
        if (err.code === "ACCOUNT_IN_OTHER_ROOM") {
          const acc = candidates.find((a) => a.id === accountId);
          setTransfer({
            accountId,
            ten_dang_nhap: acc?.ten_dang_nhap || `#${accountId}`,
            ten_phong: err.data?.phong_hien_tai?.ten_phong || "khác",
          });
        } else {
          setError(err.message || "Không thể gán nhân viên.");
        }
      }
    });

  const handleAdd = () => {
    const id = Number(selectedId);
    const acc = candidates.find((a) => a.id === id);
    if (!acc) return;
    if (acc.phong_kham_id) {
      // Đang thuộc phòng khác -> cảnh báo trước khi chuyển
      setTransfer({ accountId: id, ten_dang_nhap: acc.ten_dang_nhap, ten_phong: roomName(acc.phong_kham_id) });
      return;
    }
    assign(id, false);
  };

  const remove = (staff) =>
    run(async () => {
      try {
        await adminRoomApi.unassignStaff(room.id, staff.id);
        accounts.reload();
        onChanged(`Đã gỡ ${staff.ten_dang_nhap} khỏi phòng.`);
      } catch (err) {
        setError(err.message || "Không thể gỡ nhân viên.");
      }
    });

  return (
    <Modal
      title={`Nhân viên phòng ${room.ten_phong}`}
      onClose={busy ? undefined : onClose}
      disabled={busy}
      footer={
        <Button variant="outline" type="button" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
      }
    >
      <div className="admin-modal__body">
        {error && <Notice variant="error">{error}</Notice>}

        <p className="admin-form-hint" style={{ margin: 0 }}>
          {role
            ? `Phòng này chỉ gán tài khoản vai trò "${role}". Mỗi tài khoản chỉ thuộc 1 phòng tại một thời điểm.`
            : "Loại phòng này không hỗ trợ gán nhân viên."}
        </p>

        <div>
          <strong>Đang được gán ({room.nhan_vien.length})</strong>
          {room.nhan_vien.length === 0 ? (
            <p className="admin-form-hint" style={{ margin: "6px 0 0" }}>
              Chưa có nhân viên nào.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 6 }}>
              {room.nhan_vien.map((s) => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>
                    {s.ten_dang_nhap} <span className="admin-form-hint">· {s.vai_tro}</span>
                  </span>
                  <button
                    type="button"
                    className="admin-btn-sm admin-btn-sm--danger"
                    onClick={() => remove(s)}
                    disabled={busy}
                  >
                    Gỡ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {role && (
          <div className="admin-form-group">
            <label htmlFor="room-staff-select" className="admin-label">
              Thêm nhân viên
            </label>
            {accounts.loading && <span className="admin-form-hint">Đang tải danh sách tài khoản...</span>}
            {!accounts.loading && accounts.error && (
              <Notice variant="error">
                {accounts.error.message || "Không tải được danh sách tài khoản."}
              </Notice>
            )}
            {!accounts.loading && !accounts.error && (
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  id="room-staff-select"
                  className="admin-select"
                  style={{ flex: 1 }}
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setTransfer(null);
                  }}
                  disabled={busy || candidates.length === 0}
                >
                  <option value="">
                    {candidates.length === 0 ? "Không còn tài khoản phù hợp" : "-- Chọn tài khoản --"}
                  </option>
                  {candidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ten_dang_nhap}
                      {a.phong_kham_id ? ` (đang ở ${roomName(a.phong_kham_id)})` : " (chưa có phòng)"}
                    </option>
                  ))}
                </select>
                <Button type="button" onClick={handleAdd} disabled={!selectedId || busy}>
                  Gán
                </Button>
              </div>
            )}
          </div>
        )}

        {transfer && (
          <Notice variant="warning" title="Nhân viên đang thuộc phòng khác">
            <p style={{ margin: "0 0 8px" }}>
              Tài khoản <strong>{transfer.ten_dang_nhap}</strong> đang thuộc phòng{" "}
              <strong>{transfer.ten_phong}</strong>. Chuyển sang phòng <strong>{room.ten_phong}</strong>? Sau khi
              chuyển, tài khoản sẽ không còn thuộc phòng cũ.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" type="button" loading={busy} onClick={() => assign(transfer.accountId, true)}>
                Xác nhận chuyển
              </Button>
              <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => setTransfer(null)}>
                Hủy
              </Button>
            </div>
          </Notice>
        )}
      </div>
    </Modal>
  );
}

export default function AdminRoomsPage() {
  const { data, loading, error, reload } = useFetch(adminRoomPaths.list());
  const specialties = useFetch(adminSpecialtyPaths.list());
  const items = data?.items || [];

  // null | { type: 'create' } | { type: 'edit', item } | { type: 'delete', item } | { type: 'staff', room }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState(null); // { message, refs }
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(null); // { type, message }

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => setFlash((cur) => (cur?.message === message ? null : cur)), 4000);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal({ type: "create" });
  };
  const openEdit = (item) => {
    setForm({
      ten_phong: item.ten_phong,
      loai_phong: item.loai_phong === LOAI_XN ? LOAI_XN : LOAI_KHAM,
      chuyen_khoa_id: item.chuyen_khoa ? String(item.chuyen_khoa.id) : "",
    });
    setFormError("");
    setModal({ type: "edit", item });
  };
  const closeModal = () => {
    if (submitting) return;
    setModal(null);
    setFormError("");
    setDeleteError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const ten = form.ten_phong.trim();
    if (!ten) return setFormError("Tên phòng là bắt buộc.");
    if (form.loai_phong === LOAI_KHAM && !form.chuyen_khoa_id) {
      return setFormError("Phòng khám bắt buộc chọn chuyên khoa.");
    }
    const payload = {
      ten_phong: ten,
      loai_phong: form.loai_phong,
      chuyen_khoa_id: form.loai_phong === LOAI_KHAM ? Number(form.chuyen_khoa_id) : null,
    };

    setSubmitting(true);
    setFormError("");
    try {
      if (modal.type === "create") {
        await adminRoomApi.create(payload);
        showFlash("success", `Đã thêm phòng "${ten}".`);
      } else {
        await adminRoomApi.update(modal.item.id, payload);
        showFlash("success", `Đã cập nhật phòng "${ten}".`);
      }
      setModal(null);
      reload();
    } catch (err) {
      // Lỗi nghiệp vụ từ backend: DUPLICATE_NAME, ROOM_TYPE_LOCKED, SPECIALTY_LOCKED, 400 validate
      setFormError(err.message || "Không thể lưu phòng.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    setDeleteError(null);
    try {
      await adminRoomApi.delete(modal.item.id);
      showFlash("success", `Đã xóa phòng "${modal.item.ten_phong}".`);
      setModal(null);
      reload();
    } catch (err) {
      setDeleteError({ message: err.message || "Không thể xóa phòng.", refs: err.data || null });
    } finally {
      setSubmitting(false);
    }
  };

  // Khi list đang reload thì giữ bản phòng cũ để panel nhân viên không bị đóng
  const staffRoom = modal?.type === "staff" ? items.find((r) => r.id === modal.room.id) || modal.room : null;

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <header className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Danh mục nền tảng</span>
            <h1 className="admin-header__title">Danh sách phòng</h1>
            <p className="admin-header__desc">Phòng khám và phòng xét nghiệm, kèm nhân viên được gán vào từng phòng.</p>
          </div>
          <Button onClick={openCreate}>+ Thêm phòng</Button>
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
          <p>Đang tải danh sách phòng...</p>
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
          <p>Chưa có phòng nào trong hệ thống.</p>
          <Button onClick={openCreate}>Tạo phòng đầu tiên</Button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ minWidth: "200px" }}>Tên phòng</th>
                <th>Loại phòng</th>
                <th>Chuyên khoa</th>
                <th>Nhân viên</th>
                <th style={{ width: "220px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.ten_phong}</strong>
                  </td>
                  <td>
                    <Badge variant={item.loai_phong === LOAI_XN ? "success" : "progress"}>
                      {item.loai_phong || "—"}
                    </Badge>
                  </td>
                  <td style={{ color: item.chuyen_khoa ? "inherit" : "var(--text-muted)" }}>
                    {item.chuyen_khoa?.ten_chuyen_khoa || "—"}
                  </td>
                  <td>
                    <strong>{item.so_nhan_vien}</strong>
                    {item.so_nhan_vien > 0 && (
                      <span className="admin-form-hint" style={{ display: "block" }}>
                        {item.nhan_vien.map((s) => s.ten_dang_nhap).join(", ")}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "center" }}>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--outline"
                        onClick={() => setModal({ type: "staff", room: item })}
                      >
                        Nhân viên
                      </button>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--outline"
                        onClick={() => openEdit(item)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--danger"
                        onClick={() => {
                          setDeleteError(null);
                          setModal({ type: "delete", item });
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Thêm / Sửa phòng */}
      {(modal?.type === "create" || modal?.type === "edit") && (
        <Modal
          title={modal.type === "create" ? "Thêm phòng" : `Sửa phòng ${modal.item.ten_phong}`}
          onClose={closeModal}
          disabled={submitting}
        >
          <form onSubmit={handleSave}>
            <div className="admin-modal__body">
              {formError && <Notice variant="error">{formError}</Notice>}

              <div className="admin-form-group">
                <label htmlFor="room-name" className="admin-label admin-label--required">
                  Tên phòng
                </label>
                <input
                  id="room-name"
                  type="text"
                  className="admin-input"
                  value={form.ten_phong}
                  onChange={(e) => setForm({ ...form, ten_phong: e.target.value })}
                  placeholder="VD: Phòng 103 - Nội tổng quát"
                  maxLength={MAX_TEN}
                  autoFocus
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="room-type" className="admin-label admin-label--required">
                  Loại phòng
                </label>
                <select
                  id="room-type"
                  className="admin-select"
                  value={form.loai_phong}
                  onChange={(e) => setForm({ ...form, loai_phong: e.target.value })}
                >
                  <option value={LOAI_KHAM}>{LOAI_KHAM}</option>
                  <option value={LOAI_XN}>{LOAI_XN}</option>
                </select>
                {modal.type === "edit" && (
                  <span className="admin-form-hint">
                    Không đổi được loại phòng khi phòng đã có lịch, chỉ định hoặc nhân viên.
                  </span>
                )}
              </div>

              {form.loai_phong === LOAI_KHAM && (
                <div className="admin-form-group">
                  <label htmlFor="room-specialty" className="admin-label admin-label--required">
                    Chuyên khoa
                  </label>
                  <select
                    id="room-specialty"
                    className="admin-select"
                    value={form.chuyen_khoa_id}
                    onChange={(e) => setForm({ ...form, chuyen_khoa_id: e.target.value })}
                    disabled={specialties.loading}
                  >
                    <option value="">{specialties.loading ? "Đang tải..." : "-- Chọn chuyên khoa --"}</option>
                    {(specialties.data?.items || []).map((ck) => (
                      <option key={ck.id} value={ck.id}>
                        {ck.ten_chuyen_khoa}
                      </option>
                    ))}
                  </select>
                  {specialties.error && (
                    <span className="admin-form-hint">Không tải được danh sách chuyên khoa.</span>
                  )}
                </div>
              )}
            </div>
            <div className="admin-modal__footer">
              <Button variant="outline" type="button" onClick={closeModal} disabled={submitting}>
                Hủy
              </Button>
              <Button type="submit" loading={submitting}>
                Lưu phòng
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Xác nhận xóa */}
      {modal?.type === "delete" && (
        <Modal
          title="Xác nhận xóa phòng"
          onClose={closeModal}
          disabled={submitting}
          footer={
            <>
              <Button variant="outline" type="button" onClick={closeModal} disabled={submitting}>
                {deleteError ? "Đóng" : "Hủy"}
              </Button>
              {!deleteError && (
                <Button variant="danger" type="button" loading={submitting} onClick={handleDelete}>
                  Xóa phòng
                </Button>
              )}
            </>
          }
        >
          <div className="admin-modal__body">
            <p style={{ margin: 0 }}>
              Bạn có chắc muốn xóa phòng <strong>{modal.item.ten_phong}</strong>?
            </p>
            {deleteError && (
              <div className="admin-ref-box" role="alert">
                <strong>Không thể xóa phòng</strong>
                <p style={{ margin: "4px 0 0" }}>{deleteError.message}</p>
                <RefList refs={deleteError.refs} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Gán nhân viên */}
      {staffRoom && (
        <StaffModal
          room={staffRoom}
          rooms={items}
          onClose={() => setModal(null)}
          onChanged={(msg) => {
            showFlash("success", msg);
            reload();
          }}
        />
      )}
    </div>
  );
}