const router = require("express").Router();
const controller = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
const requirePermission = require("../middleware/permissionMiddleware");

router.get("/me", auth, controller.me);
router.put("/change-password", auth, controller.changeMyPassword);
router.post("/register", auth, requirePermission("users.create"), controller.register);
router.post("/login", controller.login);

module.exports = router;
