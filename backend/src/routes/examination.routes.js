const express = require("express");
const { getExamination, getHistory } = require("../controllers/examination.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/:hoSoId", authenticate, getExamination);
router.get("/:hoSoId/history", authenticate, getHistory);

module.exports = router;