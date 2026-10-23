const express = require("express");
const healthRoutes = require("./health.routes");
const integrationRoutes = require("./integration.routes");

const router = express.Router();
router.use("/health", healthRoutes);
router.use("/integration", integrationRoutes);

module.exports = router;