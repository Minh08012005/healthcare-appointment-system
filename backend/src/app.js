const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Healthcare Appointment System API is running",
  });
});

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "API không tồn tại" });
});

module.exports = app;