module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Transaction", {
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["cash-in", "cash-out"]],
      },
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    transaction_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sourceId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  });
};
