const express = require("express");
const { checkinOnline } = require("../controllers/checkin.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/online", authenticate, checkinOnline);

module.exports = router;