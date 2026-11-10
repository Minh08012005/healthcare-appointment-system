const express = require("express");
const {
  getExamination,
  getHistory,
  saveExamResult,
  closeExamination,
} = require("../controllers/examination.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/:hoSoId", authenticate, getExamination);
router.get("/:hoSoId/history", authenticate, getHistory);
router.put("/:hoSoId/result", authenticate, saveExamResult);
router.post("/:hoSoId/close", authenticate, closeExamination);

module.exports = router;