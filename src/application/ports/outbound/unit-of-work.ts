import type { AcademicCatalogRepository } from './academic-catalog-repository.js';
import type { ExaminationRepository } from './examination-repository.js';
import type { ExternalIdentifierRepository } from './external-identifier-repository.js';
import type { NotificationJobRepository } from './notification-job-repository.js';
import type { ClassOccurrenceRepository } from './occurrence-repository.js';
import type { StudentSelectionRepository } from './student-selection-repository.js';
import type { StudyFieldOfferingMappingRepository } from './study-field-offering-mapping-repository.js';
import type { StudyFieldRepository } from './study-field-repository.js';
import type { SubscriptionRepository } from './subscription-repository.js';
import type { SyncRunRepository } from './sync-run-repository.js';
import type { UserRepository } from './user-repository.js';

export interface Repositories {
	academic: AcademicCatalogRepository;
	externalIds: ExternalIdentifierRepository;
	examinations: ExaminationRepository;
	users: UserRepository;
	subscriptions: SubscriptionRepository;
	studentSelections: StudentSelectionRepository;
	studyFields: StudyFieldRepository;
	studyFieldOfferingMappings: StudyFieldOfferingMappingRepository;
	occurrences: ClassOccurrenceRepository;
	jobs: NotificationJobRepository;
	syncRuns: SyncRunRepository;
}

export interface UnitOfWork {
	run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
