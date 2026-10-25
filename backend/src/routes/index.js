const express = require("express");

const healthRoutes = require("./health.routes");
const integrationRoutes = require("./integration.routes");
const authRoutes = require("./auth.routes");
const masterRoutes = require("./master.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/integration", integrationRoutes);
router.use("/auth", authRoutes);
router.use("/master", masterRoutes);

module.exports = router;