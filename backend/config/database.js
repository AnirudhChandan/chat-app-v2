const path = require("path");
// Force load .env from the backend root directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Diagnostic Log (Will show in terminal when server starts)
console.log("🔧 DB Config Loading...");
console.log(`   - Username: ${process.env.DB_USERNAME || "UNDEFINED"}`);
console.log(
  `   - Database: ${process.env.DB_NAME || "UNDEFINED (Defaulting to System User)"}`,
);

module.exports = {
  development: {
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "nexus_chat",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "postgres",
    logging: false,
  },
  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
