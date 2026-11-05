import 'dotenv/config';
import { createAppContainer } from '../bootstrap/container.js';
import { loadConfig } from '../config/env.js';
import { toUniversitySourceRequest } from '../config/university-source-request.js';

const config = loadConfig();
const container = createAppContainer(config);

try {
	await container.syncAcademicTerm.execute(
		toUniversitySourceRequest(config.university),
	);
} finally {
	await container.close();
}
