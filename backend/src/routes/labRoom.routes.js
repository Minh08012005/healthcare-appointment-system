const express = require("express");
const { listOrders, getOrder, startProcessing } = require("../controllers/labRoom.controller");
const {
  submitResult,
  getResultStaff,
  downloadResultStaff,
} = require("../controllers/labResult.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { requireLabStaff, parseResultUpload } = require("../middlewares/labResultUpload.middleware");

const router = express.Router();

router.get("/orders", authenticate, listOrders);
router.get("/orders/:id", authenticate, getOrder);
router.post("/orders/:id/start", authenticate, startProcessing);

// C5-03: nộp kết quả (multipart: file, mo_ta) + đọc lại kết quả / file
router.post("/orders/:id/result", authenticate, requireLabStaff, parseResultUpload, submitResult);
router.get("/orders/:id/result", authenticate, getResultStaff);
router.get("/orders/:id/result/file", authenticate, downloadResultStaff);

module.exports = router;