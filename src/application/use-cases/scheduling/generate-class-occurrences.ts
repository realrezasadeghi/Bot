import { ClassOccurrence } from '../../../domain/academic/class-occurrence.js';
import { generateClassOccurrences } from '../../../domain/scheduling/occurrence-generator.js';
import { NotFoundError } from '../../../domain/shared/errors.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface GenerateOccurrencesResult {
	created: number;
	updated: number;
	cancelled: number;
	createdOccurrenceIds: string[];
	changedOccurrenceIds: string[];
	cancelledOccurrenceIds: string[];
}

export class GenerateClassOccurrences {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
			logger: Logger;
			horizonDays: number;
			appTimeZone: string;
		},
	) {}

	async execute(input: {
		termId: string;
		from?: LocalDate;
		to?: LocalDate;
		reconcileAbsent: boolean;
	}): Promise<GenerateOccurrencesResult> {
		const now = this.deps.clock.now();

		return this.deps.uow.run(async (repositories) => {
			const term = await repositories.academic.getTermById(input.termId);
			if (!term) throw new NotFoundError(`Term ${input.termId} not found`);

			const today = LocalDate.fromInstant(now, this.deps.appTimeZone);
			let from = input.from ?? today;
			let to = input.to ?? from.addDays(this.deps.horizonDays - 1);

			if (term.startsOn && from.isBefore(term.startsOn)) from = term.startsOn;
			if (term.endsOn && to.isAfter(term.endsOn)) to = term.endsOn;

			if (from.isAfter(to)) {
				return {
					created: 0,
					updated: 0,
					cancelled: 0,
					createdOccurrenceIds: [],
					changedOccurrenceIds: [],
					cancelledOccurrenceIds: [],
				};
			}

			const courseOfferingIds =
				await repositories.academic.listCourseOfferingIdsByTerm(term.id);

			if (courseOfferingIds.length === 0) {
				const cancelledOccurrenceIds = input.reconcileAbsent
					? await repositories.occurrences.cancelFutureNotInKeys({
							termId: term.id,
							from,
							keepKeys: new Set(),
							now,
						})
					: [];
				if (cancelledOccurrenceIds.length > 0) {
					await repositories.jobs.cancelPendingByOccurrenceIds(
						cancelledOccurrenceIds,
						now,
						'OCCURRENCE_CHANGED_OR_CANCELLED',
					);
				}
				return {
					created: 0,
					updated: 0,
					cancelled: cancelledOccurrenceIds.length,
					createdOccurrenceIds: [],
					changedOccurrenceIds: [],
					cancelledOccurrenceIds,
				};
			}

			const [patterns, exceptions] = await Promise.all([
				repositories.academic.listMeetingPatternsByCourseOfferingIds(
					courseOfferingIds,
				),
				repositories.academic.listScheduleExceptionsByCourseOfferingIds(
					courseOfferingIds,
				),
			]);

			const plans = generateClassOccurrences({
				patterns,
				exceptions,
				from,
				to,
			});

			const occurrences = plans.map((plan) =>
				ClassOccurrence.create({
					id: this.deps.ids.next(),
					courseOfferingId: plan.courseOfferingId,
					meetingPatternId: plan.meetingPatternId,
					date: plan.date,
					startTime: plan.startTime,
					endTime: plan.endTime,
					location: plan.location,
					status: plan.status,
					exceptionId: plan.exceptionId,
					generatedAt: now,
				}),
			);

			const upserted = await repositories.occurrences.upsertMany(occurrences);

			const cancelledOccurrenceIds =
				input.reconcileAbsent && plans.length > 0
					? await repositories.occurrences.cancelFutureNotInKeys({
							termId: term.id,
							from,
							keepKeys: new Set(
								plans.map((plan) =>
									[
										plan.courseOfferingId,
										plan.date.toString(),
										plan.startTime.minutes.toString(),
									].join('|'),
								),
							),
							now,
						})
					: [];

			const obsoleteJobs = [
				...upserted.changedOccurrenceIds,
				...cancelledOccurrenceIds,
			];
			if (obsoleteJobs.length > 0) {
				await repositories.jobs.cancelPendingByOccurrenceIds(
					obsoleteJobs,
					now,
					'OCCURRENCE_CHANGED_OR_CANCELLED',
				);
			}

			this.deps.logger.info(
				{
					termId: term.id,
					from: from.toString(),
					to: to.toString(),
					created: upserted.created,
					updated: upserted.updated,
					cancelled: cancelledOccurrenceIds.length,
				},
				'Class occurrences generated',
			);

			return {
				created: upserted.created,
				updated: upserted.updated,
				cancelled: cancelledOccurrenceIds.length,
				createdOccurrenceIds: upserted.createdOccurrenceIds,
				changedOccurrenceIds: upserted.changedOccurrenceIds,
				cancelledOccurrenceIds,
			};
		});
	}
}
