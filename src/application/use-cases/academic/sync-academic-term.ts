import { SyncRunStatus } from '../../../domain/academic/sync-run.js';
import type { UniversityAcademicSnapshot } from '../../dto/university.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import type { UniversitySourceRequest } from '../../ports/outbound/university-source.js';
import type {
	GenerateClassOccurrences,
	GenerateOccurrencesResult,
} from '../scheduling/generate-class-occurrences.js';
import type { ImportUniversityAcademicData } from './import-university-academic-data.js';
import type {
	SynchronizationResult,
	SynchronizeAcademicData,
} from './synchronize-academic-data.js';

/** Outcome of a full synchronization cycle. */
export interface SyncAcademicTermResult {
	snapshot: UniversityAcademicSnapshot;
	synchronization: SynchronizationResult;
	termId: string | null;
	occurrences: GenerateOccurrencesResult | null;
}

export interface SyncAcademicTermDependencies {
	importUniversityData: ImportUniversityAcademicData;
	synchronizeAcademicData: SynchronizeAcademicData;
	generateClassOccurrences: GenerateClassOccurrences;
	uow: UnitOfWork;
}

/**
 * Synchronizes the university snapshot and generates class occurrences.
 *
 * This is the shared academic-sync workflow used by every driver (HTTP admin
 * API, background worker, CLI). It lives in the application layer so the
 * drivers stay thin and the workflow never depends on a concrete container.
 */
export class SyncAcademicTerm {
	constructor(private readonly deps: SyncAcademicTermDependencies) {}

	async execute(
		request: UniversitySourceRequest,
	): Promise<SyncAcademicTermResult> {
		const snapshot = await this.deps.importUniversityData.execute(request);

		const synchronization =
			await this.deps.synchronizeAcademicData.execute(snapshot);

		// A rejected snapshot (invalid or unsafe) must not trigger occurrence
		// generation. Preserve the last known good data as-is.
		if (synchronization.status === SyncRunStatus.Rejected) {
			return {
				snapshot,
				synchronization,
				termId: null,
				occurrences: null,
			};
		}

		const term = await this.deps.uow.run((repositories) =>
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

		// Only reconcile absent occurrences when destructive reconciliation was
		// actually allowed by the synchronizer.
		const occurrences = await this.deps.generateClassOccurrences.execute({
			termId: term.id,
			reconcileAbsent: synchronization.reconcileAbsent,
		});

		return {
			snapshot,
			occurrences,
			synchronization,
			termId: term.id,
		};
	}
}
