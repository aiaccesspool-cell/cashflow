const router = require("express").Router();
const controller = require("../controllers/userController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get(
  "/meta",
  auth,
  requirePermission("users.view"),
  controller.getUserMeta
);
router.get(
  "/",
  auth,
  requirePermission("users.view"),
  controller.getUsers
);
router.post(
  "/",
  auth,
  requirePermission("users.create"),
  controller.createUser
);
router.put(
  "/:id",
  auth,
  requirePermission("users.edit"),
  controller.updateUser
);
router.put(
  "/:id/password",
  auth,
  requirePermission("users.password"),
  controller.changePassword
);
router.put(
  "/:id/status",
  auth,
  requirePermission("users.edit"),
  controller.updateUserStatus
);
router.delete(
  "/:id",
  auth,
  requirePermission("users.edit"),
  controller.deleteUser
);

module.exports = router;
