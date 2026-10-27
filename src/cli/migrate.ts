import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config/env.js";
import { createPostgresConnection } from "../adapters/outbound/persistence/postgres/db.js";

const config = loadConfig();
const connection = createPostgresConnection({
  connectionString: config.database.url,
  max: 1,
});

try {
  await migrate(connection.db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied");
} finally {
  await connection.pool.end();
}
