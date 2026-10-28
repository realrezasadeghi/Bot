import 'dotenv/config';
import { seedStudyFields } from '../application/use-cases/academic/seed-study-fields.js';
import { createAppContainer } from '../bootstrap/container.js';
import { loadConfig } from '../config/env.js';

const config = loadConfig();
const container = createAppContainer(config);

try {
	await seedStudyFields(container.uow);
	container.logger.info({}, 'Study fields seeded');
} finally {
	await container.close();
}
