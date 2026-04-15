module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Source", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "source_type_name_unique",
      validate: {
        notEmpty: true,
      },
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "source_type_name_unique",
      validate: {
        isIn: [["bank", "mfs", "cash"]],
      },
    },
  });
};
