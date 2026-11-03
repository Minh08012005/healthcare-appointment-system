const app = require("./src/app");
const { batDauJobCheckin } = require("./src/jobs/checkinBackground.job");

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
  if (!(process.env.JWT_SECRET || "").trim()) {
    console.error("CẢNH BÁO: Thiếu JWT_SECRET trong backend/.env, Login sẽ không hoạt động");
  }
  // Giữ tùy chọn bật job rõ ràng để local/dev không tự sửa DB dùng chung.
  if (process.env.ENABLE_C3_BACKGROUND === "true") {
    console.log(`[C3-03/C3-09] Background jobs: BẬT${process.env.C3_JOB_DRY_RUN === "true" ? " (DRY-RUN, không ghi DB)" : ""}`);
    batDauJobCheckin();
  } else {
    console.warn("[C3-03/C3-09] Background jobs: TẮT; auto-recall C3-09 sẽ không chạy. Đặt ENABLE_C3_BACKGROUND=true để bật.");
  }
});
