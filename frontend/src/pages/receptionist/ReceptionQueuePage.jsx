import { useEffect, useState } from "react";
import { receptionApi } from "../../api/reception";
import "./queue/queue.css";

const STATUS_LABELS = {
  CHO_KHAM: "Chờ khám",
  DANG_GOI: "Đang gọi",
  DANG_KHAM: "Đang khám",
  BO_LUOT: "Bỏ lượt",
};

const STATUS_CLASSES = {
  CHO_KHAM: "rq-status--cho_kham",
  DANG_GOI: "rq-status--dang_goi",
  DANG_KHAM: "rq-status--dang_kham",
  BO_LUOT: "rq-status--bo_luot",
};

function formatCheckinTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function ReceptionQueuePage() {
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [queueData, setQueueData] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [retryRooms, setRetryRooms] = useState(0);
  const [retryQueue, setRetryQueue] = useState(0);
  const [requeueingId, setRequeueingId] = useState(null);
  const [requeueError, setRequeueError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    receptionApi
      .getRooms()
      .then((response) => {
        if (!cancelled) setRooms(response?.data || []);
      })
      .catch((error) => {
        if (!cancelled) setRoomsError(error);
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryRooms]);

  useEffect(() => {
    if (!selectedRoomId) return undefined;
    let cancelled = false;
    receptionApi
      .getQueue(selectedRoomId)
      .then((response) => {
        if (!cancelled) setQueueData(response?.data || null);
      })
      .catch((error) => {
        if (!cancelled) setQueueError(error);
      })
      .finally(() => {
        if (!cancelled) setQueueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoomId, retryQueue]);

  const handleRoomChange = (event) => {
    setSelectedRoomId(event.target.value);
    setQueueData(null);
    setQueueError(null);
    setRequeueError(null);
    setQueueLoading(Boolean(event.target.value));
  };

  const retryRoomLoad = () => {
    setRoomsError(null);
    setRoomsLoading(true);
    setRetryRooms((value) => value + 1);
  };

  const retryQueueLoad = () => {
    setQueueData(null);
    setQueueError(null);
    setQueueLoading(true);
    setRetryQueue((value) => value + 1);
  };

  const handleRequeue = async (queueId) => {
    setRequeueingId(queueId);
    setRequeueError(null);
    try {
      await receptionApi.requeue(queueId);
      setQueueLoading(true);
      setRetryQueue((value) => value + 1);
    } catch (error) {
      setRequeueError(error.message || "Không thể xếp lại hàng cho bệnh nhân.");
    } finally {
      setRequeueingId(null);
    }
  };

  const statusText = (status) =>
    Object.hasOwn(STATUS_LABELS, status)
      ? STATUS_LABELS[status]
      : typeof status === "string" && status
        ? status
        : "Không rõ";

  const statusClass = (status) =>
    STATUS_CLASSES[status] || "rq-status--default";

  return (
    <div className="rq-page">
      <header className="rq-header">
        <div className="rq-header__main">
          <h1 className="rq-header__title">Hàng đợi tiếp đón & điều phối</h1>
          <p className="rq-header__sub">
            Theo dõi danh sách bệnh nhân chờ khám và xử lý xếp lại hàng hôm nay
          </p>
        </div>
      </header>

      <section className="rq-toolbar">
        <div className="rq-room-select-wrap">
          <label className="rq-label" htmlFor="rq-room">
            Phòng khám
          </label>
          {roomsError ? (
            <div className="rq-inline-error" role="alert">
              <span>{roomsError.message || "Không tải được danh sách phòng khám."}</span>
              <button type="button" className="rq-btn-retry" onClick={retryRoomLoad}>
                Thử lại
              </button>
            </div>
          ) : (
            <select
              id="rq-room"
              className="rq-select"
              value={selectedRoomId}
              onChange={handleRoomChange}
              disabled={roomsLoading}
            >
              <option value="">
                {roomsLoading ? "Đang tải phòng khám..." : "— Chọn phòng khám —"}
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.ten_phong}
                  {room.ten_chuyen_khoa ? ` · ${room.ten_chuyen_khoa}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {queueData?.room && (
          <div className="rq-room-meta">
            <span className="rq-room-badge">
              {queueData.room.ten_phong}
              {queueData.room.ten_chuyen_khoa && ` · ${queueData.room.ten_chuyen_khoa}`}
            </span>
            {queueData.ngay && <span className="rq-date-badge">Ngày {queueData.ngay}</span>}
            <span className="rq-count-badge">
              {queueData.summary?.tong ?? queueData.queue?.length ?? 0} bệnh nhân
            </span>
          </div>
        )}
      </section>

      {!selectedRoomId && !roomsLoading && !roomsError && (
        <div className="rq-state rq-state--card" role="status">
          {rooms.length
            ? "Vui lòng chọn phòng khám để xem hàng đợi."
            : "Hiện chưa có phòng khám để lựa chọn."}
        </div>
      )}

      {selectedRoomId && queueLoading && (
        <div className="rq-state rq-state--card" role="status">
          <span className="rq-spinner" aria-hidden="true" />
          Đang tải hàng đợi...
        </div>
      )}

      {selectedRoomId && queueError && (
        <div className="rq-state rq-state--card rq-state--error" role="alert">
          <p>{queueError.message || "Không tải được hàng đợi."}</p>
          <button type="button" className="rq-btn-primary" onClick={retryQueueLoad}>
            Thử lại
          </button>
        </div>
      )}

      {selectedRoomId && !queueLoading && !queueError && queueData && (
        <section className="rq-card">
          <div className="rq-list-header">
            <div>
              <h2 className="rq-list-title">{queueData.room?.ten_phong || "Hàng đợi"}</h2>
              <p className="rq-list-sub">
                {queueData.room?.ten_chuyen_khoa || ""}
                {queueData.ngay ? ` · ${queueData.ngay}` : ""}
              </p>
            </div>
            <span className="rq-count">
              {queueData.summary?.tong ?? queueData.queue?.length ?? 0} bệnh nhân
            </span>
          </div>

          {requeueError && (
            <div className="rq-action-error" role="alert">
              <strong>Lỗi xếp lại hàng:</strong> {requeueError}
            </div>
          )}

          {queueData.queue?.length ? (
            <div className="rq-table-wrap">
              <table className="rq-table">
                <thead>
                  <tr>
                    <th scope="col">STT</th>
                    <th scope="col">Bệnh nhân</th>
                    <th scope="col">Hình thức</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Phòng</th>
                    <th scope="col">Bác sĩ</th>
                    <th scope="col">Check-in</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.queue.map((item) => (
                    <tr key={item.id}>
                      <td className="rq-col-stt">
                        <span className="rq-number">{item.stt_hien_thi || "—"}</span>
                      </td>
                      <td className="rq-col-patient">
                        <span className="rq-patient">{item.patient?.ho_ten || "—"}</span>
                      </td>
                      <td className="rq-col-lane">
                        <span
                          className={`rq-badge ${
                            item.loai === "ONLINE"
                              ? "rq-badge--online"
                              : item.loai === "OFFLINE"
                                ? "rq-badge--offline"
                                : "rq-badge--default"
                          }`}
                        >
                          {item.loai === "ONLINE"
                            ? "ONLINE"
                            : item.loai === "OFFLINE"
                              ? "OFFLINE"
                              : item.loai || "—"}
                        </span>
                      </td>
                      <td className="rq-col-status">
                        <span className={`rq-status ${statusClass(item.trang_thai)}`}>
                          <span className="rq-status-dot" aria-hidden="true" />
                          {statusText(item.trang_thai)}
                        </span>
                      </td>
                      <td className="rq-col-room">{queueData.room?.ten_phong || "—"}</td>
                      <td className="rq-col-doctor">
                        {item.doctor?.ho_ten ? `BS. ${item.doctor.ho_ten}` : "—"}
                      </td>
                      <td className="rq-col-time">{formatCheckinTime(item.thoi_gian_check_in)}</td>
                      <td className="rq-col-action">
                        {item.trang_thai === "BO_LUOT" && (
                          <button
                            type="button"
                            className="rq-btn-requeue"
                            onClick={() => handleRequeue(item.id)}
                            disabled={requeueingId !== null}
                          >
                            {requeueingId === item.id ? "Đang xếp lại..." : "Xếp lại hàng"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rq-state rq-state--empty">
              Phòng khám chưa có bệnh nhân trong hàng đợi hôm nay.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ReceptionQueuePage;
