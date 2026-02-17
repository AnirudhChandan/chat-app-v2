"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.User, { foreignKey: "senderId", as: "sender" });
      Message.belongsTo(models.Conversation, {
        foreignKey: "conversationId",
        as: "conversation",
      });

      Message.hasMany(models.MessageReaction, {
        foreignKey: "messageId",
        as: "reactions",
      });
    }
  }
  Message.init(
    {
      // Explicitly define ID so Sequelize knows it's part of the PK
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true, // Logic PK
        autoIncrement: true,
      },
      content: DataTypes.TEXT,
      attachmentUrl: DataTypes.STRING,
      senderId: DataTypes.INTEGER,
      conversationId: DataTypes.INTEGER,
      searchVector: DataTypes.TSVECTOR, // Keep this for reference
      // Important: Partitioning relies on createdAt
      createdAt: {
        type: DataTypes.DATE,
        primaryKey: true, // DB PK includes this
      },
    },
    {
      sequelize,
      modelName: "Message",
      // Optimization: Disable 'returning: true' for inserts if using older Postgres
      // but modern Postgres handles partitioned inserts fine.
    },
  );
  return Message;
};
