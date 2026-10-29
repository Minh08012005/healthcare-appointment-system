// secondsUntil = số giây từ bây giờ (giờ VN) đến giờ hẹn
// earliestMin  = số phút sớm nhất được check-in (CauHinhHeThong.checkin_som_nhat_phut, mặc định 60)
// latestMin    = số phút muộn nhất được check-in (CauHinhHeThong.checkin_toi_thieu_phut, mặc định 10)
// Đúng 60 phút -> OK, đúng 10 phút -> OK
const evaluateCheckinWindow = (secondsUntil, earliestMin, latestMin) => {
  if (secondsUntil > earliestMin * 60) return "TOO_EARLY";
  if (secondsUntil < latestMin * 60) return "TOO_LATE";
  return "OK";
};

module.exports = { evaluateCheckinWindow };