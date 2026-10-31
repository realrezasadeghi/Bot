import 'dotenv/config';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createPostgresConnection } from '../adapters/outbound/persistence/postgres/db.js';
import { loadConfig } from '../config/env.js';

// --------------------------------------------------
// Migration Runner
// --------------------------------------------------

async function main(): Promise<void> {
	const config = loadConfig();

	const connection = createPostgresConnection({
		connectionString: config.database.url,
		max: 1,
	});

	try {
		console.info('Starting database migrations...');

		await migrate(connection.db, {
			migrationsFolder: 'drizzle',
		});

		console.info('Database migrations completed successfully.');
	} finally {
		// Always close the database pool,
		// regardless of migration success or failure.
		await connection.pool.end();
	}
}

// --------------------------------------------------
// Execute
// --------------------------------------------------

main().catch((error: unknown) => {
	console.error('Database migration failed:', error);

	// Non-zero exit code allows Docker Compose,
	// CI and deployment scripts to detect failure.
	process.exitCode = 1;
});
