import { Link } from "react-router-dom";
import "./admin.css";

function AdminPlaceholderPage({ title, taskCode, description }) {
  return (
    <div className="admin-placeholder">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>
      <div className="admin-placeholder-card">
        <div className="admin-module-card__header">
          {taskCode && <span className="admin-module-card__tag">{taskCode}</span>}
        </div>
        <h1 className="admin-header__title">{title}</h1>
        {description && <p className="admin-header__desc">{description}</p>}

        <div className="admin-placeholder__status">
          <span aria-hidden="true">ℹ️</span>
          <span>Chức năng này đang được triển khai trong Chặng 6.</span>
        </div>

        <div className="admin-placeholder__hint">
          <strong>Ghi chú dành cho developer:</strong> Route này đã được đăng ký và bảo vệ quyền <code>Quản trị viên</code>. Bạn có thể thay thế component này trong <code>src/routes/AppRoutes.jsx</code> bằng page hoàn chỉnh của task.
        </div>

        <Link to="/admin" className="admin-btn">
          Về Dashboard
        </Link>
      </div>
    </div>
  );
}

export default AdminPlaceholderPage;

