const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const c = require("../controllers/adminContent.controller");

const router = express.Router();

// Tin tức
router.get("/news", authenticate, c.listNews);
router.get("/news/:id", authenticate, c.getNews);
router.post("/news", authenticate, c.createNews);
router.put("/news/:id", authenticate, c.updateNews);
router.patch("/news/:id/status", authenticate, c.setNewsStatus);
router.delete("/news/:id", authenticate, c.deleteNews);

// Quy trình khám
router.get("/procedure-steps", authenticate, c.listSteps);
router.post("/procedure-steps", authenticate, c.createStep);
router.put("/procedure-steps/:id", authenticate, c.updateStep);
router.delete("/procedure-steps/:id", authenticate, c.deleteStep);

module.exports = router;