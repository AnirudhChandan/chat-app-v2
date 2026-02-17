"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class MessageReaction extends Model {
    static associate(models) {
      // Define associations here
      MessageReaction.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
      MessageReaction.belongsTo(models.Message, {
        foreignKey: "messageId",
        as: "message",
      });
    }
  }
  MessageReaction.init(
    {
      emoji: DataTypes.STRING,
      userId: DataTypes.INTEGER,
      messageId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "MessageReaction",
    },
  );
  return MessageReaction;
};
