import { useEffect, useState } from "react";
import { queueSettingsApi } from "../../api/queueSettings";
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
    <section className="queue-settings">
      <header className="queue-settings__header">
        <div>
          <h1>Cấu hình hàng đợi</h1>
          <p>Điều chỉnh các tham số dùng cho hàng đợi, check-in và gọi bệnh nhân.</p>
        </div>
      </header>

      {notice && (
        <div
          className={`queue-settings__notice queue-settings__notice--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <p role="status">Đang tải cấu hình...</p>
      ) : values ? (
        <form className="queue-settings__form" onSubmit={handleSubmit}>
          <div className="queue-settings__fields">
            {FIELDS.map(({ name, label, description }) => (
              <label className="queue-settings__field" key={name}>
                <span className="queue-settings__label">{label}</span>
                <span className="queue-settings__description">{description}</span>
                <input
                  type="number"
                  name={name}
                  min="1"
                  max="2147483647"
                  step="1"
                  required
                  value={values[name]}
                  onChange={handleChange}
                />
              </label>
            ))}
          </div>
          <button
            className="queue-settings__save"
            type="submit"
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </form>
      ) : (
        <p>Không thể hiển thị cấu hình. Vui lòng tải lại trang.</p>
      )}
    </section>
  );
}

export default QueueSettingsPage;
