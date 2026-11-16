import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminDoctorApi, adminDoctorPaths } from "../../api/adminDoctors";
import { adminSpecialtyPaths } from "../../api/adminSpecialties";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const MAX_HO_TEN = 100;
const MAX_CAP_BAC = 100;

export default function AdminDoctorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCkId = searchParams.get("chuyen_khoa_id") || "";
  const initialSearch = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(initialSearch);

  // Lấy danh mục chuyên khoa để phục vụ filter và chọn trong form
  const { data: specialtiesData } = useFetch(adminSpecialtyPaths.list());
  const specialties = specialtiesData?.items || [];

  // Lấy danh sách bác sĩ theo filter và search
  const doctorListPath = adminDoctorPaths.list({
    chuyenKhoaId: selectedCkId || undefined,
    q: searchParams.get("q") || undefined,
  });
  const { data: doctorsData, loading, error, reload } = useFetch(doctorListPath);
  const doctors = doctorsData?.items || [];

  // Modal: null | { type: 'create' } | { type: 'edit', item }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    ho_ten: "",
    chuyen_khoa_id: "",
    cap_bac: "",
    muc_phi: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(null);

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => {
      setFlash((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const handleFilterChange = (newCkId) => {
    const next = new URLSearchParams(searchParams);
    if (newCkId) {
      next.set("chuyen_khoa_id", newCkId);
    } else {
      next.delete("chuyen_khoa_id");
    }
    setSearchParams(next, { replace: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    const q = searchInput.trim();
    if (q) {
      next.set("q", q);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams({}, { replace: true });
  };

  const openCreate = () => {
    setForm({
      ho_ten: "",
      chuyen_khoa_id: selectedCkId || (specialties[0]?.id ? String(specialties[0].id) : ""),
      cap_bac: "",
      muc_phi: "",
    });
    setFormError("");
    setModal({ type: "create" });
  };

  const openEdit = (doc) => {
    setForm({
      ho_ten: doc.ho_ten || "",
      chuyen_khoa_id: doc.chuyen_khoa?.id ? String(doc.chuyen_khoa.id) : "",
      cap_bac: doc.cap_bac || "",
      muc_phi: doc.muc_phi !== null && doc.muc_phi !== undefined ? String(doc.muc_phi) : "",
    });
    setFormError("");
    setModal({ type: "edit", item: doc });
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
    setFormError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const hoTen = form.ho_ten.trim();
    if (!hoTen) {
      setFormError("Họ tên bác sĩ là bắt buộc và không được để trống");
      return;
    }
    if (hoTen.length > MAX_HO_TEN) {
      setFormError(`Họ tên không được vượt quá ${MAX_HO_TEN} ký tự`);
      return;
    }

    if (!form.chuyen_khoa_id) {
      setFormError("Vui lòng chọn một chuyên khoa cho bác sĩ");
      return;
    }

    const capBac = form.cap_bac.trim();
    if (capBac.length > MAX_CAP_BAC) {
      setFormError(`Cấp bậc không được vượt quá ${MAX_CAP_BAC} ký tự`);
      return;
    }

    let mucPhiNum = null;
    if (form.muc_phi !== "" && form.muc_phi !== null) {
      const parsed = Number(form.muc_phi);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError("Mức phí khám phải là số không âm");
        return;
      }
      mucPhiNum = parsed;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        ho_ten: hoTen,
        chuyen_khoa_id: Number(form.chuyen_khoa_id),
        cap_bac: capBac === "" ? null : capBac,
        muc_phi: mucPhiNum,
      };

      if (modal.type === "create") {
        await adminDoctorApi.create(payload);
        showFlash("success", `Đã thêm bác sĩ "${hoTen}" thành công.`);
      } else {
        await adminDoctorApi.update(modal.item.id, payload);
        showFlash("success", `Đã cập nhật thông tin bác sĩ "${hoTen}" thành công.`);
      }

      closeModal();
      reload();
    } catch (err) {
      setFormError(err.message || "Không thể lưu thông tin bác sĩ");
    } finally {
      setSubmitting(false);
    }
  };

  const isFiltered = Boolean(selectedCkId || searchParams.get("q"));

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <header className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Nhân sự chuyên môn</span>
            <h1 className="admin-header__title">Quản lý bác sĩ</h1>
            <p className="admin-header__desc">
              Hồ sơ bác sĩ điều trị, phân bổ chuyên khoa, thiết lập mức phí khám và cấp bậc chuyên môn.
            </p>
          </div>
          <Button onClick={openCreate}>+ Thêm bác sĩ</Button>
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

      {/* Toolbar: Bộ lọc chuyên khoa & Ô tìm kiếm */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="filter-specialty" className="admin-label" style={{ margin: 0 }}>
              Chuyên khoa:
            </label>
            <select
              id="filter-specialty"
              className="admin-select"
              value={selectedCkId}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">Tất cả chuyên khoa</option>
              {specialties.map((ck) => (
                <option key={ck.id} value={ck.id}>
                  {ck.ten_chuyen_khoa}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="admin-search-wrap">
            <input
              type="text"
              className="admin-input"
              style={{ width: "220px" }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên bác sĩ..."
            />
            <Button type="submit" variant="secondary" size="sm">
              Tìm
            </Button>
          </form>

          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              title="Xóa bộ lọc"
            >
              Đặt lại lọc
            </Button>
          )}
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          Tổng số: <strong>{doctors.length}</strong> bác sĩ
        </div>
      </div>

      {loading && (
        <div className="admin-state-box" role="status">
          <div className="admin-spinner" aria-hidden="true" />
          <p>Đang tải danh sách bác sĩ...</p>
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

      {!loading && !error && doctors.length === 0 && (
        <div className="admin-state-box">
          <p>
            {isFiltered
              ? "Không tìm thấy bác sĩ nào khớp với điều kiện tìm kiếm/lọc."
              : "Chưa có bác sĩ nào trong hệ thống."}
          </p>
          {isFiltered ? (
            <Button variant="secondary" onClick={handleClearFilters}>
              Xóa bộ lọc
            </Button>
          ) : (
            <Button onClick={openCreate}>Thêm bác sĩ đầu tiên</Button>
          )}
        </div>
      )}

      {!loading && !error && doctors.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Mã ID</th>
                <th style={{ minWidth: "200px" }}>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Cấp bậc / Chức danh</th>
                <th style={{ width: "150px" }}>Phí khám</th>
                <th style={{ width: "140px", textAlign: "center" }}>Tài khoản</th>
                <th style={{ width: "100px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <code>#{doc.id}</code>
                  </td>
                  <td>
                    <strong>{doc.ho_ten}</strong>
                  </td>
                  <td>
                    {doc.chuyen_khoa?.ten_chuyen_khoa ? (
                      <Badge variant="info">{doc.chuyen_khoa.ten_chuyen_khoa}</Badge>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Chưa phân khoa</span>
                    )}
                  </td>
                  <td style={{ color: doc.cap_bac ? "inherit" : "var(--text-muted)" }}>
                    {doc.cap_bac || "—"}
                  </td>
                  <td>
                    {doc.muc_phi !== null && doc.muc_phi !== undefined ? (
                      <span style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                        {Number(doc.muc_phi).toLocaleString("vi-VN")} đ
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Chưa thiết lập</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Badge variant={doc.co_tai_khoan ? "success" : "neutral"}>
                      {doc.co_tai_khoan ? "Đã liên kết" : "Chưa liên kết"}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "center" }}>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--outline"
                        onClick={() => openEdit(doc)}
                        title="Chỉnh sửa thông tin bác sĩ"
                      >
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Thêm / Sửa Bác sĩ */}
      {modal && (
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
            aria-labelledby="modal-doctor-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-doctor-title" className="admin-modal__title">
                {modal.type === "create"
                  ? "Thêm hồ sơ bác sĩ mới"
                  : `Chỉnh sửa bác sĩ: ${modal.item.ho_ten} (#${modal.item.id})`}
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
                  <label htmlFor="doc-name" className="admin-label admin-label--required">
                    Họ và tên bác sĩ
                  </label>
                  <input
                    id="doc-name"
                    type="text"
                    className="admin-input"
                    value={form.ho_ten}
                    onChange={(e) => setForm({ ...form, ho_ten: e.target.value })}
                    placeholder="VD: Trần Thị Bình, Nguyễn Văn An..."
                    maxLength={MAX_HO_TEN}
                    autoFocus
                    required
                  />
                  <span className="admin-form-hint">Tối đa {MAX_HO_TEN} ký tự.</span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="doc-spec" className="admin-label admin-label--required">
                    Chuyên khoa trực thuộc
                  </label>
                  <select
                    id="doc-spec"
                    className="admin-select"
                    value={form.chuyen_khoa_id}
                    onChange={(e) => setForm({ ...form, chuyen_khoa_id: e.target.value })}
                    required
                  >
                    <option value="" disabled>
                      -- Chọn chuyên khoa --
                    </option>
                    {specialties.map((ck) => (
                      <option key={ck.id} value={ck.id}>
                        {ck.ten_chuyen_khoa}
                      </option>
                    ))}
                  </select>
                  <span className="admin-form-hint">
                    Bắt buộc. Bác sĩ phải thuộc một chuyên khoa khám bệnh.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="doc-rank" className="admin-label">
                    Cấp bậc / Chức danh chuyên môn
                  </label>
                  <input
                    id="doc-rank"
                    type="text"
                    className="admin-input"
                    value={form.cap_bac}
                    onChange={(e) => setForm({ ...form, cap_bac: e.target.value })}
                    placeholder="VD: Thạc sĩ, Bác sĩ CKI, Phó Giáo sư..."
                    maxLength={MAX_CAP_BAC}
                  />
                  <span className="admin-form-hint">
                    Tùy chọn. Hiển thị cho bệnh nhân khi đặt lịch khám.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="doc-fee" className="admin-label">
                    Mức phí khám (VNĐ)
                  </label>
                  <input
                    id="doc-fee"
                    type="number"
                    min="0"
                    step="1000"
                    className="admin-input"
                    value={form.muc_phi}
                    onChange={(e) => setForm({ ...form, muc_phi: e.target.value })}
                    placeholder="VD: 350000"
                  />
                  <span className="admin-form-hint">
                    Tùy chọn. Giá tiền áp dụng cho mỗi lượt đặt khám (đơn vị: VNĐ).
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
                  {modal.type === "create" ? "Tạo bác sĩ" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
