const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { chiLeTan, offlineCheckIn } = require("../controllers/receptionOffline.controller");

const router = express.Router();

// C3-04 — UC-012: tiếp nhận bệnh nhân Offline
router.post("/offline-checkin", authenticate, chiLeTan, offlineCheckIn);

module.exports = router;
