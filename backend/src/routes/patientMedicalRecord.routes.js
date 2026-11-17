const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  listMedicalRecords,
  getMedicalRecord,
  downloadLabResultFile,
} = require("../controllers/patientMedicalRecord.controller");

const router = express.Router();

// C6-11: lịch sử khám của chính bệnh nhân đăng nhập (UC-037). Mọi route đều cần đăng nhập.
router.get("/", authenticate, listMedicalRecords);
router.get("/:id", authenticate, getMedicalRecord);
router.get("/:id/lab-orders/:chiDinhId/result/file", authenticate, downloadLabResultFile);

module.exports = router;
