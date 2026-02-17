"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      // 1. Add the column
      await queryInterface.addColumn(
        "Messages",
        "searchVector",
        {
          type: Sequelize.TSVECTOR,
          allowNull: true,
        },
        { transaction: t },
      );

      // 2. Add the Index (The secret sauce for speed)
      await queryInterface.sequelize.query(
        `
        CREATE INDEX message_search_idx ON "Messages" USING GIN ("searchVector");
      `,
        { transaction: t },
      );

      // 3. Create the Trigger Function
      // This function converts text to vector automatically
      await queryInterface.sequelize.query(
        `
        CREATE FUNCTION message_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW."searchVector" := to_tsvector('english', NEW.content);
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
      `,
        { transaction: t },
      );

      // 4. Attach Trigger to Table
      await queryInterface.sequelize.query(
        `
        CREATE TRIGGER message_search_vector_update
        BEFORE INSERT OR UPDATE ON "Messages"
        FOR EACH ROW EXECUTE PROCEDURE message_search_vector_update();
      `,
        { transaction: t },
      );

      // 5. Backfill existing data
      await queryInterface.sequelize.query(
        `
        UPDATE "Messages" SET "searchVector" = to_tsvector('english', content);
      `,
        { transaction: t },
      );
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS message_search_vector_update ON "Messages"',
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        "DROP FUNCTION IF EXISTS message_search_vector_update",
        { transaction: t },
      );
      await queryInterface.removeIndex("Messages", "message_search_idx", {
        transaction: t,
      });
      await queryInterface.removeColumn("Messages", "searchVector", {
        transaction: t,
      });
    });
  },
};
