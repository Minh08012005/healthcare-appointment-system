const express = require("express");
const healthRoutes = require("./health.routes");
const integrationRoutes = require("./integration.routes");
const authRoutes = require("./auth.routes");

const router = express.Router();
router.use("/health", healthRoutes);
router.use("/integration", integrationRoutes);
router.use("/auth", authRoutes);

module.exports = router;
