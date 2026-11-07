const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { createLabOrder, listLabOrders } = require("../controllers/labOrder.controller");

const router = express.Router();

// C4-06: chỉ định xét nghiệm
router.post("/", authenticate, createLabOrder);
router.get("/", authenticate, listLabOrders);

module.exports = router;
