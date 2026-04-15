module.exports = (sequelize, DataTypes) => {

 return sequelize.define("Category", {

  name: {
   type: DataTypes.STRING,
   allowNull: false
  },

  type: {
   type: DataTypes.STRING,
   allowNull: false,
   validate: {
    isIn: [["cash-in", "cash-out"]]
   }
  }

 });

};
