import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { queueSettingsApi } from "../../api/queueSettings";
import Button from "../../components/ui/Button";
import "./admin.css";
import "./queueSettings.css";

const FIELDS = [
  {
    name: "ti_le_online",
    label: "Tỷ lệ lượt Online",
    description: "Số lượt Online trong tỷ lệ phân bổ Online / Offline.",
  },
  {
    name: "ti_le_offline",
    label: "Tỷ lệ lượt Offline",
    description: "Số lượt Offline trong tỷ lệ phân bổ Online / Offline.",
  },
  {
    name: "checkin_som_nhat_phut",
    label: "Check-in sớm nhất (phút)",
    description: "Số phút trước giờ hẹn sớm nhất bệnh nhân được check-in.",
  },
  {
    name: "checkin_toi_thieu_phut",
    label: "Check-in tối thiểu (phút)",
    description: "Số phút trước giờ hẹn muộn nhất bệnh nhân được check-in.",
  },
  {
    name: "so_lan_goi_toi_da",
    label: "Số lần gọi tối đa",
    description: "Số lần tối đa hệ thống gọi một lượt khám.",
  },
  {
    name: "khoang_cach_goi_phut",
    label: "Khoảng cách gọi (phút)",
    description: "Thời gian chờ giữa các lần gọi lại bệnh nhân.",
  },
  {
    name: "chu_ky_quet_phut",
    label: "Chu kỳ quét (phút)",
    description: "Tần suất background job quét các lượt cần xử lý.",
  },
];

const toFormValues = (settings) =>
  Object.fromEntries(FIELDS.map(({ name }) => [name, String(settings[name])]));

function QueueSettingsPage() {
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    queueSettingsApi
      .get()
      .then((response) => {
        if (!response?.success || !response.data) {
          throw new Error("Dữ liệu cấu hình trả về không hợp lệ.");
        }
        if (active) setValues(toFormValues(response.data));
      })
      .catch((error) => {
        if (active) {
          setNotice({
            type: "error",
            text: error.message || "Không thể tải cấu hình hệ thống.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setNotice(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {};
    for (const { name } of FIELDS) {
      const value = Number(values[name]);
      if (!Number.isInteger(value) || value <= 0 || value > 2147483647) {
        setNotice({
          type: "error",
          text: "Tất cả giá trị phải là số nguyên từ 1 đến 2147483647.",
        });
        return;
      }
      payload[name] = value;
    }

    if (payload.checkin_som_nhat_phut <= payload.checkin_toi_thieu_phut) {
      setNotice({
        type: "error",
        text: "Thời gian check-in sớm nhất phải lớn hơn thời gian check-in tối thiểu.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await queueSettingsApi.update(payload);
      if (!response?.success || !response.data) {
        throw new Error("Dữ liệu cấu hình trả về không hợp lệ.");
      }
      setValues(toFormValues(response.data));
      setNotice({ type: "success", text: "Đã lưu cấu hình hệ thống." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Không thể lưu cấu hình hệ thống.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <div className="admin-header">
        <span className="admin-header__badge">Cấu hình hệ thống</span>
        <h1 className="admin-header__title">Cấu hình tham số hàng đợi</h1>
        <p className="admin-header__desc">
          Điều chỉnh các tham số dùng cho điều phối hàng đợi, check-in và gọi khám bệnh nhân.
        </p>
      </div>

      {notice && (
        <div
          className={`admin-flash admin-flash--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-state-box">
          <div className="admin-spinner" />
          <span>Đang tải cấu hình hệ thống...</span>
        </div>
      ) : values ? (
        <form className="queue-settings__form" onSubmit={handleSubmit}>
          <div className="queue-settings__fields">
            {FIELDS.map(({ name, label, description }) => (
              <div className="admin-form-group" key={name}>
                <label className="admin-label admin-label--required" htmlFor={`qs-${name}`}>
                  {label}
                </label>
                <span className="admin-form-hint" style={{ minHeight: "36px" }}>
                  {description}
                </span>
                <input
                  id={`qs-${name}`}
                  className="admin-input"
                  type="number"
                  name={name}
                  min="1"
                  max="2147483647"
                  step="1"
                  required
                  value={values[name]}
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>
          <div>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving}
            >
              Lưu cấu hình
            </Button>
          </div>
        </form>
      ) : (
        <div className="admin-state-box">
          <span>Không thể hiển thị cấu hình. Vui lòng tải lại trang.</span>
        </div>
      )}
    </div>
  );
}

export default QueueSettingsPage;
