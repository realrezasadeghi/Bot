import 'dotenv/config';
import { createAppContainer } from '../bootstrap/container.js';
import { syncTerm } from '../bootstrap/sync-term.js';
import { loadConfig } from '../config/env.js';

const config = loadConfig();
const container = createAppContainer(config);

try {
	const _result = await syncTerm(container, config.university.termCode);
} finally {
	await container.close();
}
