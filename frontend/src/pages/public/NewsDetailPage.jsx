import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { publicContentApi } from "../../api/publicContent";
import { PUBLIC_PATHS } from "./publicPaths";
import { formatPostDate } from "./publicHelpers";
import { PublicError, PublicLoading } from "./PublicState";
import BookingIcon from "../patient/booking/BookingIcons";
import "./publicContent.css";

// UC-035: chi tiết một tin. Tin không tồn tại / đã ẩn: Backend trả 404 -> hiển thị "không tìm thấy".
// Nội dung luôn render dạng văn bản thuần (React tự escape), không chèn HTML.
function NewsDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(publicContentApi.newsDetailPath(id));
  const notFound = error?.status === 404 || error?.status === 400;

  return (
    <div className="pc-page pc-page--narrow">
      <div className="pc-detail-nav">
        <Link className="pc-back-btn" to={PUBLIC_PATHS.news}>
          <BookingIcon name="arrowLeft" size={15} />
          <span>Tất cả tin tức</span>
        </Link>
      </div>

      {loading && <PublicLoading text="Đang tải nội dung tin tức..." />}

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
          <header className="pc-article__header">
            <div className="pc-article__meta">
              <span className="pc-news-card__tag">Tin tức y tế</span>
              <span className="pc-article__date">
                <BookingIcon name="clock" size={13} />
                <span>Ngày đăng: {formatPostDate(data.ngay_dang)}</span>
              </span>
            </div>
            <h1 className="pc-article__title">{data.tieu_de}</h1>
            <div className="pc-article__divider" />
          </header>

          <div className="pc-article__body">{data.noi_dung}</div>

          <footer className="pc-article__footer">
            <div className="pc-article__hospital-tag">
              <strong>Bệnh viện Đa khoa Quốc tế MEDICARE</strong>
              <p>Mọi thắc mắc và nhu cầu tư vấn xin vui lòng liên hệ quầy tiếp đón hoặc tổng đài hỗ trợ.</p>
            </div>
            <Link className="pc-btn pc-btn--outline" to={PUBLIC_PATHS.news}>
              <BookingIcon name="arrowLeft" size={14} />
              <span>Quay lại trang tin tức</span>
            </Link>
          </footer>
        </article>
      )}
    </div>
  );
}

export default NewsDetailPage;
