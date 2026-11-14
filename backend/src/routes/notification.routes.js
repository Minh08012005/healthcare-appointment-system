const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { listNotifications, markRead } = require("../controllers/notification.controller");

const router = express.Router();

// C5-05: thông báo của bệnh nhân
router.get("/", authenticate, listNotifications);
router.patch("/:id/read", authenticate, markRead);

module.exports = router;
