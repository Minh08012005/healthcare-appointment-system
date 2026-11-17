import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { publicContentApi } from "../../api/publicContent";
import { PUBLIC_PATHS } from "./publicPaths";
import { formatPostDate } from "./publicHelpers";
import { PublicEmpty, PublicError, PublicLoading } from "./PublicState";
import "./publicContent.css";

// UC-035: danh sách tin tức bệnh viện (công khai). Chỉ hiển thị dữ liệu Backend trả về (tin "Hiển thị").
function NewsListPage() {
  const { data, loading, error, reload } = useFetch(publicContentApi.newsPath());
  const items = Array.isArray(data) ? data : [];

  return (
    <div className="pc-page">
      <header className="pc-head">
        <span className="pc-kicker">THÔNG TIN Y TẾ</span>
        <h1 className="pc-page-title">Tin tức bệnh viện</h1>
        <p className="pc-page-desc">
          Cập nhật thông tin hoạt động, hướng dẫn khám chữa bệnh và thông báo y tế mới nhất từ MEDICARE.
        </p>
      </header>

      {loading && <PublicLoading text="Đang tải danh sách tin tức..." />}
      {!loading && error && <PublicError error={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <PublicEmpty
          title="Chưa có tin tức nào"
          description="Hiện tại bệnh viện chưa đăng tải bài viết mới. Vui lòng quay lại sau."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="pc-news-grid">
          {items.map((n) => (
            <li key={n.id} className="pc-news-item">
              <Link className="pc-news-card" to={PUBLIC_PATHS.newsDetail(n.id)}>
                <div className="pc-news-card__top">
                  <span className="pc-news-card__tag">Tin tức</span>
                  <span className="pc-news-card__date">{formatPostDate(n.ngay_dang)}</span>
                </div>
                <h2 className="pc-news-card__title">{n.tieu_de}</h2>
                <div className="pc-news-card__footer">
                  <span className="pc-news-card__cta">Đọc tiếp →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NewsListPage;
