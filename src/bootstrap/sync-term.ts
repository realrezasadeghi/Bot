import type { UniversityAcademicSnapshot } from "../application/dto/university.js";
import type { SynchronizationResult } from "../application/use-cases/academic/synchronize-academic-data.js";
import type { GenerateOccurrencesResult } from "../application/use-cases/scheduling/generate-class-occurrences.js";
import type { AppContainer } from "./container.js";

export interface SyncTermResult {
  snapshot: UniversityAcademicSnapshot;
  synchronization: SynchronizationResult;
  termId: string | null;
  occurrences: GenerateOccurrencesResult | null;
}

export async function syncTerm(
  container: AppContainer,
  termCode: string,
): Promise<SyncTermResult> {
  const snapshot = await container.importUniversityData.execute(termCode);
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
    synchronization,
    termId: term.id,
    occurrences,
  };
}
