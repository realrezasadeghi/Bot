import type { CourseExamination } from '../../../domain/academic/examination.js';
import type { LocalDate } from '../../../domain/shared/local-date.js';

export interface ExaminationRepository {
	upsertMany(
		examinations: ReadonlyArray<CourseExamination>,
	): Promise<CourseExamination[]>;
	listByCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<CourseExamination[]>;
	listUpcomingForCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
		from: LocalDate,
		to: LocalDate,
	): Promise<CourseExamination[]>;
	deactivateByCourseOfferingIdsNotIn(
		courseOfferingIds: ReadonlyArray<string>,
		keepSourceIdentifiers: ReadonlyArray<string>,
	): Promise<number>;
}
