const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { chiLeTan, offlineCheckIn } = require("../controllers/receptionOffline.controller");
const { getReceptionQueue } = require("../controllers/receptionQueue.controller");
const { requeuePatient } = require("../controllers/callNext.controller");

const router = express.Router();

// C3-04 — UC-012: tiếp nhận bệnh nhân Offline
router.post("/offline-checkin", authenticate, chiLeTan, offlineCheckIn);

// C3-06: Lễ tân xem hàng đợi theo phòng
router.get("/queue", authenticate, chiLeTan, getReceptionQueue);

// C3-09 / UC-016: Lễ tân xếp lại bệnh nhân BO_LUOT lần 1 xuống cuối hàng OFFLINE
router.post("/queue/:id/requeue", authenticate, chiLeTan, requeuePatient);

module.exports = router;