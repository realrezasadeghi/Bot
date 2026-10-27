import { LocalDate } from '../../../domain/shared/local-date.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface TimetableEntry {
	occurrenceId: string;
	courseOfferingId: string;
	courseCode: string;
	courseTitle: string;
	instructorNames: string[];
	date: string;
	startTime: string;
	endTime: string;
	location: string | null;
	status: 'SCHEDULED' | 'CANCELLED';
}

export class GetStudentTimetable {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(
		userId: string,
		from: Date,
		to: Date,
	): Promise<TimetableEntry[]> {
		return this.deps.uow.run(async (repositories) => {
			const selection =
				await repositories.studentSelections.findActiveByUserId(userId);
			if (!selection) {
				return [];
			}

			const offeringIds =
				await repositories.studentSelections.listSelectedOfferings(selection.id);
			if (offeringIds.length === 0) {
				return [];
			}

			const fromDate = LocalDate.fromUtcDate(from);
			const toDate = LocalDate.fromUtcDate(to);

			const views = await repositories.occurrences.listForCourses(
				offeringIds,
				fromDate,
				toDate,
			);

			return views.map((view) => ({
				occurrenceId: view.occurrence.id,
				courseOfferingId: view.courseOffering.id,
				courseCode: view.course.code,
				courseTitle: view.course.title,
				instructorNames: view.instructors.map((instructor) => instructor.fullName),
				date: view.occurrence.date.toString(),
				startTime: view.occurrence.startTime.toString(),
				endTime: view.occurrence.endTime.toString(),
				location: view.occurrence.location,
				status: view.occurrence.isActive() ? 'SCHEDULED' : 'CANCELLED',
			}));
		});
	}
}
