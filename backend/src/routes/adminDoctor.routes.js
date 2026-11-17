const express = require("express");
const c = require("../controllers/adminDoctor.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authenticate, c.listDoctors);
router.get("/:id", authenticate, c.getDoctor);
router.post("/", authenticate, c.createDoctor);
router.put("/:id", authenticate, c.updateDoctor);

module.exports = router;