import type { UniversityAcademicSnapshot } from '../../dto/university.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../ports/outbound/university-source.js';

export class ImportUniversityAcademicData {
	constructor(
		private readonly deps: {
			source: UniversityAcademicSource;
			logger: Logger;
		},
	) {}

	async execute(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		const snapshot = await this.deps.source.fetchSnapshot(request);
		this.deps.logger.info(
			{
				termCode: request.termCode,
				courseOfferings: snapshot.courseOfferings.length,
				complete: snapshot.complete,
				warnings: snapshot.warnings.length,
			},
			'University academic snapshot fetched',
		);
		return snapshot;
	}
}
