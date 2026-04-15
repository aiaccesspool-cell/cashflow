const router = require("express").Router();
const controller = require("../controllers/auditLogController");
const auth = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.get("/", auth, requireRole(["admin"]), controller.getAuditLogs);

module.exports = router;
