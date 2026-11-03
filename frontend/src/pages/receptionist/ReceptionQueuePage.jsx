import { useEffect, useState } from "react";
import { receptionApi } from "../../api/reception";
import "./queue/queue.css";

const STATUS_LABELS = {
  CHO_KHAM: "Chờ khám",
  DANG_GOI: "Đang gọi",
  DANG_KHAM: "Đang khám",
  BO_LUOT: "Bỏ lượt",
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

  return (
    <div className="rq-page">
      <header className="rq-header">
        <div>
          <h1>Hàng đợi lễ tân</h1>
          <p className="rq-description">
            Chọn phòng khám để xem danh sách bệnh nhân đang chờ hôm nay.
          </p>
        </div>
      </header>
      <section className="rq-card rq-room-picker">
        <label className="rq-label" htmlFor="rq-room">
          Phòng khám
        </label>
        {roomsError ? (
          <div className="rq-state rq-state--error" role="alert">
            <p>
              {roomsError.message || "Không tải được danh sách phòng khám."}
            </p>
            <button type="button" className="rq-button" onClick={retryRoomLoad}>
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
      </section>

      {!selectedRoomId && !roomsLoading && !roomsError && (
        <div className="rq-state" role="status">
          {rooms.length
            ? "Vui lòng chọn phòng khám để xem hàng đợi."
            : "Hiện chưa có phòng khám để lựa chọn."}
        </div>
      )}
      {selectedRoomId && queueLoading && (
        <div className="rq-state" role="status">
          <span className="rq-spinner" aria-hidden="true" />
          Đang tải hàng đợi...
        </div>
      )}
      {selectedRoomId && queueError && (
        <div className="rq-state rq-state--error" role="alert">
          <p>{queueError.message || "Không tải được hàng đợi."}</p>
          <button type="button" className="rq-button" onClick={retryQueueLoad}>
            Thử lại
          </button>
        </div>
      )}
      {selectedRoomId && !queueLoading && !queueError && queueData && (
        <section className="rq-card">
          <div className="rq-list-header">
            <div>
              <h2>{queueData.room?.ten_phong || "Hàng đợi"}</h2>
              <p>
                {queueData.room?.ten_chuyen_khoa || ""}
                {queueData.ngay ? ` · ${queueData.ngay}` : ""}
              </p>
            </div>
            <span className="rq-count">
              {queueData.summary?.tong ?? queueData.queue?.length ?? 0} bệnh
              nhân
            </span>
          </div>
          {requeueError && (
            <div className="rq-action-error" role="alert">
              {requeueError}
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
                      <td className="rq-number">{item.stt_hien_thi || "—"}</td>
                      <td className="rq-patient">
                        {item.patient?.ho_ten || "—"}
                      </td>
                      <td>
                        <span
                          className={`rq-badge ${item.loai === "ONLINE" ? "rq-badge--online" : "rq-badge--offline"}`}
                        >
                          {item.loai === "ONLINE"
                            ? "ONLINE"
                            : item.loai === "OFFLINE"
                              ? "OFFLINE"
                              : item.loai || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="rq-status">
                          {Object.hasOwn(STATUS_LABELS, item.trang_thai)
                            ? STATUS_LABELS[item.trang_thai]
                            : typeof item.trang_thai === "string" &&
                                item.trang_thai
                              ? item.trang_thai
                              : "Không rõ"}
                        </span>
                      </td>
                      <td>{queueData.room?.ten_phong || "—"}</td>
                      <td>
                        {item.doctor?.ho_ten
                          ? `BS. ${item.doctor.ho_ten}`
                          : "—"}
                      </td>
                      <td>{formatCheckinTime(item.thoi_gian_check_in)}</td>
                      <td>
                        {item.trang_thai === "BO_LUOT" && (
                          <button
                            type="button"
                            className="rq-button rq-button--small"
                            onClick={() => handleRequeue(item.id)}
                            disabled={requeueingId !== null}
                          >
                            {requeueingId === item.id
                              ? "Đang xếp lại..."
                              : "Xếp lại hàng"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rq-state">
              Phòng khám chưa có bệnh nhân trong hàng đợi hôm nay.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ReceptionQueuePage;
