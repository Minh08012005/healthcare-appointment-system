const express = require("express");
const { getExamination, getHistory, saveExamResult } = require("../controllers/examination.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/:hoSoId", authenticate, getExamination);
router.get("/:hoSoId/history", authenticate, getHistory);
router.put("/:hoSoId/result", authenticate, saveExamResult);

module.exports = router;