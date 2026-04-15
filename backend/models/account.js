module.exports = (sequelize, DataTypes) => {

 return sequelize.define("Account", {

  name: DataTypes.STRING,

  openingBalance: {
   type: DataTypes.FLOAT,
   allowNull: false,
   defaultValue: 0
  },

  balance: {
   type: DataTypes.FLOAT,
   defaultValue: 0
  }

 });

};
