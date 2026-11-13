const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { createLabOrder, listLabOrders } = require("../controllers/labOrder.controller");
const { getResultDoctor, downloadResultDoctor } = require("../controllers/labResult.controller");

const router = express.Router();

// C4-06: chỉ định xét nghiệm
router.post("/", authenticate, createLabOrder);
router.get("/", authenticate, listLabOrders);

// C5-03: bác sĩ chủ hồ sơ đọc kết quả xét nghiệm / mở lại file
router.get("/:id/result", authenticate, getResultDoctor);
router.get("/:id/result/file", authenticate, downloadResultDoctor);

module.exports = router;
