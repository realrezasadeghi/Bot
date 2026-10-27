// path to a file with schema you want to reset

import { drizzle } from 'drizzle-orm/node-postgres';
import { reset } from 'drizzle-seed';
import * as schema from '../adapters//outbound/persistence/postgres/schema.js';
import { loadConfig } from '../config/env.js';

async function main() {
	const config = loadConfig();
	const db = drizzle(config.database.url);
	await reset(db, schema);
}

main().catch((error) => console.log('Error in reset db', error));
