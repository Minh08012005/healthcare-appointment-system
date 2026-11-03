const express = require("express");
const {
  callNextPatient,
  getCurrentCalling,
  skipPatient,
  requeuePatient,
  startExamination,
} = require("../controllers/callNext.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/current", authenticate, getCurrentCalling);
router.post("/next", authenticate, callNextPatient);
router.post("/:id/skip", authenticate, skipPatient);
router.post("/:id/requeue", authenticate, requeuePatient);
router.post("/:id/start", authenticate, startExamination);

module.exports = router;
