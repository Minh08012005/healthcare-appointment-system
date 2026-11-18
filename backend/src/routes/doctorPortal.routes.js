const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  listMySchedules,
  listShiftPatients,
} = require("../controllers/doctorPortal.controller");

const router = express.Router();

router.get("/schedules", authenticate, listMySchedules);
router.get("/patients", authenticate, listShiftPatients);

module.exports = router;
