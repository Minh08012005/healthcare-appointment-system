const express = require("express");
const { callNextPatient } = require("../controllers/callNext.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/next", authenticate, callNextPatient);

module.exports = router;