const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  listSchedules,
  createSchedules,
  deleteSchedule,
} = require("../controllers/adminSchedule.controller");

// C6-07: Quản trị phân công lịch trực (UC-030) và Tổng quan lịch khám (UC-033)
const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "Quản trị viên") {
    return res.status(403).json({ success: false, message: "Chỉ quản trị viên mới được thực hiện thao tác này" });
  }
  return next();
};

router.get("/", authenticate, requireAdmin, listSchedules);
router.get("/overview", authenticate, requireAdmin, listSchedules);
router.post("/", authenticate, requireAdmin, createSchedules);
router.delete("/:id", authenticate, requireAdmin, deleteSchedule);

module.exports = router;
