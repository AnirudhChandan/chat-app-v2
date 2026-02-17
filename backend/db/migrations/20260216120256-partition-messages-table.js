"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Rename the existing monolithic table to keep it as backup
      // We also rename the indexes to free up the names
      await queryInterface.sequelize.query(
        'ALTER TABLE "Messages" RENAME TO "Messages_Backup";',
        { transaction },
      );

      // 2. Drop the Foreign Key on MessageReactions
      // It references "Messages", but that table is gone (renamed).
      // We need to drop the constraint to avoid conflicts.
      // Note: We use "CASCADE" to force the drop of the constraint.
      await queryInterface.sequelize.query(
        'ALTER TABLE "MessageReactions" DROP CONSTRAINT IF EXISTS "MessageReactions_messageId_fkey";',
        { transaction },
      );

      // 3. Create the NEW Partitioned Parent Table
      // Notice: PRIMARY KEY is now (id, "createdAt")
      await queryInterface.sequelize.query(
        `
        CREATE TABLE "Messages" (
          id SERIAL,
          content TEXT,
          "attachmentUrl" VARCHAR(255),
          "senderId" INTEGER NOT NULL,
          "conversationId" INTEGER NOT NULL,
          "searchVector" TSVECTOR, 
          "createdAt" TIMESTAMPTZ NOT NULL,
          "updatedAt" TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (id, "createdAt")
        ) PARTITION BY RANGE ("createdAt");
      `,
        { transaction },
      );

      // 4. Create Partitions (Time-Based Chunks)

      // Partition 1: History (Everything before 2026)
      await queryInterface.sequelize.query(
        `
        CREATE TABLE "messages_archive" PARTITION OF "Messages"
        FOR VALUES FROM (MINVALUE) TO ('2026-01-01');
      `,
        { transaction },
      );

      // Partition 2: Jan 2026
      await queryInterface.sequelize.query(
        `
        CREATE TABLE "messages_2026_01" PARTITION OF "Messages"
        FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
      `,
        { transaction },
      );

      // Partition 3: Feb 2026 (Current Month)
      await queryInterface.sequelize.query(
        `
        CREATE TABLE "messages_2026_02" PARTITION OF "Messages"
        FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
      `,
        { transaction },
      );

      // Partition 4: Future Proofing (Next few months)
      await queryInterface.sequelize.query(
        `
        CREATE TABLE "messages_2026_future" PARTITION OF "Messages"
        FOR VALUES FROM ('2026-03-01') TO (MAXVALUE);
      `,
        { transaction },
      );

      // 5. Restore Indexes on the Parent (Postgres propagates these to children)
      // Index for efficient channel fetching
      await queryInterface.sequelize.query(
        `
        CREATE INDEX "idx_messages_conversationId" ON "Messages" ("conversationId");
      `,
        { transaction },
      );

      // Index for Full Text Search (GIN)
      await queryInterface.sequelize.query(
        `
        CREATE INDEX "idx_messages_searchVector" ON "Messages" USING GIN ("searchVector");
      `,
        { transaction },
      );

      // 6. Migrate Data from Backup to New Table
      // This automatically routes rows to the correct partition!
      await queryInterface.sequelize.query(
        `
        INSERT INTO "Messages" (id, content, "attachmentUrl", "senderId", "conversationId", "searchVector", "createdAt", "updatedAt")
        SELECT id, content, "attachmentUrl", "senderId", "conversationId", "searchVector", "createdAt", "updatedAt"
        FROM "Messages_Backup";
      `,
        { transaction },
      );

      // 7. Fix the Serial Sequence
      // The new table created a new sequence. We must set it to the max id of the old data.
      await queryInterface.sequelize.query(
        `
        SELECT setval(pg_get_serial_sequence('"Messages"', 'id'), COALESCE(MAX(id), 1)) FROM "Messages";
      `,
        { transaction },
      );

      // 8. Re-Apply Search Vector Trigger
      // The old trigger pointed to Messages_Backup. We need a new one for the new table.
      await queryInterface.sequelize.query(
        `
        CREATE TRIGGER message_search_vector_update
        BEFORE INSERT OR UPDATE ON "Messages"
        FOR EACH ROW EXECUTE PROCEDURE message_search_vector_update();
      `,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverting partitioning is hard, usually we just drop the partitioned table
    // and rename the backup back.
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable("Messages", { transaction });
      await queryInterface.renameTable("Messages_Backup", "Messages", {
        transaction,
      });

      // Restore FK
      await queryInterface.addConstraint("MessageReactions", {
        fields: ["messageId"],
        type: "foreign key",
        name: "MessageReactions_messageId_fkey",
        references: {
          table: "Messages",
          field: "id",
        },
        onDelete: "cascade",
        onUpdate: "cascade",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
