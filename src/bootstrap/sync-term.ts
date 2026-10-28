import type { UniversityAcademicSnapshot } from '../application/dto/university.js';
import type { UniversitySourceRequest } from '../application/ports/outbound/university-source.js';
import type { SynchronizationResult } from '../application/use-cases/academic/synchronize-academic-data.js';
import type { GenerateOccurrencesResult } from '../application/use-cases/scheduling/generate-class-occurrences.js';
import type { AppConfig } from '../config/env.js';
import type { AppContainer } from './container.js';

export interface SyncTermResult {
	snapshot: UniversityAcademicSnapshot;
	synchronization: SynchronizationResult;
	termId: string | null;
	occurrences: GenerateOccurrencesResult | null;
}

/**
 * Projects the university configuration onto the outbound port request.
 *
 * Keeps adapter-only concerns (for example the session cookie) out of the
 * application request, so the domain never depends on transport details.
 */
export function toUniversitySourceRequest(
	config: AppConfig['university'],
): UniversitySourceRequest {
	return {
		sourceKey: config.sourceKey,
		offerUrl: config.offerUrl,
		queryParam: config.queryParam,
		queryR: config.queryR,
		termCode: config.termCode,
		viewStateGenerator: config.viewStateGenerator,
		gridInfo: config.gridInfo,
		chkMain: config.chkMain,
		requestTimeoutMs: config.requestTimeoutMs,
		fixturePath: config.fixturePath,
	};
}

export async function syncTerm(
	container: AppContainer,
	request: UniversitySourceRequest,
): Promise<SyncTermResult> {
	const snapshot = await container.importUniversityData.execute(request);

	const synchronization =
		await container.synchronizeAcademicData.execute(snapshot);

	const term = await container.uow.run((repositories) =>
		repositories.academic.getTermByExternalCode(snapshot.term.externalCode),
	);

	if (!term) {
		return {
			snapshot,
			synchronization,
			termId: null,
			occurrences: null,
		};
	}

	const occurrences = await container.generateClassOccurrences.execute({
		termId: term.id,
		reconcileAbsent: snapshot.complete,
	});

	return {
		snapshot,
		occurrences,
		synchronization,
		termId: term.id,
	};
}
