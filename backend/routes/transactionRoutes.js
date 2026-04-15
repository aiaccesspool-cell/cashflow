const router = require("express").Router();
const controller = require("../controllers/transactionController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.post("/", auth, requirePermission("transactions.create"), controller.createTransaction);
router.get("/", auth, requirePermission("transactions.view"), controller.getTransactions);
router.get(
  "/export/csv",
  auth,
  requirePermission("transactions.export"),
  controller.exportTransactionsCsv
);
router.get(
  "/export/pdf",
  auth,
  requirePermission("transactions.export"),
  controller.exportTransactionsPdf
);
router.put("/:id", auth, requirePermission("transactions.edit"), controller.updateTransaction);
router.delete("/:id", auth, requirePermission("transactions.delete"), controller.deleteTransaction);
module.exports = router;
