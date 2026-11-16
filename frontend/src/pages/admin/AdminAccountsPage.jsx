import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminAccountApi, adminAccountPaths } from "../../api/adminAccounts";
import { adminDoctorPaths } from "../../api/adminDoctors";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const STAFF_ROLES = ["Bác sĩ", "Lễ tân", "Xét nghiệm"];
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;
const PW_MIN = 6;
const PW_MAX = 72;

export default function AdminAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRole = searchParams.get("vai_tro") || "";
  const selectedStatus = searchParams.get("trang_thai") || "";
  const initialSearch = searchParams.get("q") || "";

  const [searchInput, setSearchInput] = useState(initialSearch);

  // Lấy danh sách tài khoản theo filter và search
  const accountListPath = adminAccountPaths.list({
    vaiTro: selectedRole || undefined,
    trangThai: selectedStatus || undefined,
    q: searchParams.get("q") || undefined,
  });
  const { data: accountsData, loading, error, reload } = useFetch(accountListPath);
  const accounts = accountsData?.items || [];

  // Lấy danh sách bác sĩ để hỗ trợ liên kết khi tạo tài khoản Bác sĩ
  const { data: doctorsData } = useFetch(adminDoctorPaths.list({ limit: 200 }));
  const doctors = doctorsData?.items || [];

  // Modal: null | { type: 'create' } | { type: 'edit', item } | { type: 'lock', item } | { type: 'unlock', item }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    ten_dang_nhap: "",
    password: "",
    vai_tro: "Bác sĩ",
    bac_si_id: "",
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

  const handleRoleFilterChange = (role) => {
    const next = new URLSearchParams(searchParams);
    if (role) {
      next.set("vai_tro", role);
    } else {
      next.delete("vai_tro");
    }
    setSearchParams(next, { replace: true });
  };

  const handleStatusFilterChange = (status) => {
    const next = new URLSearchParams(searchParams);
    if (status) {
      next.set("trang_thai", status);
    } else {
      next.delete("trang_thai");
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
      ten_dang_nhap: "",
      password: "",
      vai_tro: "Bác sĩ",
      bac_si_id: "",
    });
    setFormError("");
    setModal({ type: "create" });
  };

  const openEdit = (acc) => {
    setForm({
      ten_dang_nhap: acc.ten_dang_nhap || "",
      password: "",
      vai_tro: acc.vai_tro || "Bác sĩ",
      bac_si_id: acc.bac_si?.id ? String(acc.bac_si.id) : "",
    });
    setFormError("");
    setModal({ type: "edit", item: acc });
  };

  const openLock = (acc) => {
    setFormError("");
    setModal({ type: "lock", item: acc });
  };

  const openUnlock = (acc) => {
    setFormError("");
    setModal({ type: "unlock", item: acc });
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
    setFormError("");
  };

  const mapErrorMessage = (err, defaultMsg) => {
    if (err.code === "DUPLICATE_USERNAME" || err.status === 409) {
      if (err.code === "ROLE_LINKED") {
        return "Tài khoản đang liên kết với hồ sơ bác sĩ, không thể thay đổi vai trò.";
      }
      if (err.code === "BACSI_ALREADY_LINKED") {
        return "Bác sĩ được chọn đã có tài khoản liên kết.";
      }
      return "Tên đăng nhập đã tồn tại trong hệ thống. Vui lòng chọn tên khác.";
    }
    if (err.code === "CANNOT_LOCK_SELF") {
      return "Không thể khóa tài khoản của chính mình.";
    }
    return err.message || defaultMsg;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const username = form.ten_dang_nhap.trim();

    if (!username) {
      setFormError("Tên đăng nhập là bắt buộc.");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setFormError(
        "Tên đăng nhập phải dài 3-50 ký tự, chỉ gồm chữ cái, chữ số, dấu gạch dưới, gạch ngang hoặc dấu chấm."
      );
      return;
    }

    if (!STAFF_ROLES.includes(form.vai_tro)) {
      setFormError("Vai trò không hợp lệ. Vui lòng chọn Bác sĩ, Lễ tân hoặc Xét nghiệm.");
      return;
    }

    if (modal.type === "create") {
      if (!form.password) {
        setFormError("Mật khẩu là bắt buộc khi tạo tài khoản mới.");
        return;
      }
      if (form.password.length < PW_MIN || form.password.length > PW_MAX) {
        setFormError(`Mật khẩu phải từ ${PW_MIN} đến ${PW_MAX} ký tự.`);
        return;
      }
    } else if (modal.type === "edit") {
      if (form.password && (form.password.length < PW_MIN || form.password.length > PW_MAX)) {
        setFormError(`Mật khẩu mới phải từ ${PW_MIN} đến ${PW_MAX} ký tự.`);
        return;
      }
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (modal.type === "create") {
        const payload = {
          ten_dang_nhap: username,
          password: form.password,
          vai_tro: form.vai_tro,
        };
        if (form.vai_tro === "Bác sĩ" && form.bac_si_id) {
          payload.bac_si_id = Number(form.bac_si_id);
        }
        await adminAccountApi.create(payload);
        showFlash("success", `Đã tạo tài khoản "${username}" thành công.`);
      } else {
        const payload = {};
        if (username !== modal.item.ten_dang_nhap) {
          payload.ten_dang_nhap = username;
        }
        if (form.password) {
          payload.password = form.password;
        }
        if (form.vai_tro !== modal.item.vai_tro && !modal.item.bac_si) {
          payload.vai_tro = form.vai_tro;
        }

        if (Object.keys(payload).length === 0) {
          closeModal();
          return;
        }

        await adminAccountApi.update(modal.item.id, payload);
        showFlash("success", `Đã cập nhật tài khoản "${username}" thành công.`);
      }

      closeModal();
      reload();
    } catch (err) {
      setFormError(mapErrorMessage(err, "Không thể lưu thông tin tài khoản"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!modal?.item) return;
    const isLocking = modal.type === "lock";
    const nextStatus = isLocking ? "BiKhoa" : "HoatDong";

    setSubmitting(true);
    setFormError("");

    try {
      await adminAccountApi.setStatus(modal.item.id, nextStatus);
      showFlash(
        "success",
        isLocking
          ? `Đã khóa tài khoản "${modal.item.ten_dang_nhap}".`
          : `Đã mở khóa tài khoản "${modal.item.ten_dang_nhap}".`
      );
      closeModal();
      reload();
    } catch (err) {
      setFormError(mapErrorMessage(err, "Không thể cập nhật trạng thái tài khoản"));
    } finally {
      setSubmitting(false);
    }
  };

  const isFiltered = Boolean(selectedRole || selectedStatus || searchParams.get("q"));

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "Bác sĩ":
        return "progress";
      case "Lễ tân":
        return "pending";
      case "Xét nghiệm":
        return "neutral";
      default:
        return "neutral";
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
            <span className="admin-header__badge">Quản trị nhân sự & Tài khoản</span>
            <h1 className="admin-header__title">Quản lý tài khoản nhân viên</h1>
            <p className="admin-header__desc">
              Quản lý danh sách, tạo mới, chỉnh sửa thông tin và phân quyền/khóa tài khoản nhân viên y tế (Bác sĩ, Lễ tân, Xét nghiệm).
            </p>
          </div>
          <Button onClick={openCreate}>+ Thêm tài khoản</Button>
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

      {/* Toolbar: Bộ lọc vai trò, trạng thái & Tìm kiếm */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="filter-role" className="admin-label" style={{ margin: 0 }}>
              Vai trò:
            </label>
            <select
              id="filter-role"
              className="admin-select"
              value={selectedRole}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="filter-status" className="admin-label" style={{ margin: 0 }}>
              Trạng thái:
            </label>
            <select
              id="filter-status"
              className="admin-select"
              value={selectedStatus}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="HoatDong">Hoạt động</option>
              <option value="BiKhoa">Bị khóa</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="admin-search-wrap">
            <input
              type="text"
              className="admin-input"
              style={{ width: "220px" }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên đăng nhập..."
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
          Tổng số: <strong>{accounts.length}</strong> tài khoản
        </div>
      </div>

      {loading && (
        <div className="admin-state-box" role="status">
          <div className="admin-spinner" aria-hidden="true" />
          <p>Đang tải danh sách tài khoản...</p>
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

      {!loading && !error && accounts.length === 0 && (
        <div className="admin-state-box">
          <p>
            {isFiltered
              ? "Không tìm thấy tài khoản nào khớp với điều kiện tìm kiếm/lọc."
              : "Chưa có tài khoản nhân viên nào trong hệ thống."}
          </p>
          {isFiltered ? (
            <Button variant="secondary" onClick={handleClearFilters}>
              Xóa bộ lọc
            </Button>
          ) : (
            <Button onClick={openCreate}>Thêm tài khoản đầu tiên</Button>
          )}
        </div>
      )}

      {!loading && !error && accounts.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Mã ID</th>
                <th style={{ minWidth: "180px" }}>Tên đăng nhập</th>
                <th style={{ width: "130px" }}>Vai trò</th>
                <th style={{ minWidth: "180px" }}>Hồ sơ liên kết</th>
                <th style={{ width: "130px" }}>Phòng khám/XN</th>
                <th style={{ width: "120px", textAlign: "center" }}>Trạng thái</th>
                <th style={{ width: "160px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>
                    <code>#{acc.id}</code>
                  </td>
                  <td>
                    <strong>{acc.ten_dang_nhap}</strong>
                  </td>
                  <td>
                    <Badge variant={getRoleBadgeVariant(acc.vai_tro)}>
                      {acc.vai_tro}
                    </Badge>
                  </td>
                  <td>
                    {acc.bac_si ? (
                      <span>
                        {acc.bac_si.ho_ten}{" "}
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          (BS #{acc.bac_si.id})
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {acc.phong_kham_id ? (
                      <span>Phòng #{acc.phong_kham_id}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Chưa gán</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Badge variant={acc.trang_thai === "HoatDong" ? "success" : "danger"}>
                      {acc.trang_thai === "HoatDong" ? "Hoạt động" : "Bị khóa"}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "center" }}>
                      <button
                        type="button"
                        className="admin-btn-sm admin-btn-sm--outline"
                        onClick={() => openEdit(acc)}
                        title="Chỉnh sửa thông tin tài khoản"
                      >
                        Sửa
                      </button>

                      {acc.trang_thai === "HoatDong" ? (
                        <button
                          type="button"
                          className="admin-btn-sm admin-btn-sm--danger"
                          onClick={() => openLock(acc)}
                          title="Khóa tài khoản này"
                        >
                          Khóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-sm admin-btn-sm--success"
                          onClick={() => openUnlock(acc)}
                          title="Mở khóa tài khoản này"
                        >
                          Mở khóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Thêm / Sửa Tài khoản */}
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
            aria-labelledby="modal-account-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-account-title" className="admin-modal__title">
                {modal.type === "create"
                  ? "Thêm tài khoản nhân viên mới"
                  : `Chỉnh sửa tài khoản: ${modal.item.ten_dang_nhap} (#${modal.item.id})`}
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
                  <label htmlFor="acc-username" className="admin-label admin-label--required">
                    Tên đăng nhập
                  </label>
                  <input
                    id="acc-username"
                    type="text"
                    className="admin-input"
                    value={form.ten_dang_nhap}
                    onChange={(e) => setForm({ ...form, ten_dang_nhap: e.target.value })}
                    placeholder="VD: bs_nam, letan_mai, xn_hoa..."
                    maxLength={50}
                    autoFocus
                    required
                  />
                  <span className="admin-form-hint">
                    Dài từ 3 đến 50 ký tự, chỉ gồm chữ cái, số, dấu chấm, gạch ngang, gạch dưới.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label
                    htmlFor="acc-password"
                    className={`admin-label ${modal.type === "create" ? "admin-label--required" : ""}`}
                  >
                    {modal.type === "create" ? "Mật khẩu ban đầu" : "Đổi mật khẩu mới"}
                  </label>
                  <input
                    id="acc-password"
                    type="password"
                    className="admin-input"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={
                      modal.type === "create"
                        ? "Nhập mật khẩu (tối thiểu 6 ký tự)"
                        : "Để trống nếu giữ nguyên mật khẩu cũ"
                    }
                    minLength={modal.type === "create" ? PW_MIN : undefined}
                    maxLength={PW_MAX}
                    required={modal.type === "create"}
                  />
                  <span className="admin-form-hint">
                    {modal.type === "create"
                      ? `Mật khẩu dài từ ${PW_MIN} đến ${PW_MAX} ký tự.`
                      : `Chỉ nhập khi cần thay đổi mật khẩu (từ ${PW_MIN} đến ${PW_MAX} ký tự).`}
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="acc-role" className="admin-label admin-label--required">
                    Vai trò chuyên môn
                  </label>
                  <select
                    id="acc-role"
                    className="admin-select"
                    value={form.vai_tro}
                    onChange={(e) => setForm({ ...form, vai_tro: e.target.value, bac_si_id: "" })}
                    disabled={modal.type === "edit" && Boolean(modal.item?.bac_si)}
                    required
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {modal.type === "edit" && modal.item?.bac_si && (
                    <span className="admin-form-hint" style={{ color: "var(--warning-text, #9a6214)" }}>
                      Tài khoản đang liên kết với bác sĩ {modal.item.bac_si.ho_ten}. Không thể thay đổi vai trò.
                    </span>
                  )}
                  {(!modal.item?.bac_si || modal.type === "create") && (
                    <span className="admin-form-hint">
                      Chọn vai trò phù hợp trong hệ thống: Bác sĩ, Lễ tân hoặc Xét nghiệm.
                    </span>
                  )}
                </div>

                {modal.type === "create" && form.vai_tro === "Bác sĩ" && (
                  <div className="admin-form-group">
                    <label htmlFor="acc-doctor-link" className="admin-label">
                      Liên kết với hồ sơ bác sĩ (tùy chọn)
                    </label>
                    <select
                      id="acc-doctor-link"
                      className="admin-select"
                      value={form.bac_si_id}
                      onChange={(e) => setForm({ ...form, bac_si_id: e.target.value })}
                    >
                      <option value="">-- Không liên kết (tạo tài khoản độc lập) --</option>
                      {doctors.map((doc) => (
                        <option
                          key={doc.id}
                          value={doc.id}
                          disabled={doc.co_tai_khoan}
                        >
                          {doc.ho_ten} (#{doc.id}) - {doc.chuyen_khoa?.ten_chuyen_khoa || "Chưa phân khoa"}
                          {doc.co_tai_khoan ? " (Đã có tài khoản)" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="admin-form-hint">
                      Có thể liên kết ngay với hồ sơ bác sĩ chưa có tài khoản.
                    </span>
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
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  {modal.type === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Khóa / Mở khóa tài khoản */}
      {(modal?.type === "lock" || modal?.type === "unlock") && modal.item && (
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
            aria-labelledby="modal-status-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-status-title" className="admin-modal__title">
                {modal.type === "lock" ? "Xác nhận khóa tài khoản" : "Xác nhận mở khóa tài khoản"}
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
              {formError && (
                <Notice variant="error" role="alert">
                  {formError}
                </Notice>
              )}

              <p>
                Bạn có chắc chắn muốn {modal.type === "lock" ? "khóa" : "mở khóa"} tài khoản{" "}
                <strong>"{modal.item.ten_dang_nhap}"</strong> (Mã: #{modal.item.id}, vai trò:{" "}
                <strong>{modal.item.vai_tro}</strong>)?
              </p>

              {modal.type === "lock" ? (
                <div className="admin-ref-box">
                  <strong>Cảnh báo khi khóa tài khoản:</strong>
                  <p style={{ margin: "4px 0 0 0" }}>
                    Nhân viên này sẽ bị từ chối khi đăng nhập vào hệ thống MEDICARE cho đến khi được quản trị viên mở khóa lại.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "var(--success-bg, #edf8f2)",
                    border: "1px solid var(--success-border, #a3e0ba)",
                    borderRadius: "var(--radius, 8px)",
                    padding: "14px 16px",
                    color: "var(--success-text, #1e6b3c)",
                    fontSize: "13px",
                    lineHeight: "20px",
                  }}
                >
                  <strong>Kích hoạt lại tài khoản:</strong>
                  <p style={{ margin: "4px 0 0 0" }}>
                    Tài khoản sẽ được chuyển sang trạng thái <strong>Hoạt động</strong> và nhân viên có thể đăng nhập bình thường.
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
                Hủy
              </Button>
              <Button
                variant={modal.type === "lock" ? "danger" : "primary"}
                type="button"
                loading={submitting}
                onClick={handleToggleStatus}
              >
                {modal.type === "lock" ? "Xác nhận khóa" : "Xác nhận mở khóa"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
