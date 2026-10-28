import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import {
	type StudyFieldMappingSeed,
	seedStudyFieldMappings,
} from '../application/use-cases/academic/seed-study-field-mappings.js';
import { createAppContainer } from '../bootstrap/container.js';
import { loadConfig } from '../config/env.js';

const configPath = process.argv[2] ?? process.env.STUDY_FIELD_MAPPINGS_PATH;
if (!configPath) {
	throw new Error(
		'Provide a mappings JSON file path as the first argument or STUDY_FIELD_MAPPINGS_PATH',
	);
}

const parsed = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
if (!Array.isArray(parsed)) {
	throw new Error('Mappings file must contain an array');
}
const seeds: StudyFieldMappingSeed[] = parsed.map((value, index) => {
	if (
		typeof value !== 'object' ||
		value === null ||
		typeof (value as { studyFieldCode?: unknown }).studyFieldCode !==
			'string' ||
		!Array.isArray(
			(value as { courseOfferingExternalKeys?: unknown })
				.courseOfferingExternalKeys,
		)
	) {
		throw new Error(`Invalid mapping entry at index ${index}`);
	}
	const entry = value as {
		studyFieldCode: string;
		courseOfferingExternalKeys: unknown[];
	};
	return {
		studyFieldCode: entry.studyFieldCode,
		courseOfferingExternalKeys: entry.courseOfferingExternalKeys.map(
			(externalKey) => {
				if (typeof externalKey !== 'string') {
					throw new Error(`Invalid course offering key at index ${index}`);
				}
				return externalKey;
			},
		),
	};
});

const config = loadConfig();
const container = createAppContainer(config);

try {
	const created = await seedStudyFieldMappings(
		container.uow,
		container.ids,
		seeds,
	);
	container.logger.info({ created }, 'Study field mappings seeded');
} finally {
	await container.close();
}
