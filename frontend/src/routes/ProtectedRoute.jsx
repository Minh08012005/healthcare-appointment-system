import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Đang kiểm tra đăng nhập...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <p>Bạn không có quyền truy cập trang này.</p>;

  return children;
}

export default ProtectedRoute;