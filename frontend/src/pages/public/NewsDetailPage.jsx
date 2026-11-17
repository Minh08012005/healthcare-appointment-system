import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { publicContentApi } from "../../api/publicContent";
import { PUBLIC_PATHS } from "./publicPaths";
import { formatPostDate } from "./publicHelpers";
import { PublicError, PublicLoading } from "./PublicState";
import "./publicContent.css";

// UC-035: chi tiết một tin. Tin không tồn tại / đã ẩn: Backend trả 404 -> hiển thị "không tìm thấy".
// Nội dung luôn render dạng văn bản thuần (React tự escape), không chèn HTML.
function NewsDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(publicContentApi.newsDetailPath(id));
  const notFound = error?.status === 404 || error?.status === 400;

  return (
    <div className="pc-page pc-page--narrow">
      <Link className="pc-back" to={PUBLIC_PATHS.news}>
        ← Tất cả tin tức
      </Link>

      {loading && <PublicLoading text="Đang tải tin tức..." />}

      {!loading && notFound && (
        <div className="pc-state" role="alert">
          <h2>Không tìm thấy tin tức</h2>
          <p>Tin này không tồn tại hoặc không còn được hiển thị.</p>
          <Link className="pc-btn pc-btn--outline" to={PUBLIC_PATHS.news}>
            Về danh sách tin tức
          </Link>
        </div>
      )}

      {!loading && error && !notFound && <PublicError error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <article className="pc-article">
          <span className="pc-news-card__date">{formatPostDate(data.ngay_dang)}</span>
          <h1>{data.tieu_de}</h1>
          <div className="pc-article__body">{data.noi_dung}</div>
        </article>
      )}
    </div>
  );
}

export default NewsDetailPage;
