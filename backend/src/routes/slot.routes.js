const express = require("express");
const { getSlotKhaDung } = require("../controllers/slot.controller");

const router = express.Router();

router.get("/", getSlotKhaDung);

module.exports = router;