const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { listTimeSlots, updateTimeSlot } = require("../controllers/timeSlotConfig.controller");

// C6-06: Admin cấu hình khung giờ & slot (template cho lịch trực mới)
const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "Quản trị viên") {
    return res.status(403).json({ success: false, message: "Chỉ Quản trị viên được phép truy cập" });
  }
  return next();
};

router.get("/", authenticate, requireAdmin, listTimeSlots);
router.put("/:id", authenticate, requireAdmin, updateTimeSlot);

module.exports = router;