const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { listAccounts, getOne, createAccount, updateAccount, setStatus } = require("../controllers/adminAccount.controller");

const router = express.Router();

router.get("/", authenticate, listAccounts);
router.get("/:id", authenticate, getOne);
router.post("/", authenticate, createAccount);
router.put("/:id", authenticate, updateAccount);
router.patch("/:id/status", authenticate, setStatus);

module.exports = router;