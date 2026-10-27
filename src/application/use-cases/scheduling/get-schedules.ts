import { NotFoundError } from '../../../domain/shared/errors.js';
import {
	eachDateInclusive,
	LocalDate,
} from '../../../domain/shared/local-date.js';
import type {
	DailyScheduleDto,
	ScheduleEntryDto,
	WeeklyScheduleDto,
} from '../../dto/schedule.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type {
	Repositories,
	UnitOfWork,
} from '../../ports/outbound/unit-of-work.js';
import { toScheduleEntryDto } from '../../services/schedule-mapper.js';

async function resolveEffectiveCourseIds(
	repositories: Repositories,
	userId: string,
): Promise<{ timeZone: string; courseOfferingIds: string[] } | null> {
	const user = await repositories.users.findUserById(userId);
	if (!user) throw new NotFoundError(`User ${userId} not found`);

	const subscription =
		await repositories.subscriptions.findActiveByUserId(userId);
	if (!subscription) {
		return { timeZone: user.timeZone, courseOfferingIds: [] };
	}

	const programOffering = await repositories.academic.getProgramOffering(
		subscription.programOfferingId,
	);
	if (!programOffering) {
		return { timeZone: user.timeZone, courseOfferingIds: [] };
	}

	return {
		timeZone: user.timeZone,
		courseOfferingIds: [
			...subscription.effectiveCourseOfferingIds(
				programOffering.courseOfferingIds,
			),
		],
	};
}

export class GetDailySchedule {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(userId: string, date?: LocalDate): Promise<DailyScheduleDto> {
		return this.deps.uow.run(async (repositories) => {
			const resolved = await resolveEffectiveCourseIds(repositories, userId);
			if (!resolved) throw new NotFoundError(`User ${userId} not found`);

			const targetDate =
				date ?? LocalDate.fromInstant(this.deps.clock.now(), resolved.timeZone);

			const views = await repositories.occurrences.listForCourses(
				resolved.courseOfferingIds,
				targetDate,
				targetDate,
			);

			const classes = views
				.map(toScheduleEntryDto)
				.sort((left, right) => left.startTime.localeCompare(right.startTime));

			return {
				date: targetDate.toString(),
				timeZone: resolved.timeZone,
				classes,
			};
		});
	}
}

export class GetWeeklySchedule {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(
		userId: string,
		weekStart?: LocalDate,
	): Promise<WeeklyScheduleDto> {
		return this.deps.uow.run(async (repositories) => {
			const resolved = await resolveEffectiveCourseIds(repositories, userId);
			if (!resolved) throw new NotFoundError(`User ${userId} not found`);

			const start =
				weekStart ??
				LocalDate.fromInstant(
					this.deps.clock.now(),
					resolved.timeZone,
				).startOfWeekSaturday();
			const end = start.addDays(6);

			const views = await repositories.occurrences.listForCourses(
				resolved.courseOfferingIds,
				start,
				end,
			);

			const byDate = new Map<string, ScheduleEntryDto[]>();
			for (const view of views) {
				const entry = toScheduleEntryDto(view);
				const entries = byDate.get(entry.date) ?? [];
				entries.push(entry);
				byDate.set(entry.date, entries);
			}

			const days: DailyScheduleDto[] = eachDateInclusive(start, end).map(
				(date) => ({
					date: date.toString(),
					timeZone: resolved.timeZone,
					classes: (byDate.get(date.toString()) ?? []).sort((left, right) =>
						left.startTime.localeCompare(right.startTime),
					),
				}),
			);

			return {
				weekStart: start.toString(),
				weekEnd: end.toString(),
				timeZone: resolved.timeZone,
				days,
			};
		});
	}
}
