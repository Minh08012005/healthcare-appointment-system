import { useEffect, useEffectEvent, useRef, useState } from "react";

// Camera chỉ chạy trên localhost hoặc HTTPS
const CAMERA_SUPPORTED =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function cameraErrorMessage(err) {
  if (err?.name === "NotAllowedError") {
    return "Chưa được cấp quyền camera. Cho phép camera trên trình duyệt rồi bấm Thử lại.";
  }
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
    return "Không tìm thấy camera trên máy này.";
  }
  if (err?.name === "NotReadableError") return "Camera đang được ứng dụng khác sử dụng.";
  return "Không bật được camera.";
}

function ScanIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Quét QR bằng camera. Đọc được 1 mã thì tắt camera và gọi onResult(text);
// muốn quét tiếp thì bấm "Quét mã khác".
function QrScanner({ title, hint, onResult, large = false }) {
  const videoRef = useRef(null);
  const [run, setRun] = useState(1); // tăng lên để bật lại camera
  const [status, setStatus] = useState("starting"); // starting | scanning | done | error
  const [cameraError, setCameraError] = useState("");
  const handleResult = useEffectEvent((text) => onResult(text));

  useEffect(() => {
    if (!CAMERA_SUPPORTED) return undefined;
    let controls = null;
    let finished = false;

    // Tải thư viện quét khi cần, không làm nặng các trang khác
    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (finished) return null;
        return new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result || finished) return;
            finished = true;
            ctrl.stop();
            setStatus("done");
            handleResult(result.getText());
          }
        );
      })
      .then((c) => {
        if (!c) return;
        controls = c;
        if (finished) c.stop();
        else setStatus("scanning");
      })
      .catch((err) => {
        if (finished) return;
        setStatus("error");
        setCameraError(cameraErrorMessage(err));
      });

    return () => {
      finished = true;
      controls?.stop();
    };
  }, [run]);

  const restart = () => {
    setStatus("starting");
    setCameraError("");
    setRun((n) => n + 1);
  };

  const showVideo = CAMERA_SUPPORTED && status === "scanning";

  return (
    <div className={`ci-scan${large ? " ci-scan--large" : ""}`}>
      <video
        ref={videoRef}
        className={`ci-scan__video${showVideo ? "" : " ci-scan__video--hidden"}`}
        muted
        playsInline
      />

      {showVideo ? (
        <span className="ci-scan__caption">{title}</span>
      ) : (
        <div className="ci-scan__placeholder">
          <span className="ci-scan__icon">
            <ScanIcon />
          </span>
          {!CAMERA_SUPPORTED ? (
            <p className="ci-scan__error">
              Trình duyệt không hỗ trợ camera hoặc trang không chạy trên localhost/HTTPS.
            </p>
          ) : status === "error" ? (
            <>
              <p className="ci-scan__error">{cameraError}</p>
              <button type="button" className="ci-btn ci-btn--outline ci-btn--sm" onClick={restart}>
                Thử lại
              </button>
            </>
          ) : status === "done" ? (
            <>
              <strong>Đã đọc mã QR</strong>
              <button type="button" className="ci-btn ci-btn--outline ci-btn--sm" onClick={restart}>
                Quét mã khác
              </button>
            </>
          ) : (
            <>
              <strong>{title}</strong>
              <span>{hint}</span>
              <span className="ci-scan__muted">Đang bật camera...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default QrScanner;