const express = require("express");
const healthRoutes = require("./health.routes");
const integrationRoutes = require("./integration.routes");
const masterRoutes = require("./master.routes");
const slotRoutes = require("./slot.routes");

const router = express.Router();
router.use("/health", healthRoutes);
router.use("/integration", integrationRoutes);
router.use("/master", masterRoutes);
router.use("/slots", slotRoutes);

module.exports = router;