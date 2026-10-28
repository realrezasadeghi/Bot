import { LocalDate } from '../../../domain/shared/local-date.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type {
	Repositories,
	UnitOfWork,
} from '../../ports/outbound/unit-of-work.js';

export interface TimetableEntry {
	occurrenceId: string;
	courseOfferingId: string;
	courseCode: string;
	courseTitle: string;
	sectionCode: string | null;
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
		const fromDate = LocalDate.fromUtcDate(from);
		const toDate = LocalDate.fromUtcDate(to);
		return this.load(userId, fromDate, toDate);
	}

	async getToday(userId: string): Promise<TimetableEntry[]> {
		return this.deps.uow.run(async (repositories) => {
			const user = await repositories.users.findUserById(userId);
			if (!user) return [];
			const today = LocalDate.fromInstant(
				this.deps.clock.now(),
				user.timeZone,
			);
			return this.loadWithin(repositories, userId, today, today);
		});
	}

	async getThisWeek(userId: string): Promise<TimetableEntry[]> {
		return this.deps.uow.run(async (repositories) => {
			const user = await repositories.users.findUserById(userId);
			if (!user) return [];
			const today = LocalDate.fromInstant(
				this.deps.clock.now(),
				user.timeZone,
			);
			const start = today.startOfWeekSaturday();
			return this.loadWithin(repositories, userId, start, start.addDays(6));
		});
	}

	async getUpcoming(
		userId: string,
		days = 7,
	): Promise<TimetableEntry[]> {
		return this.deps.uow.run(async (repositories) => {
			const user = await repositories.users.findUserById(userId);
			if (!user) return [];
			const today = LocalDate.fromInstant(
				this.deps.clock.now(),
				user.timeZone,
			);
			return this.loadWithin(
				repositories,
				userId,
				today,
				today.addDays(Math.max(0, days - 1)),
			);
		});
	}

	async getNextClass(userId: string): Promise<TimetableEntry | null> {
		return this.deps.uow.run(async (repositories) => {
			const user = await repositories.users.findUserById(userId);
			if (!user) return null;
			const now = this.deps.clock.now();
			const today = LocalDate.fromInstant(now, user.timeZone);
			const upcoming = await this.loadWithin(
				repositories,
				userId,
				today,
				today.addDays(29),
			);
			for (const entry of upcoming) {
				if (entry.status !== 'SCHEDULED') continue;
				const date = LocalDate.tryParse(entry.date);
				const startTime = LocalTime.tryParse(entry.startTime);
				if (!date || !startTime) continue;
				if (
					date.toUtcInstant(startTime, user.timeZone).getTime() > now.getTime()
				) {
					return entry;
				}
			}
			return null;
		});
	}
	async getForSelectedTerm(userId: string): Promise<TimetableEntry[]> {
		return this.deps.uow.run(async (repositories) => {
			const selection =
				await repositories.studentSelections.findActiveByUserId(userId);
			if (!selection?.academicTermId) return [];

			const term = await repositories.academic.getTermById(
				selection.academicTermId,
			);
			if (!term) return [];

			const user = await repositories.users.findUserById(userId);
			if (!user) return [];

			const today = LocalDate.fromInstant(
				this.deps.clock.now(),
				user.timeZone,
			);
			const from = term.startsOn ?? today;
			const to = term.endsOn ?? from.addDays(180);
			return this.loadWithin(repositories, userId, from, to);
		});
	}

	private async load(
		userId: string,
		from: LocalDate,
		to: LocalDate,
	): Promise<TimetableEntry[]> {
		return this.deps.uow.run((repositories) =>
			this.loadWithin(repositories, userId, from, to),
		);
	}

	private async loadWithin(
		repositories: Repositories,
		userId: string,
		from: LocalDate,
		to: LocalDate,
	): Promise<TimetableEntry[]> {
		const selection =
			await repositories.studentSelections.findActiveByUserId(userId);
		if (!selection) return [];

		const offeringIds =
			await repositories.studentSelections.listSelectedOfferings(selection.id);
		if (offeringIds.length === 0) return [];

		const views = await repositories.occurrences.listForCourses(
			offeringIds,
			from,
			to,
		);

		return views
			.map((view): TimetableEntry => ({
				occurrenceId: view.occurrence.id,
				courseOfferingId: view.courseOffering.id,
				courseCode: view.course.code,
				courseTitle: view.course.title,
				sectionCode: view.courseOffering.sectionCode,
				instructorNames: view.instructors.map(
					(instructor) => instructor.fullName,
				),
				date: view.occurrence.date.toString(),
				startTime: view.occurrence.startTime.toString(),
				endTime: view.occurrence.endTime.toString(),
				location: view.occurrence.location,
				status: view.occurrence.isActive() ? 'SCHEDULED' : 'CANCELLED',
			}))
			.sort((left, right) => {
				const dateCompare = left.date.localeCompare(right.date);
				if (dateCompare !== 0) return dateCompare;
				return left.startTime.localeCompare(right.startTime);
			});
	}
}
