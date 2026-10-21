import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div>
      <h1>404 - Không tìm thấy trang</h1>
      <Link to="/login">Quay về trang đăng nhập</Link>
    </div>
  );
}

export default NotFoundPage;