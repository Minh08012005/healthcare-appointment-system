const express = require("express");
const { getIntegrationCheck } = require("../controllers/integration.controller");

const router = express.Router();
router.get("/check", getIntegrationCheck);

module.exports = router;
