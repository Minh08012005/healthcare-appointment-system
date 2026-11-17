import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { publicContentApi } from "../../api/publicContent";
import { BOOKING_PATHS } from "../patient/booking/bookingPaths";
import { PublicEmpty, PublicError, PublicLoading } from "./PublicState";
import "./publicContent.css";

// UC-036: quy trình khám bệnh (công khai). Số bước và nội dung lấy hoàn toàn từ Backend (Admin C6-09),
// đã sắp xếp theo thu_tu tăng dần. Số hiển thị là vị trí trong danh sách nên không bị nhảy số khi Admin xóa bước.
function ProcedurePage() {
  const { data, loading, error, reload } = useFetch(publicContentApi.procedurePath());
  const steps = Array.isArray(data) ? data : [];

  return (
    <div className="pc-page pc-page--narrow">
      <header className="pc-head">
        <span className="pc-kicker">HƯỚNG DẪN</span>
        <h1>Quy trình khám bệnh</h1>
        <p>Các bước bạn cần thực hiện khi đến khám tại MEDICARE.</p>
      </header>

      {loading && <PublicLoading text="Đang tải quy trình khám..." />}
      {!loading && error && <PublicError error={error} onRetry={reload} />}
      {!loading && !error && steps.length === 0 && (
        <PublicEmpty
          title="Quy trình khám bệnh đang được cập nhật"
          text="Vui lòng quay lại sau hoặc liên hệ quầy tiếp đón để được hướng dẫn."
        />
      )}

      {!loading && !error && steps.length > 0 && (
        <ol className="pc-steps">
          {steps.map((s, index) => (
            <li key={s.id} className="pc-step">
              <span className="pc-step__num" aria-hidden="true">
                {index + 1}
              </span>
              <div className="pc-step__body">
                <h2>
                  <span className="pc-sr-only">Bước {index + 1}: </span>
                  {s.tieu_de_buoc}
                </h2>
                {s.mo_ta && <p>{s.mo_ta}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="pc-cta">
        <Link className="pc-btn pc-btn--primary" to={BOOKING_PATHS.specialty}>
          Đặt lịch khám
        </Link>
      </div>
    </div>
  );
}

export default ProcedurePage;
