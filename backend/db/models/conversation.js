"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      // Define associations here
      Conversation.belongsToMany(models.User, {
        through: "ConversationParticipants", // Using string matches the model name
        foreignKey: "conversationId",
        as: "participants",
      });
      Conversation.hasMany(models.Message, {
        foreignKey: "conversationId",
        as: "messages",
      });
      Conversation.hasMany(models.ConversationParticipant, {
        foreignKey: "conversationId",
        as: "participantDetails",
      });
    }
  }
  Conversation.init(
    {
      type: {
        type: DataTypes.ENUM("DIRECT", "GROUP"), // <--- FIX IS HERE
        defaultValue: "DIRECT",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Conversation",
    },
  );
  return Conversation;
};
