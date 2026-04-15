const jwt = require("jsonwebtoken");
const db = require("../models");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Invalid authorization header" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db.User.findByPk(decoded.id, {
      attributes: ["id", "name", "email", "role", "isActive", "permissions"],
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "User account is inactive" });
    }

    req.user = user.get({ plain: true });
    next();
  } catch (err) {
    console.error("AuthMiddleware error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};
