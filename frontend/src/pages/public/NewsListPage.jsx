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
        <span className="pc-kicker">TIN TỨC</span>
        <h1>Tin tức bệnh viện</h1>
        <p>Thông tin và thông báo mới nhất từ MEDICARE.</p>
      </header>

      {loading && <PublicLoading text="Đang tải tin tức..." />}
      {!loading && error && <PublicError error={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <PublicEmpty title="Chưa có tin tức nào" text="Vui lòng quay lại sau." />
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="pc-news-list">
          {items.map((n) => (
            <li key={n.id}>
              <Link className="pc-news-card" to={PUBLIC_PATHS.newsDetail(n.id)}>
                <span className="pc-news-card__date">{formatPostDate(n.ngay_dang)}</span>
                <h2 className="pc-news-card__title">{n.tieu_de}</h2>
                <span className="pc-news-card__cta">Xem chi tiết →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NewsListPage;
