const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  getDanhSach,
  getChiTiet,
  huyLich,
} = require("../controllers/appointmentManage.controller");

const router = express.Router();

router.get("/", authenticate, getDanhSach);
router.get("/:id", authenticate, getChiTiet);
router.patch("/:id/cancel", authenticate, huyLich);

module.exports = router;