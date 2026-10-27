import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface PostgresConnection {
  pool: pg.Pool;
  db: AppDatabase;
}

export function createPostgresConnection(input: {
  connectionString: string;
  max: number;
}): PostgresConnection {
  const pool = new pg.Pool({
    connectionString: input.connectionString,
    max: input.max,
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}
