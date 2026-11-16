const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  getQueueSettings,
  updateQueueSettings,
} = require("../controllers/queueSettings.controller");

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "Quản trị viên") {
    return res.status(403).json({
      success: false,
      message: "Chỉ Quản trị viên được phép truy cập",
    });
  }
  return next();
};

router.get("/queue-settings", authenticate, requireAdmin, getQueueSettings);
router.put("/queue-settings", authenticate, requireAdmin, updateQueueSettings);

module.exports = router;
