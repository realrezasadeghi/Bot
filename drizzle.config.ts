import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/adapters/outbound/persistence/postgres/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			'postgres://academic:academic@localhost:5432/academic_scheduling',
	},
	strict: true,
	verbose: true,
});
