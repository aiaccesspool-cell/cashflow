const express = require("express");
const router = express.Router();
const controller = require("../controllers/categoryController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get("/", auth, requirePermission("categories.view"), controller.getCategories);
router.post("/", auth, requirePermission("categories.create"), controller.createCategory);
router.put("/:id", auth, requirePermission("categories.edit"), controller.updateCategory);
router.delete("/:id", auth, requirePermission("categories.delete"), controller.deleteCategory);

module.exports = router;
