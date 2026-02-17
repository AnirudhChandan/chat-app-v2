"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Messages", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attachmentUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      senderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" }, // Foreign Key
        onDelete: "CASCADE",
      },
      conversationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Conversations", key: "id" }, // Foreign Key
        onDelete: "CASCADE",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Messages");
  },
};
