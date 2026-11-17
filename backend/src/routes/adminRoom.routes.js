const express = require("express");
const c = require("../controllers/adminRoom.controller");
const { authenticate } = require("../middlewares/auth.middleware");

// C6-04: Admin quản lý phòng + gán nhân viên (quyền Quản trị viên kiểm tra trong controller)
const router = express.Router();

router.get("/", authenticate, c.listRooms);
router.get("/:id", authenticate, c.getRoom);
router.post("/", authenticate, c.createRoom);
router.put("/:id", authenticate, c.updateRoom);
router.delete("/:id", authenticate, c.deleteRoom);
router.put("/:id/staff/:accountId", authenticate, c.assignStaff);
router.delete("/:id/staff/:accountId", authenticate, c.unassignStaff);

module.exports = router;