"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // 1. User belongs to many Conversations (Group Chats)
      User.belongsToMany(models.Conversation, {
        through: "ConversationParticipants",
        foreignKey: "userId",
        as: "conversations",
      });

      // 2. User has sent many Messages
      User.hasMany(models.Message, {
        foreignKey: "senderId",
        as: "messages",
      });

      // 3. NEW: User has made many Reactions
      User.hasMany(models.MessageReaction, {
        foreignKey: "userId",
        as: "reactions",
      });
    }
  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING,
        defaultValue: "https://via.placeholder.com/150",
      },
    },
    {
      sequelize,
      modelName: "User",
    },
  );

  return User;
};
