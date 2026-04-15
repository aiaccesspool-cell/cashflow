const router = require("express").Router();
const controller = require("../controllers/reportController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get("/dashboard", auth, requirePermission("dashboard.view", "reports.view"), controller.dashboardSnapshot);
router.get("/summary", auth, requirePermission("dashboard.view", "reports.view"), controller.monthlySummary);
router.get("/category", auth, requirePermission("reports.view"), controller.categoryReport);
router.get("/cashflow", auth, requirePermission("dashboard.view", "reports.view"), controller.cashFlow);

module.exports = router;
