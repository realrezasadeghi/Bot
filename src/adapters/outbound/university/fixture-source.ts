import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { UniversityAcademicSnapshot } from '../../../application/dto/university.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../../application/ports/outbound/university-source.js';

type RawSnapshot = Omit<
	UniversityAcademicSnapshot,
	'fetchedAt' | 'complete'
> & {
	fetchedAt?: string | Date;
	complete?: boolean;
};

function normalizeFixture(raw: RawSnapshot): UniversityAcademicSnapshot {
	return {
		...raw,
		fetchedAt:
			raw.fetchedAt instanceof Date
				? raw.fetchedAt
				: raw.fetchedAt
					? new Date(raw.fetchedAt)
					: new Date(),
		complete: raw.complete === true,
		examinations: raw.examinations ?? [],
	};
}

export class FixtureUniversitySource implements UniversityAcademicSource {
	constructor(private readonly fixturePath: string) {}

	async fetchSnapshot(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		const content = await readFile(
			path.join(process.cwd(), this.fixturePath),
			'utf8',
		);
		const parsed = JSON.parse(content) as RawSnapshot | { snapshot: RawSnapshot };

		const raw: RawSnapshot =
			'snapshot' in parsed && parsed.snapshot
				? parsed.snapshot
				: (parsed as RawSnapshot);
		const snapshot = normalizeFixture(raw);

		if (
			snapshot.term.externalCode !== request.termCode &&
			request.termCode.length > 0
		) {
			throw new Error(
				`Fixture term ${snapshot.term.externalCode} does not match requested term ${request.termCode}`,
			);
		}

		return snapshot;
	}
}
