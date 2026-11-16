const express = require("express");
const c = require("../controllers/adminSpecialty.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authenticate, c.listSpecialties);
router.get("/:id", authenticate, c.getSpecialty);
router.post("/", authenticate, c.createSpecialty);
router.put("/:id", authenticate, c.updateSpecialty);
router.delete("/:id", authenticate, c.deleteSpecialty);

module.exports = router;