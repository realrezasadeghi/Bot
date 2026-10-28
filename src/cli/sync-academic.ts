import 'dotenv/config';
import { createAppContainer } from '../bootstrap/container.js';
import { syncTerm, toUniversitySourceRequest } from '../bootstrap/sync-term.js';
import { loadConfig } from '../config/env.js';

const config = loadConfig();
const container = createAppContainer(config);

try {
	await syncTerm(container, toUniversitySourceRequest(config.university));
} finally {
	await container.close();
}
