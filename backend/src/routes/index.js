const express = require("express");
const healthRoutes = require("./health.routes");
const integrationRoutes = require("./integration.routes");
const authRoutes = require("./auth.routes");
const masterRoutes = require("./master.routes");
const slotRoutes = require("./slot.routes");
const appointmentManageRoutes = require("./appointmentManage.routes");
const appointmentRoutes = require("./appointment.routes");
const checkinRoutes = require("./checkin.routes");

const router = express.Router();
router.use("/health", healthRoutes);
router.use("/integration", integrationRoutes);
router.use("/auth", authRoutes);
router.use("/master", masterRoutes);
router.use("/slots", slotRoutes);
router.use("/appointments", appointmentManageRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/checkin", checkinRoutes);

module.exports = router;
