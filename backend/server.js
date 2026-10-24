const app = require("./src/app");

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
  if (!(process.env.JWT_SECRET || "").trim()) {
    console.error("CẢNH BÁO: Thiếu JWT_SECRET trong backend/.env, Login sẽ không hoạt động");
  }
});