// QR trên CCCD gắn chip:
// "Số CCCD|Số CMND cũ|Họ tên|ddmmyyyy (ngày sinh)|Giới tính|Địa chỉ|ddmmyyyy (ngày cấp)"
// Chỉ tách chuỗi để điền form, không có nghiệp vụ.
export function parseCccdQr(text) {
  const parts = String(text || "").trim().split("|").map((p) => p.trim());
  if (parts.length < 6) return null;

  const [soCccd, , hoTen, ngaySinh, gioiTinh, diaChi] = parts;
  if (!/^\d{12}$/.test(soCccd) || !hoTen) return null;

  return {
    ho_ten: hoTen,
    so_cccd: soCccd,
    ngay_sinh: /^\d{8}$/.test(ngaySinh)
      ? `${ngaySinh.slice(0, 2)}/${ngaySinh.slice(2, 4)}/${ngaySinh.slice(4)}`
      : "",
    gioi_tinh: gioiTinh === "Nam" || gioiTinh === "Nữ" ? gioiTinh : "",
    dia_chi: diaChi,
  };
}

// "12/05/1985" -> "1985-05-12"; sai định dạng, ngày không có thật hoặc ở tương lai -> null
export function toIsoDate(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const valid =
    d.getFullYear() === Number(yyyy) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
  if (!valid || d > new Date()) return null;
  return `${yyyy}-${mm}-${dd}`;
}