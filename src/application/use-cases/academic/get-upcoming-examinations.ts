import { NotFoundError } from '../../../domain/shared/errors.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import type { ExaminationEntryDto } from '../../dto/read-models.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export class GetUpcomingExaminations {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(
		userId: string,
		options: { from?: LocalDate; to?: LocalDate } = {},
	): Promise<ExaminationEntryDto[]> {
		return this.deps.uow.run(async (repositories) => {
			const selection =
				await repositories.studentSelections.findActiveByUserId(userId);
			if (!selection?.academicTermId) return [];

			const user = await repositories.users.findUserById(userId);
			if (!user) throw new NotFoundError(`User ${userId} not found`);

			const offeringIds =
				await repositories.studentSelections.listSelectedOfferings(selection.id);
			if (offeringIds.length === 0) return [];

			const term = await repositories.academic.getTermById(
				selection.academicTermId,
			);
			const today = LocalDate.fromInstant(
				this.deps.clock.now(),
				user.timeZone,
			);
			const from = options.from ?? today;
			const to =
				options.to ?? term?.endsOn ?? from.addDays(180);

			const [examinations, offerings] = await Promise.all([
				repositories.examinations.listUpcomingForCourseOfferingIds(
					offeringIds,
					from,
					to,
				),
				repositories.academic.listCourseOfferingsByIds(offeringIds),
			]);

			const offeringById = new Map(
				offerings.map((view) => [view.courseOffering.id, view]),
			);

			const entries: ExaminationEntryDto[] = [];
			for (const examination of examinations) {
				if (!examination.isActive()) continue;
				const view = offeringById.get(examination.courseOfferingId);
				if (!view) continue;
				entries.push({
					examinationId: examination.id,
					courseOfferingId: examination.courseOfferingId,
					courseCode: view.course.code,
					courseTitle: view.course.title,
					sectionCode: view.courseOffering.sectionCode,
					instructorNames: view.instructors.map(
						(instructor) => instructor.fullName,
					),
					examDate: examination.examDate.toString(),
					startTime: examination.startTime?.toString() ?? null,
					endTime: examination.endTime?.toString() ?? null,
					location: examination.location,
					sourceIdentifier: examination.sourceIdentifier,
					status: 'SCHEDULED',
				});
			}
			return entries.sort((left, right) => {
				const dateCompare = left.examDate.localeCompare(right.examDate);
				if (dateCompare !== 0) return dateCompare;
				return (left.startTime ?? '').localeCompare(right.startTime ?? '');
			});
		});
	}
}
