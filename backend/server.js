const app = require("./src/app");
const { batDauJobCheckin } = require("./src/jobs/checkinBackground.job");

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
  if (!(process.env.JWT_SECRET || "").trim()) {
    console.error("CẢNH BÁO: Thiếu JWT_SECRET trong backend/.env, Login sẽ không hoạt động");
  }
  // Job nền C3-03: mặc định TẮT để server local của mọi người không tự sửa DB chung
  if (process.env.ENABLE_C3_BACKGROUND === "true") {
    batDauJobCheckin();
  } else {
    console.log("C3-03 job nền: TẮT (đặt ENABLE_C3_BACKGROUND=true trong .env để bật)");
  }
});