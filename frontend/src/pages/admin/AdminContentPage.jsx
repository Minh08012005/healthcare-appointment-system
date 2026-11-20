import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminContentApi, adminContentPaths } from "../../api/adminContent";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const TITLE_MAX = 255;
const CONTENT_MAX = 50000;
const MO_TA_MAX = 5000;
const THU_TU_MAX = 32767;

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState("news"); // 'news' | 'procedure'
  const [flash, setFlash] = useState(null); // { type: 'success' | 'error', message: string }

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => {
      setFlash((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  // =========================================================================
  // TAB 1: TIN TỨC
  // =========================================================================
  const [newsSearch, setNewsSearch] = useState("");
  const [newsStatusFilter, setNewsStatusFilter] = useState(""); // '' | 'HienThi' | 'An'

  const newsPath = adminContentPaths.newsList({
    q: newsSearch || undefined,
    trang_thai: newsStatusFilter || undefined,
  });

  const {
    data: newsData,
    loading: newsLoading,
    error: newsError,
    reload: reloadNews,
  } = useFetch(activeTab === "news" ? newsPath : null);
  const newsList = newsData?.items || [];

  // Modal news: null | { type: 'create' } | { type: 'edit', item } | { type: 'delete', item }
  const [newsModal, setNewsModal] = useState(null);
  const [newsForm, setNewsForm] = useState({
    tieu_de: "",
    noi_dung: "",
    ngay_dang: "",
    trang_thai: "HienThi",
  });
  const [newsFormError, setNewsFormError] = useState("");
  const [newsSubmitting, setNewsSubmitting] = useState(false);

  const openCreateNews = () => {
    setNewsForm({
      tieu_de: "",
      noi_dung: "",
      ngay_dang: "",
      trang_thai: "HienThi",
    });
    setNewsFormError("");
    setNewsModal({ type: "create" });
  };

  const openEditNews = (item) => {
    let dateStr = "";
    if (item.ngay_dang) {
      const d = new Date(item.ngay_dang);
      if (!Number.isNaN(d.getTime())) {
        dateStr = d.toISOString().slice(0, 10);
      }
    }
    setNewsForm({
      tieu_de: item.tieu_de || "",
      noi_dung: item.noi_dung || "",
      ngay_dang: dateStr,
      trang_thai: item.trang_thai || "HienThi",
    });
    setNewsFormError("");
    setNewsModal({ type: "edit", item });
  };

  const openDeleteNews = (item) => {
    setNewsFormError("");
    setNewsModal({ type: "delete", item });
  };

  const closeNewsModal = () => {
    if (newsSubmitting) return;
    setNewsModal(null);
    setNewsFormError("");
  };

  const handleSaveNews = async (e) => {
    e.preventDefault();
    const tieuDe = newsForm.tieu_de.trim();
    if (!tieuDe) {
      setNewsFormError("Tiêu đề tin tức là bắt buộc");
      return;
    }
    if (tieuDe.length > TITLE_MAX) {
      setNewsFormError(`Tiêu đề không được vượt quá ${TITLE_MAX} ký tự`);
      return;
    }
    const noiDung = newsForm.noi_dung.trim();
    if (!noiDung) {
      setNewsFormError("Nội dung tin tức là bắt buộc");
      return;
    }
    if (noiDung.length > CONTENT_MAX) {
      setNewsFormError(`Nội dung không được vượt quá ${CONTENT_MAX} ký tự`);
      return;
    }

    setNewsSubmitting(true);
    setNewsFormError("");

    try {
      const payload = {
        tieu_de: tieuDe,
        noi_dung: noiDung,
        trang_thai: newsForm.trang_thai,
      };
      if (newsForm.ngay_dang) {
        payload.ngay_dang = newsForm.ngay_dang;
      }

      if (newsModal.type === "create") {
        await adminContentApi.createNews(payload);
        showFlash("success", `Đã thêm tin tức "${tieuDe}" thành công.`);
      } else {
        await adminContentApi.updateNews(newsModal.item.id, payload);
        showFlash("success", `Đã cập nhật tin tức "${tieuDe}" thành công.`);
      }

      closeNewsModal();
      reloadNews();
    } catch (err) {
      setNewsFormError(err.message || "Không thể lưu thông tin tin tức");
    } finally {
      setNewsSubmitting(false);
    }
  };

  const handleToggleNewsStatus = async (item) => {
    const nextStatus = item.trang_thai === "HienThi" ? "An" : "HienThi";
    const statusLabel = nextStatus === "HienThi" ? "Hiển thị" : "Ẩn";
    try {
      await adminContentApi.setNewsStatus(item.id, nextStatus);
      showFlash("success", `Đã chuyển trạng thái tin sang "${statusLabel}".`);
      reloadNews();
    } catch (err) {
      showFlash("error", err.message || "Không thể cập nhật trạng thái tin tức");
    }
  };

  const handleDeleteNews = async () => {
    if (!newsModal?.item) return;
    setNewsSubmitting(true);
    try {
      await adminContentApi.deleteNews(newsModal.item.id);
      showFlash("success", `Đã xóa tin tức "${newsModal.item.tieu_de}".`);
      closeNewsModal();
      reloadNews();
    } catch (err) {
      setNewsFormError(err.message || "Không thể xóa tin tức");
    } finally {
      setNewsSubmitting(false);
    }
  };

  // =========================================================================
  // TAB 2: QUY TRÌNH KHÁM
  // =========================================================================
  const {
    data: stepsData,
    loading: stepsLoading,
    error: stepsError,
    reload: reloadSteps,
  } = useFetch(activeTab === "procedure" ? adminContentPaths.stepList() : null);
  const stepsList = stepsData?.items || [];

  // Modal step: null | { type: 'create' } | { type: 'edit', item } | { type: 'delete', item }
  const [stepModal, setStepModal] = useState(null);
  const [stepForm, setStepForm] = useState({
    thu_tu: "",
    tieu_de_buoc: "",
    mo_ta: "",
  });
  const [stepFormError, setStepFormError] = useState("");
  const [stepSubmitting, setStepSubmitting] = useState(false);

  const openCreateStep = () => {
    // Tự động gợi ý thứ tự tiếp theo = max + 1
    const maxOrder = stepsList.reduce(
      (max, step) => (step.thu_tu > max ? step.thu_tu : max),
      0
    );
    const nextOrder = maxOrder + 1 <= THU_TU_MAX ? String(maxOrder + 1) : "";

    setStepForm({
      thu_tu: nextOrder,
      tieu_de_buoc: "",
      mo_ta: "",
    });
    setStepFormError("");
    setStepModal({ type: "create" });
  };

  const openEditStep = (item) => {
    setStepForm({
      thu_tu: String(item.thu_tu),
      tieu_de_buoc: item.tieu_de_buoc || "",
      mo_ta: item.mo_ta || "",
    });
    setStepFormError("");
    setStepModal({ type: "edit", item });
  };

  const openDeleteStep = (item) => {
    setStepFormError("");
    setStepModal({ type: "delete", item });
  };

  const closeStepModal = () => {
    if (stepSubmitting) return;
    setStepModal(null);
    setStepFormError("");
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    const tieuDe = stepForm.tieu_de_buoc.trim();
    if (!tieuDe) {
      setStepFormError("Tiêu đề bước khám là bắt buộc");
      return;
    }
    if (tieuDe.length > TITLE_MAX) {
      setStepFormError(`Tiêu đề không được vượt quá ${TITLE_MAX} ký tự`);
      return;
    }

    const moTa = stepForm.mo_ta.trim();
    if (!moTa) {
      setStepFormError("Mô tả chi tiết bước khám là bắt buộc");
      return;
    }
    if (moTa.length > MO_TA_MAX) {
      setStepFormError(`Mô tả không được vượt quá ${MO_TA_MAX} ký tự`);
      return;
    }

    const thuTuNum = Number(stepForm.thu_tu);
    if (
      !stepForm.thu_tu ||
      !Number.isInteger(thuTuNum) ||
      thuTuNum < 1 ||
      thuTuNum > THU_TU_MAX
    ) {
      setStepFormError(`Thứ tự bước phải là số nguyên từ 1 đến ${THU_TU_MAX}`);
      return;
    }

    setStepSubmitting(true);
    setStepFormError("");

    try {
      const payload = {
        thu_tu: thuTuNum,
        tieu_de_buoc: tieuDe,
        mo_ta: moTa,
      };

      if (stepModal.type === "create") {
        await adminContentApi.createStep(payload);
        showFlash("success", `Đã thêm bước khám "${tieuDe}" thành công.`);
      } else {
        await adminContentApi.updateStep(stepModal.item.id, payload);
        showFlash("success", `Đã cập nhật bước khám "${tieuDe}" thành công.`);
      }

      closeStepModal();
      reloadSteps();
    } catch (err) {
      if (err.code === "DUPLICATE_ORDER" || err.status === 409) {
        setStepFormError(
          `Thứ tự bước (${thuTuNum}) đã tồn tại trong quy trình. Vui lòng nhập số thứ tự khác.`
        );
      } else {
        setStepFormError(err.message || "Không thể lưu thông tin bước khám");
      }
    } finally {
      setStepSubmitting(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!stepModal?.item) return;
    setStepSubmitting(true);
    try {
      await adminContentApi.deleteStep(stepModal.item.id);
      showFlash(
        "success",
        `Đã xóa bước khám "${stepModal.item.tieu_de_buoc}". Thứ tự các bước còn lại được giữ nguyên.`
      );
      closeStepModal();
      reloadSteps();
    } catch (err) {
      setStepFormError(err.message || "Không thể xóa bước khám");
    } finally {
      setStepSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Quản lý nội dung</span>
            <h1 className="admin-header__title">Quản lý nội dung</h1>
            <p className="admin-header__desc">
              Quản lý danh sách tin tức bệnh viện và các bước trong quy trình khám bệnh.
            </p>
          </div>
          <div className="admin-actions">
            {activeTab === "news" ? (
              <Button type="button" onClick={openCreateNews}>
                + Thêm tin tức
              </Button>
            ) : (
              <Button type="button" onClick={openCreateStep}>
                + Thêm bước khám
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Flash Notice */}
      {flash && (
        <div className={`admin-flash admin-flash--${flash.type}`} role="status">
          <span>{flash.message}</span>
          <button
            type="button"
            className="admin-modal__close"
            style={{ fontSize: "16px", marginLeft: "12px" }}
            onClick={() => setFlash(null)}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs" role="tablist" aria-label="Chuyển tab nội dung">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "news"}
          className={`admin-tab ${activeTab === "news" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("news")}
        >
          Tin tức bệnh viện ({newsList.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "procedure"}
          className={`admin-tab ${activeTab === "procedure" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("procedure")}
        >
          Quy trình khám bệnh ({stepsList.length})
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: TIN TỨC GIAO DIỆN */}
      {/* ================================================================= */}
      {activeTab === "news" && (
        <>
          {/* Toolbar lọc / tìm kiếm */}
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <input
                type="text"
                className="admin-input"
                placeholder="Tìm theo tiêu đề tin tức..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                style={{ width: "260px" }}
              />
              <select
                className="admin-select"
                value={newsStatusFilter}
                onChange={(e) => setNewsStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="HienThi">Hiển thị</option>
                <option value="An">Ẩn</option>
              </select>
            </div>
            <div className="admin-form-hint">
              Hiển thị {newsList.length} tin tức
            </div>
          </div>

          {/* Table / State */}
          {newsLoading && (
            <div className="admin-state-box">
              <div className="admin-spinner" />
              <span>Đang tải danh sách tin tức...</span>
            </div>
          )}

          {newsError && !newsLoading && (
            <Notice variant="error" role="alert">
              <span>{newsError.message || "Không thể tải danh sách tin tức"}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={reloadNews}
                style={{ marginLeft: "12px" }}
              >
                Thử lại
              </Button>
            </Notice>
          )}

          {!newsLoading && !newsError && newsList.length === 0 && (
            <div className="admin-state-box">
              <span>Không có tin tức nào phù hợp.</span>
              <Button variant="outline" size="sm" onClick={openCreateNews}>
                Tạo tin tức đầu tiên
              </Button>
            </div>
          )}

          {!newsLoading && !newsError && newsList.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px" }}>ID</th>
                    <th style={{ minWidth: "260px" }}>Tiêu đề</th>
                    <th style={{ width: "160px" }}>Ngày đăng</th>
                    <th style={{ width: "120px", textAlign: "center" }}>Trạng thái</th>
                    <th style={{ width: "200px", textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {newsList.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>#{item.id}</code>
                      </td>
                      <td>
                        <strong>{item.tieu_de}</strong>
                      </td>
                      <td>
                        {item.ngay_dang
                          ? new Date(item.ngay_dang).toLocaleDateString("vi-VN", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge
                          variant={item.trang_thai === "HienThi" ? "success" : "neutral"}
                        >
                          {item.trang_thai === "HienThi" ? "Hiển thị" : "Ẩn"}
                        </Badge>
                      </td>
                      <td>
                        <div className="admin-actions" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            className={`admin-btn-sm ${
                              item.trang_thai === "HienThi"
                                ? "admin-btn-sm--outline"
                                : "admin-btn-sm--success"
                            }`}
                            onClick={() => handleToggleNewsStatus(item)}
                            title={
                              item.trang_thai === "HienThi"
                                ? "Ẩn tin khỏi Public"
                                : "Hiển thị tin lên Public"
                            }
                          >
                            {item.trang_thai === "HienThi" ? "Ẩn" : "Hiện"}
                          </button>
                          <button
                            type="button"
                            className="admin-btn-sm admin-btn-sm--outline"
                            onClick={() => openEditNews(item)}
                            title="Chỉnh sửa tin tức"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="admin-btn-sm admin-btn-sm--danger"
                            onClick={() => openDeleteNews(item)}
                            title="Xóa tin tức"
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
        </>
      )}

      {/* ================================================================= */}
      {/* TAB 2: QUY TRÌNH KHÁM GIAO DIỆN */}
      {/* ================================================================= */}
      {activeTab === "procedure" && (
        <>
          <div className="admin-toolbar">
            <div className="admin-form-hint">
              Quy trình khám bệnh được hiển thị tăng dần theo số thứ tự trên Cổng thông tin người bệnh.
            </div>
            <div className="admin-form-hint">
              Tổng số: {stepsList.length} bước
            </div>
          </div>

          {/* Table / State */}
          {stepsLoading && (
            <div className="admin-state-box">
              <div className="admin-spinner" />
              <span>Đang tải quy trình khám bệnh...</span>
            </div>
          )}

          {stepsError && !stepsLoading && (
            <Notice variant="error" role="alert">
              <span>{stepsError.message || "Không thể tải quy trình khám"}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={reloadSteps}
                style={{ marginLeft: "12px" }}
              >
                Thử lại
              </Button>
            </Notice>
          )}

          {!stepsLoading && !stepsError && stepsList.length === 0 && (
            <div className="admin-state-box">
              <span>Chưa có bước khám nào trong quy trình.</span>
              <Button variant="outline" size="sm" onClick={openCreateStep}>
                Thêm bước khám đầu tiên
              </Button>
            </div>
          )}

          {!stepsLoading && !stepsError && stepsList.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "100px", textAlign: "center" }}>Thứ tự</th>
                    <th style={{ minWidth: "240px" }}>Tiêu đề bước</th>
                    <th>Mô tả chi tiết</th>
                    <th style={{ width: "140px", textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {stepsList.map((step) => (
                    <tr key={step.id}>
                      <td style={{ textAlign: "center" }}>
                        <Badge variant="progress">Bước {step.thu_tu}</Badge>
                      </td>
                      <td>
                        <strong>{step.tieu_de_buoc}</strong>
                      </td>
                      <td style={{ color: step.mo_ta ? "inherit" : "var(--text-muted)" }}>
                        {step.mo_ta || "—"}
                      </td>
                      <td>
                        <div className="admin-actions" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            className="admin-btn-sm admin-btn-sm--outline"
                            onClick={() => openEditStep(step)}
                            title="Chỉnh sửa bước khám"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="admin-btn-sm admin-btn-sm--danger"
                            onClick={() => openDeleteStep(step)}
                            title="Xóa bước khám"
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
        </>
      )}

      {/* ================================================================= */}
      {/* MODAL TIN TỨC: Thêm / Sửa */}
      {/* ================================================================= */}
      {(newsModal?.type === "create" || newsModal?.type === "edit") && (
        <div className="admin-modal-backdrop" onClick={closeNewsModal} role="presentation">
          <div
            className="admin-modal"
            style={{ maxWidth: "600px" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-news-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-news-title" className="admin-modal__title">
                {newsModal.type === "create"
                  ? "Thêm tin tức bệnh viện"
                  : `Chỉnh sửa tin tức #${newsModal.item.id}`}
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeNewsModal}
                disabled={newsSubmitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveNews}>
              <div className="admin-modal__body">
                {newsFormError && (
                  <Notice variant="error" role="alert">
                    {newsFormError}
                  </Notice>
                )}

                <div className="admin-form-group">
                  <label htmlFor="news-title" className="admin-label admin-label--required">
                    Tiêu đề tin tức
                  </label>
                  <input
                    id="news-title"
                    type="text"
                    className="admin-input"
                    value={newsForm.tieu_de}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, tieu_de: e.target.value })
                    }
                    placeholder="VD: Thông báo lịch nghỉ lễ, Hướng dẫn tiêm chủng..."
                    maxLength={TITLE_MAX}
                    autoFocus
                    required
                  />
                  <span className="admin-form-hint">Tối đa {TITLE_MAX} ký tự.</span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="news-content" className="admin-label admin-label--required">
                    Nội dung tin tức
                  </label>
                  <textarea
                    id="news-content"
                    className="admin-textarea"
                    value={newsForm.noi_dung}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, noi_dung: e.target.value })
                    }
                    placeholder="Nội dung chi tiết thông báo hoặc bài viết y tế..."
                    maxLength={CONTENT_MAX}
                    rows={6}
                    required
                  />
                  <span className="admin-form-hint">
                    Tối đa {CONTENT_MAX.toLocaleString()} ký tự.
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="admin-form-group">
                    <label htmlFor="news-status" className="admin-label admin-label--required">
                      Trạng thái hiển thị
                    </label>
                    <select
                      id="news-status"
                      className="admin-select"
                      style={{ width: "100%" }}
                      value={newsForm.trang_thai}
                      onChange={(e) =>
                        setNewsForm({ ...newsForm, trang_thai: e.target.value })
                      }
                    >
                      <option value="HienThi">Hiển thị (Public)</option>
                      <option value="An">Ẩn (Không công khai)</option>
                    </select>
                    <span className="admin-form-hint">
                      Tin Ẩn sẽ không xuất hiện ở trang Public/Bệnh nhân.
                    </span>
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="news-date" className="admin-label">
                      Ngày đăng (tùy chọn)
                    </label>
                    <input
                      id="news-date"
                      type="date"
                      className="admin-input"
                      style={{ width: "100%" }}
                      value={newsForm.ngay_dang}
                      onChange={(e) =>
                        setNewsForm({ ...newsForm, ngay_dang: e.target.value })
                      }
                    />
                    <span className="admin-form-hint">
                      Để trống hệ thống sẽ tự lấy thời điểm hiện tại.
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-modal__footer">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeNewsModal}
                  disabled={newsSubmitting}
                >
                  Hủy
                </Button>
                <Button type="submit" loading={newsSubmitting}>
                  {newsModal.type === "create" ? "Tạo tin tức" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL TIN TỨC: Xác nhận Xóa */}
      {/* ================================================================= */}
      {newsModal?.type === "delete" && (
        <div className="admin-modal-backdrop" onClick={closeNewsModal} role="presentation">
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-del-news-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-del-news-title" className="admin-modal__title">
                Xóa tin tức
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeNewsModal}
                disabled={newsSubmitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="admin-modal__body">
              {newsFormError && (
                <Notice variant="error" role="alert">
                  {newsFormError}
                </Notice>
              )}
              <p style={{ margin: "0 0 12px 0", color: "var(--text-primary)" }}>
                Bạn có chắc chắn muốn xóa tin tức sau?
              </p>
              <div
                style={{
                  background: "var(--neutral-bg)",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>{newsModal.item.tieu_de}</strong>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Mã ID: #{newsModal.item.id} — Trạng thái:{" "}
                  {newsModal.item.trang_thai === "HienThi" ? "Hiển thị" : "Ẩn"}
                </div>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--danger)",
                  margin: "12px 0 0 0",
                }}
              >
                Hành động này không thể hoàn tác.
              </p>
            </div>

            <div className="admin-modal__footer">
              <Button
                variant="outline"
                type="button"
                onClick={closeNewsModal}
                disabled={newsSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={newsSubmitting}
                onClick={handleDeleteNews}
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL BƯỚC KHÁM: Thêm / Sửa */}
      {/* ================================================================= */}
      {(stepModal?.type === "create" || stepModal?.type === "edit") && (
        <div className="admin-modal-backdrop" onClick={closeStepModal} role="presentation">
          <div
            className="admin-modal"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-step-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-step-title" className="admin-modal__title">
                {stepModal.type === "create"
                  ? "Thêm bước trong quy trình khám"
                  : `Chỉnh sửa bước #${stepModal.item.id}`}
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeStepModal}
                disabled={stepSubmitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveStep}>
              <div className="admin-modal__body">
                {stepFormError && (
                  <Notice variant="error" role="alert">
                    {stepFormError}
                  </Notice>
                )}

                <div className="admin-form-group">
                  <label htmlFor="step-order" className="admin-label admin-label--required">
                    Thứ tự bước (Số nguyên)
                  </label>
                  <input
                    id="step-order"
                    type="number"
                    min="1"
                    max={THU_TU_MAX}
                    className="admin-input"
                    style={{ width: "160px" }}
                    value={stepForm.thu_tu}
                    onChange={(e) =>
                      setStepForm({ ...stepForm, thu_tu: e.target.value })
                    }
                    placeholder="VD: 1, 2, 3..."
                    required
                  />
                  <span className="admin-form-hint">
                    Thứ tự thực hiện trong quy trình khám. Không được trùng với bước đã có.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="step-title" className="admin-label admin-label--required">
                    Tiêu đề bước khám
                  </label>
                  <input
                    id="step-title"
                    type="text"
                    className="admin-input"
                    value={stepForm.tieu_de_buoc}
                    onChange={(e) =>
                      setStepForm({ ...stepForm, tieu_de_buoc: e.target.value })
                    }
                    placeholder="VD: Đăng ký khám tại quầy lễ tân, Đo dấu hiệu sinh tồn..."
                    maxLength={TITLE_MAX}
                    autoFocus
                    required
                  />
                  <span className="admin-form-hint">Tối đa {TITLE_MAX} ký tự.</span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="step-desc" className="admin-label admin-label--required">
                    Mô tả chi tiết bước khám
                  </label>
                  <textarea
                    id="step-desc"
                    className="admin-textarea"
                    value={stepForm.mo_ta}
                    onChange={(e) =>
                      setStepForm({ ...stepForm, mo_ta: e.target.value })
                    }
                    placeholder="Hướng dẫn người bệnh chi tiết các giấy tờ cần chuẩn bị và vị trí phòng chức năng..."
                    maxLength={MO_TA_MAX}
                    rows={4}
                    required
                  />
                  <span className="admin-form-hint">Tối đa {MO_TA_MAX} ký tự.</span>
                </div>
              </div>

              <div className="admin-modal__footer">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeStepModal}
                  disabled={stepSubmitting}
                >
                  Hủy
                </Button>
                <Button type="submit" loading={stepSubmitting}>
                  {stepModal.type === "create" ? "Tạo bước khám" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL BƯỚC KHÁM: Xác nhận Xóa */}
      {/* ================================================================= */}
      {stepModal?.type === "delete" && (
        <div className="admin-modal-backdrop" onClick={closeStepModal} role="presentation">
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-del-step-title"
          >
            <div className="admin-modal__header">
              <h2 id="modal-del-step-title" className="admin-modal__title">
                Xóa bước khám
              </h2>
              <button
                type="button"
                className="admin-modal__close"
                onClick={closeStepModal}
                disabled={stepSubmitting}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="admin-modal__body">
              {stepFormError && (
                <Notice variant="error" role="alert">
                  {stepFormError}
                </Notice>
              )}
              <p style={{ margin: "0 0 12px 0", color: "var(--text-primary)" }}>
                Bạn có chắc chắn muốn xóa bước khám sau khỏi quy trình?
              </p>
              <div
                style={{
                  background: "var(--neutral-bg)",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <Badge variant="progress" style={{ marginBottom: "6px" }}>
                  Bước {stepModal.item.thu_tu}
                </Badge>
                <div>
                  <strong>{stepModal.item.tieu_de_buoc}</strong>
                </div>
                {stepModal.item.mo_ta && (
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      marginTop: "4px",
                    }}
                  >
                    {stepModal.item.mo_ta}
                  </div>
                )}
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  margin: "12px 0 0 0",
                }}
              >
                * Lưu ý: Việc xóa bước này sẽ <strong>không làm thay đổi số thứ tự</strong> của các bước còn lại trong quy trình.
              </p>
            </div>

            <div className="admin-modal__footer">
              <Button
                variant="outline"
                type="button"
                onClick={closeStepModal}
                disabled={stepSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={stepSubmitting}
                onClick={handleDeleteStep}
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
