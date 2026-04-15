const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./models");
const {
  recalculateAllAccountBalances,
} = require("./services/accountBalanceService");

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/accounts", require("./routes/accountRoutes"));
app.use("/api/sources", require("./routes/sourceRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogRoutes"));

const seedUsers = async () => {
  const bcrypt = require("bcrypt");

  const admin = await db.User.findOne({ where: { email: "admin@example.com" } });
  if (!admin) {
    const hash = await bcrypt.hash("123456", 10);
    await db.User.create({
      name: "Admin",
      email: "admin@example.com",
      password: hash,
      role: "admin",
      isActive: true,
    });
    console.log("Admin user created");
  }

  const accountant = await db.User.findOne({ where: { email: "accountant@example.com" } });
  if (!accountant) {
    const hash = await bcrypt.hash("123456", 10);
    await db.User.create({
      name: "Accountant",
      email: "accountant@example.com",
      password: hash,
      role: "accountant",
      isActive: true,
    });
    console.log("Accountant user created");
  }
};

const startServer = async () => {
  try {
    await db.sequelize.sync({ alter: true });
    console.log("Database synced");
    await seedUsers();
    await recalculateAllAccountBalances();
    console.log("Account balances recalculated from transactions");
    app.listen(process.env.PORT, () => console.log("Server running on port", process.env.PORT));
  } catch (err) {
    console.error("Server failed:", err);
  }
};

startServer();
