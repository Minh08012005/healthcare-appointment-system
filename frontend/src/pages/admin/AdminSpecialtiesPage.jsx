import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminSpecialtyApi, adminSpecialtyPaths } from "../../api/adminSpecialties";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const MAX_TEN = 100;
const MAX_MO_TA = 2000;

export default function AdminSpecialtiesPage() {
  const { data, loading, error, reload } = useFetch(adminSpecialtyPaths.list());
  const items = data?.items || [];

  // Modal state: null | { type: 'create' } | { type: 'edit', item } | { type: 'delete', item }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ten_chuyen_khoa: "", mo_ta: "" });
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState(null); // { message, refs }
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(null); // { type: 'success' | 'error', message: string }

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => {
      setFlash((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const openCreate = () => {
    setForm({ ten_chuyen_khoa: "", mo_ta: "" });
    setFormError("");
    setModal({ type: "create" });
  };

  const openEdit = (item) => {
    setForm({
      ten_chuyen_khoa: item.ten_chuyen_khoa || "",
      mo_ta: item.mo_ta || "",
    });
    setFormError("");
    setModal({ type: "edit", item });
  };

  const openDelete = (item) => {
    setDeleteError(null);
    setModal({ type: "delete", item });
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
    setFormError("");
    setDeleteError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const ten = form.ten_chuyen_khoa.trim();
    if (!ten) {
      setFormError("Tên chuyên khoa là bắt buộc và không được để trống");
      return;
    }
    if (ten.length > MAX_TEN) {
      setFormError(`Tên chuyên khoa không được vượt quá ${MAX_TEN} ký tự`);
      return;
    }
    const moTa = form.mo_ta.trim();
    if (moTa.length > MAX_MO_TA) {
      setFormError(`Mô tả không được vượt quá ${MAX_MO_TA} ký tự`);
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        ten_chuyen_khoa: ten,
        mo_ta: moTa === "" ? null : moTa,
      };

      if (modal.type === "create") {
        await adminSpecialtyApi.create(payload);
        showFlash("success", `Đã thêm chuyên khoa "${ten}" thành công.`);
      } else {
        await adminSpecialtyApi.update(modal.item.id, payload);
        showFlash("success", `Đã cập nhật chuyên khoa "${ten}" thành công.`);
      }

      closeModal();
      reload();
    } catch (err) {
      if (err.code === "DUPLICATE_NAME" || err.status === 409) {
        setFormError("Tên chuyên khoa đã tồn tại. Vui lòng chọn tên khác.");
      } else {
        setFormError(err.message || "Không thể lưu thông tin chuyên khoa");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!modal?.item) return;
    setSubmitting(true);
    setDeleteError(null);

    try {
      await adminSpecialtyApi.delete(modal.item.id);
      showFlash("success", `Đã xóa chuyên khoa "${modal.item.ten_chuyen_khoa}".`);
      closeModal();
      reload();
    } catch (err) {
      if (err.code === "HAS_REFERENCES" || err.status === 409) {
        setDeleteError({
          message: err.message || "Chuyên khoa còn dữ liệu liên kết, không thể xóa.",
          refs: err.data || null,
        });
      } else {
        setDeleteError({
          message: err.message || "Không thể xóa chuyên khoa.",
          refs: null,
        });
      }
    } finally {
      setSubmitting(false);
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
            <span className="admin-header__badge">Danh mục nền tảng</span>
            <h1 className="admin-header__title">Quản lý chuyên khoa</h1>
            <p className="admin-header__desc">
              Quản lý danh mục các chuyên khoa khám bệnh, tạo mới, chỉnh sửa và quản lý liên kết bác sĩ/phòng khám.
            </p>
          </div>
          <Button onClick={openCreate}>+ Thêm chuyên khoa</Button>
        </div>
      </header>

      {flash && (
        <div
          className={`admin-flash admin-flash--${flash.type}`}
          role="status"
          aria-live="polite"
        >
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
          <p>Đang tải danh sách chuyên khoa...</p>
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
          <p>Chưa có chuyên khoa nào trong hệ thống.</p>
          <Button onClick={openCreate}>Tạo chuyên khoa đầu tiên</Button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Mã ID</th>
                <th style={{ minWidth: "220px" }}>Tên chuyên khoa</th>
                <th>Mô tả</th>
                <th style={{ width: "120px", textAlign: "center" }}>Bác sĩ</th>
                <th style={{ width: "120px", textAlign: "center" }}>Phòng khám</th>
                <th style={{ width: "140px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>#{item.id}</code>
                  </td>
                  <td>
                    <strong>{item.ten_chuyen_khoa}</strong>
                  </td>
                  <td style={{ color: item.mo_ta ? "inherit" : "var(--text-muted)" }}>
                    {item.mo_ta || "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Badge variant={item.so_bac_si > 0 ? "info" : "neutral"}>
                      {item.so_bac_si} bác sĩ
                    </Badge>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Badge variant={item.so_phong > 0 ? "info" : "neutral"}>
                      {item.so_phong} phòng
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "center" }}>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--outline"
                        onClick={() => openEdit(item)}
                        title="Chỉnh sửa chuyên khoa"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--danger"
                        onClick={() => openDelete(item)}
                        title="Xóa chuyên khoa"
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

      {/* Modal: Thêm / Sửa Chuyên khoa */}
      {(modal?.type === "create" || modal?.type === "edit") && (
        <div
          className="admin-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-specialty-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-specialty-title" className="admin-modal__title">
                {modal.type === "create"
                  ? "Thêm chuyên khoa mới"
                  : `Chỉnh sửa chuyên khoa #${modal.item.id}`}
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="admin-modal__body">
                {formError && (
                  <Notice variant="error" role="alert">
                    {formError}
                  </Notice>
                )}

                <div className="admin-form-group">
                  <label htmlFor="spec-name" className="admin-label admin-label--required">
                    Tên chuyên khoa
                  </label>
                  <input
                    id="spec-name"
                    type="text"
                    className="admin-input"
                    value={form.ten_chuyen_khoa}
                    onChange={(e) => setForm({ ...form, ten_chuyen_khoa: e.target.value })}
                    placeholder="VD: Tim mạch, Nội tiết, Nhi khoa..."
                    maxLength={MAX_TEN}
                    autoFocus
                    required
                  />
                  <span className="admin-form-hint">
                    Tối đa {MAX_TEN} ký tự. Không được trùng với chuyên khoa đã có.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="spec-desc" className="admin-label">
                    Mô tả chuyên khoa
                  </label>
                  <textarea
                    id="spec-desc"
                    className="admin-textarea"
                    value={form.mo_ta}
                    onChange={(e) => setForm({ ...form, mo_ta: e.target.value })}
                    placeholder="Giới thiệu chức năng chẩn đoán, điều trị của chuyên khoa..."
                    maxLength={MAX_MO_TA}
                    rows={4}
                  />
                  <span className="admin-form-hint">
                    Tối đa {MAX_MO_TA} ký tự (tùy chọn).
                  </span>
                </div>
              </div>

              <div className="admin-modal__footer">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button type="submit" loading={submitting}>
                  {modal.type === "create" ? "Tạo chuyên khoa" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Xóa Chuyên khoa */}
      {modal?.type === "delete" && modal.item && (
        <div
          className="admin-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-delete-title" className="admin-modal__title">
                Xác nhận xóa chuyên khoa
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="admin-modal__body">
              <p>
                Bạn có chắc chắn muốn xóa chuyên khoa{" "}
                <strong>"{modal.item.ten_chuyen_khoa}"</strong> (Mã: #{modal.item.id})?
              </p>

              {/* Cảnh báo trước khi bấm xóa nếu đã thấy có liên kết */}
              {!deleteError && (modal.item.so_bac_si > 0 || modal.item.so_phong > 0) && (
                <div className="admin-ref-box">
                  <strong>Cảnh báo dữ liệu liên kết:</strong>
                  <p style={{ margin: "4px 0 0 0" }}>
                    Chuyên khoa này hiện đang ghi nhận{" "}
                    {modal.item.so_bac_si > 0 && `${modal.item.so_bac_si} bác sĩ`}
                    {modal.item.so_bac_si > 0 && modal.item.so_phong > 0 && " và "}
                    {modal.item.so_phong > 0 && `${modal.item.so_phong} phòng khám`}.
                    Hệ thống sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.
                  </p>
                </div>
              )}

              {/* Chi tiết lỗi từ Backend khi bị chặn bởi liên kết */}
              {deleteError && (
                <div className="admin-ref-box" role="alert">
                  <strong>Không thể xóa chuyên khoa:</strong>
                  <p style={{ margin: "4px 0 0 0" }}>{deleteError.message}</p>
                  {deleteError.refs && (
                    <ul>
                      <li>Số bác sĩ thuộc chuyên khoa: <strong>{deleteError.refs.so_bac_si ?? 0}</strong></li>
                      <li>Số phòng khám thuộc chuyên khoa: <strong>{deleteError.refs.so_phong ?? 0}</strong></li>
                      <li>Số lịch hẹn đã/đang đặt: <strong>{deleteError.refs.so_lich_hen ?? 0}</strong></li>
                    </ul>
                  )}
                  <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--danger-text)" }}>
                    💡 Hướng dẫn: Vui lòng chuyển các bác sĩ và phòng khám sang chuyên khoa khác trước khi thực hiện xóa.
                  </p>
                </div>
              )}
            </div>

            <div className="admin-modal__footer">
              <Button
                variant="outline"
                type="button"
                onClick={closeModal}
                disabled={submitting}
              >
                {deleteError ? "Đóng" : "Hủy"}
              </Button>
              {!deleteError && (
                <Button
                  variant="danger"
                  type="button"
                  loading={submitting}
                  onClick={handleDelete}
                >
                  Xác nhận xóa
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
