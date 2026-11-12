const express = require("express");
const { listOrders, getOrder, startProcessing } = require("../controllers/labRoom.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/orders", authenticate, listOrders);
router.get("/orders/:id", authenticate, getOrder);
router.post("/orders/:id/start", authenticate, startProcessing);

module.exports = router;