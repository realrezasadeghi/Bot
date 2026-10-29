import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { createPostgresConnection } from '../adapters/outbound/persistence/postgres/db.js';
import { loadConfig } from '../config/env.js';

const config = loadConfig();
const targetUrl = config.database.url;
const parsed = new URL(targetUrl);
const dbName = parsed.pathname.replace(/^\//, '') || 'postgres';
parsed.pathname = '/postgres';
const adminUrl = parsed.toString();

async function ensureDatabaseExists(): Promise<void> {
	const adminPool = new pg.Pool({ connectionString: adminUrl, max: 1 });
	try {
		const { rows } = await adminPool.query(
			'SELECT 1 FROM pg_database WHERE datname = $1',
			[dbName],
		);
		if (rows.length === 0) {
			await adminPool.query(`CREATE DATABASE "${dbName}"`);
		}
	} finally {
		await adminPool.end();
	}
}

try {
	await ensureDatabaseExists();
	const connection = createPostgresConnection({
		connectionString: targetUrl,
		max: 1,
	});
	try {
		await migrate(connection.db, { migrationsFolder: 'drizzle' });
	} finally {
		await connection.pool.end();
	}
} catch (error) {
	console.error(error);
	process.exit(1);
}
