const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require("./user")(sequelize, Sequelize);
db.Account = require("./account")(sequelize, Sequelize);
db.Category = require("./category")(sequelize, Sequelize);
db.Source = require("./source")(sequelize, Sequelize);
db.Transaction = require("./transaction")(sequelize, Sequelize);
db.AuditLog = require("./auditLog")(sequelize, Sequelize);

db.Account.hasMany(db.Transaction, {
  foreignKey: "accountId"
});

db.Transaction.belongsTo(db.Account, {
  foreignKey: "accountId"
});

db.Category.hasMany(db.Transaction, {
  foreignKey: "categoryId"
});

db.Transaction.belongsTo(db.Category, {
  foreignKey: "categoryId"
});

db.Source.hasMany(db.Transaction, {
  foreignKey: "sourceId"
});

db.Transaction.belongsTo(db.Source, {
  foreignKey: "sourceId"
});

db.User.hasMany(db.AuditLog, {
  foreignKey: "actorUserId",
  constraints: false
});

db.AuditLog.belongsTo(db.User, {
  foreignKey: "actorUserId",
  constraints: false
});



module.exports = db;
