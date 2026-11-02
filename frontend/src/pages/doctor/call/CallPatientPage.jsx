import { useEffect, useRef, useState } from "react";
import { doctorQueueApi } from "../../../api/doctorQueue";
import "./callPatient.css";

const STATUS_LABELS = {
  CHO_KHAM: "Chờ khám",
  DANG_GOI: "Đang gọi",
  DANG_KHAM: "Đang khám",
  BO_LUOT: "Bỏ lượt",
  VANG_MAT: "Vắng mặt",
  DA_XONG: "Đã xong",
};

const LANE_LABELS = { ONLINE: "A · Online", OFFLINE: "B · Offline" };

// "08:45:00" -> "08:45"; Offline không có giờ hẹn -> "—"
const formatTime = (value) =>
  typeof value === "string" && value.length >= 5 ? value.slice(0, 5) : "—";

// Chỉ hiện dữ liệu backend trả về: có tên phòng thì hiện tên, chỉ có id thì "Phòng #id"
const roomText = (room) => {
  if (room?.ten_phong) return room.ten_phong;
  if (room?.id != null) return `Phòng #${room.id}`;
  return "";
};

const statusText = (value) =>
  STATUS_LABELS[value] || (typeof value === "string" && value) || "—";

function CallPatientPage() {
  // current = { queue, patient, appointment, room } của bệnh nhân DANG_GOI
  const [current, setCurrent] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState(null); // "next" | "recall" | "skip" | "start"
  const [notice, setNotice] = useState(null); // { type, title, text } — mỗi lúc 1 thông báo
  const busyRef = useRef(false); // chặn double-click trước khi state kịp render

  const applyCurrent = (data) => {
    setCurrent(data?.has_calling && data.queue ? data : null);
    if (data?.room) setRoom(data.room);
  };

  // Vào trang / F5: đọc bệnh nhân đang gọi bằng API read-only, KHÔNG gọi POST /next
  useEffect(() => {
    let cancelled = false;
    doctorQueueApi
      .getCurrent()
      .then((res) => {
        if (!cancelled) applyCurrent(res?.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const runAction = async (name, action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(name);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice({
        type: "error",
        title: "Không thực hiện được",
        text: err?.message || "Đã có lỗi xảy ra, vui lòng thử lại.",
      });
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const handleNext = () =>
    runAction("next", async () => {
      try {
        const res = await doctorQueueApi.callNext();
        const data = res?.data;
        if (data?.called && data.queue) {
          setCurrent(data);
          if (data.room) setRoom(data.room);
          return;
        }
        setCurrent(null);
        if (data?.room_id != null) {
          setRoom((prev) => (prev?.id === data.room_id ? prev : { id: data.room_id }));
        }
        setNotice({
          type: "info",
          title: "Hàng đợi trống",
          text: data?.message || "Hiện không có bệnh nhân chờ khám.",
        });
      } catch (err) {
        if (err?.status !== 409 || err?.code !== "ALREADY_CALLING") throw err;
        // Đang có bệnh nhân DANG_GOI (vd: mở ở tab khác) -> đồng bộ lại bằng API read-only
        const res = await doctorQueueApi.getCurrent();
        applyCurrent(res?.data);
        setNotice({
          type: "warning",
          title: "Đang có bệnh nhân được gọi",
          text: err.message,
        });
      }
    });

  const handleRecall = () =>
    runAction("recall", async () => {
      try {
        const res = await doctorQueueApi.recall();
        const q = res?.data?.queue;
        if (q) {
          setCurrent((prev) =>
            prev?.queue?.id === q.id
              ? { ...prev, queue: { ...prev.queue, so_lan_goi: q.so_lan_goi } }
              : prev,
          );
        }
        setNotice({ type: "success", title: "Đã gọi lại", text: res?.message || "" });
      } catch (err) {
        if (err?.code !== "MAX_CALLS_REACHED") throw err;
        setNotice({ type: "warning", title: "Bệnh nhân chưa có mặt", text: err.message });
      }
    });

  const handleSkip = () => {
    const queue = current?.queue;
    if (busyRef.current || !queue?.id) return;
    if (!window.confirm(`Xác nhận bệnh nhân ${queue.nhan_stt || ""} vắng mặt?`)) return;
    runAction("skip", async () => {
      const res = await doctorQueueApi.skip(queue.id);
      setCurrent(null);
      setNotice({
        type: "info",
        title: `${queue.nhan_stt || "Bệnh nhân"}: ${statusText(res?.data?.trang_thai)}`,
        text: res?.message || "",
      });
    });
  };

  const handleStart = () => {
    const queue = current?.queue;
    const name = current?.patient?.ho_ten;
    if (!queue?.id) return;
    runAction("start", async () => {
      await doctorQueueApi.start(queue.id);
      setCurrent(null);
      setNotice({
        type: "success",
        title: "Đã bắt đầu khám",
        text: [queue.nhan_stt, name].filter(Boolean).join(" – "),
      });
    });
  };

  const busy = pending !== null;
  const queue = current?.queue;
  const roomLabel = roomText(current?.room || room);

  return (
    <div className="cp-page">
      <div className="cp-toolbar">
        <p className="cp-room">{roomLabel}</p>
        <button
          type="button"
          className="cp-btn cp-btn--primary"
          onClick={handleNext}
          disabled={busy || loading}
        >
          {pending === "next" ? "Đang gọi..." : "Bệnh nhân tiếp theo"}
        </button>
      </div>

      {notice && (
        <div
          className={`cp-notice cp-notice--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <strong>{notice.title}</strong>
          {notice.text && <p>{notice.text}</p>}
        </div>
      )}

      {loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải bệnh nhân đang gọi...
        </div>
      )}

      {!loading && loadError && (
        <div className="cp-state cp-state--error" role="alert">
          <p>{loadError.message || "Không tải được bệnh nhân đang gọi."}</p>
          <button type="button" className="cp-btn cp-btn--primary" onClick={retryLoad}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && queue && (
        <section className="cp-card">
          <div className="cp-card__head">
            <h2>Bệnh nhân đang gọi</h2>
            <span className="cp-pill cp-pill--calling">{statusText(queue.trang_thai)}</span>
          </div>

          <div className="cp-card__body">
            <div className="cp-stt">
              <span>Số thứ tự</span>
              <strong>{queue.nhan_stt || "—"}</strong>
            </div>
            <div className="cp-info">
              <h3>{current.patient?.ho_ten || "—"}</h3>
              <dl>
                <dt>Loại hàng đợi</dt>
                <dd>
                  <span
                    className={`cp-pill cp-pill--${queue.loai === "OFFLINE" ? "offline" : "online"}`}
                  >
                    {LANE_LABELS[queue.loai] || queue.loai || "—"}
                  </span>
                </dd>
                <dt>Giờ hẹn</dt>
                <dd>{formatTime(current.appointment?.gio_kham)}</dd>
                <dt>Lần gọi</dt>
                <dd>{queue.so_lan_goi ?? "—"}</dd>
              </dl>
            </div>
          </div>

          <div className="cp-card__actions">
            <button
              type="button"
              className="cp-btn cp-btn--primary"
              onClick={handleStart}
              disabled={busy}
            >
              {pending === "start" ? "Đang xử lý..." : "Bắt đầu khám"}
            </button>
            <div className="cp-card__actions-right">
              <button
                type="button"
                className="cp-btn cp-btn--outline"
                onClick={handleRecall}
                disabled={busy}
              >
                {pending === "recall" ? "Đang gọi lại..." : "Gọi lại"}
              </button>
              <button
                type="button"
                className="cp-btn cp-btn--danger"
                onClick={handleSkip}
                disabled={busy}
              >
                {pending === "skip" ? "Đang xử lý..." : "Vắng mặt"}
              </button>
            </div>
          </div>
        </section>
      )}

      {!loading && !loadError && !queue && !notice && (
        <div className="cp-state">
          Chưa có bệnh nhân đang gọi. Bấm “Bệnh nhân tiếp theo” để gọi.
        </div>
      )}
    </div>
  );
}

export default CallPatientPage;