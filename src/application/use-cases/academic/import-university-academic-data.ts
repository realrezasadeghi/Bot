import type { UniversityAcademicSnapshot } from '../../dto/university.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UniversityAcademicSource } from '../../ports/outbound/university-source.js';

export class ImportUniversityAcademicData {
	constructor(
		private readonly deps: {
			source: UniversityAcademicSource;
			logger: Logger;
		},
	) {}

	async execute(termCode: string): Promise<UniversityAcademicSnapshot> {
		const snapshot = await this.deps.source.fetchSnapshot({ termCode });
		this.deps.logger.info(
			{
				termCode,
				courseOfferings: snapshot.courseOfferings.length,
				complete: snapshot.complete,
				warnings: snapshot.warnings.length,
			},
			'University academic snapshot fetched',
		);
		return snapshot;
	}
}
