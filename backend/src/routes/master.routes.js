const express = require("express");
const { getChuyenKhoa, getBacSi } = require("../controllers/master.controller");

const router = express.Router();

// Master data phục vụ luồng đặt lịch (UC006)
router.get("/chuyen-khoa", getChuyenKhoa);
router.get("/bac-si", getBacSi);

module.exports = router;
