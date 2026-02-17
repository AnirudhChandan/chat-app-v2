"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ConversationParticipants", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      conversationId: {
        type: Sequelize.INTEGER,
        references: { model: "Conversations", key: "id" },
        onDelete: "CASCADE",
      },
      lastReadMessageId: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ConversationParticipants");
  },
};
