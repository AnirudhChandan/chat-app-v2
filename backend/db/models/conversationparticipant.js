"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ConversationParticipant extends Model {
    static associate(models) {
      // Define associations here
      ConversationParticipant.belongsTo(models.User, { foreignKey: "userId" });
      ConversationParticipant.belongsTo(models.Conversation, {
        foreignKey: "conversationId",
      });
    }
  }
  ConversationParticipant.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      lastReadMessageId: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "ConversationParticipant",
    },
  );
  return ConversationParticipant;
};
