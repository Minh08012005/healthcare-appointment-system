const express = require("express");
const {
  listNews,
  getNewsDetail,
  listProcedureSteps,
} = require("../controllers/publicContent.controller");

const router = express.Router();

// C6-10 — CÔNG KHAI: cố ý KHÔNG dùng authenticate (UC-035, UC-036 không yêu cầu đăng nhập)
router.get("/news", listNews);
router.get("/news/:id", getNewsDetail);
router.get("/procedure-steps", listProcedureSteps);

module.exports = router;
