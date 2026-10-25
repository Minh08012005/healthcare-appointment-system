const express = require("express");
const { getSlotKhaDung } = require("../controllers/slot.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authenticate, getSlotKhaDung);

module.exports = router;