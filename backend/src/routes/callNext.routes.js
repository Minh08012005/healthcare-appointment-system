const express = require("express");
const { 
  callNextPatient, 
  recallPatient, 
  skipPatient, 
  startExamination 
} = require("../controllers/callNext.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/next", authenticate, callNextPatient);
router.post("/recall", authenticate, recallPatient);
router.post("/:id/skip", authenticate, skipPatient);
router.post("/:id/start", authenticate, startExamination);

module.exports = router;