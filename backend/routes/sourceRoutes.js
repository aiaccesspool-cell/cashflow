const express = require("express");
const router = express.Router();
const controller = require("../controllers/sourceController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get("/", auth, requirePermission("sources.view"), controller.getSources);
router.post("/", auth, requirePermission("sources.create"), controller.createSource);
router.put("/:id", auth, requirePermission("sources.edit"), controller.updateSource);
router.delete("/:id", auth, requirePermission("sources.delete"), controller.deleteSource);

module.exports = router;
