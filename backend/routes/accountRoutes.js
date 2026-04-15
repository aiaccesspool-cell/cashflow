const express = require("express");
const router = express.Router();
const controller = require("../controllers/accountController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get("/", auth, requirePermission("accounts.view"), controller.getAccounts);
router.post("/", auth, requirePermission("accounts.create"), controller.createAccount);
router.put("/:id", auth, requirePermission("accounts.edit"), controller.updateAccount);
router.delete("/:id", auth, requirePermission("accounts.delete"), controller.deleteAccount);

module.exports = router;
