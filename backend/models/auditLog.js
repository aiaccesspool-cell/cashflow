module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "AuditLog",
    {
      module: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      summary: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      actorName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      actorRole: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      meta: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      updatedAt: false,
    }
  );
};
