module.exports = (sequelize, DataTypes) => {

 return sequelize.define("User", {

  name: {
   type: DataTypes.STRING,
   allowNull: false
  },

  email: {
   type: DataTypes.STRING,
   allowNull: false,
   unique: true,
   validate: {
    isEmail: true
   }
  },

  password: {
   type: DataTypes.STRING,
   allowNull: false
  },

  role: {
   type: DataTypes.STRING,
   defaultValue: "user",
   validate: {
    isIn: [["admin", "accountant", "user"]]
   }
  },

  isActive: {
   type: DataTypes.BOOLEAN,
   allowNull: false,
   defaultValue: true
  },

  permissions: {
   type: DataTypes.JSONB,
   allowNull: false,
   defaultValue: {}
  }

 });

};
