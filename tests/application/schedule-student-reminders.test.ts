import { describe, expect, it, vi } from 'vitest';
import type { Repositories } from '../../src/application/ports/outbound/unit-of-work.js';
import { ScheduleClassReminders } from '../../src/application/use-cases/notifications/schedule-class-reminders.js';
import { ScheduleExamReminders } from '../../src/application/use-cases/notifications/schedule-exam-reminders.js';
import { UserAcademicSelection } from '../../src/domain/academic/study-field.js';
import { LocalDate } from '../../src/domain/shared/local-date.js';
import { LocalTime } from '../../src/domain/shared/local-time.js';

const now = new Date('2026-01-10T00:00:00.000Z');

function selection(overrides: { offsetMinutes?: number } = {}) {
	return UserAcademicSelection.create({
		id: 'selection-1',
		userId: 'user-1',
		academicLevelId: 'level-1',
		studyFieldId: 'field-1',
		academicTermId: 'term-1',
		reminderOffsetMinutes: overrides.offsetMinutes ?? 30,
		updatedAt: now,
	});
}

function occurrenceView() {
	const date = LocalDate.parse('2026-01-10');
	const startTime = LocalTime.parse('10:00');
	const endTime = LocalTime.parse('11:00');
	return {
		occurrence: {
			id: 'occurrence-1',
			courseOfferingId: 'co-1',
			date,
			startTime,
			endTime,
			location: 'Room 1',
			isActive: () => true,
		},
		courseOffering: { id: 'co-1' },
		course: { id: 'course-1', code: 'COMP-101', title: 'Programming' },
		instructors: [],
	};
}

function buildRepositories(
	selected: UserAcademicSelection,
	enqueue = vi.fn(async (_job: unknown) => ({ created: true, job: null })),
) {
	const repositories = {
		subscriptions: {
			listActive: vi.fn(async () => []),
			findActiveByUserId: vi.fn(async () => null),
		},
		studentSelections: {
			listActive: vi.fn(async () => [
				{ selection: selected, courseOfferingIds: ['co-1'] },
			]),
		},
		users: {
			findUserById: vi.fn(async () => ({
				id: 'user-1',
				timeZone: 'UTC',
			})),
			findPreferredIdentityForUser: vi.fn(async () => ({
				id: 'identity-1',
				userId: 'user-1',
			})),
		},
		occurrences: {
			listFutureScheduledForCourses: vi.fn(async () => [occurrenceView()]),
		},
		jobs: {
			enqueue,
			cancelPendingBySubscription: vi.fn(async () => 0),
		},
	} as unknown as Repositories;
	return { repositories, enqueue };
}

function buildUow(repositories: Repositories) {
	return {
		run: async <T>(work: (repos: Repositories) => Promise<T>) =>
			work(repositories),
	} as never;
}

const logger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
} as never;

describe('student selection reminders', () => {
	it('creates a personalized class reminder job for a selection', async () => {
		const { repositories, enqueue } = buildRepositories(selection());
		const useCase = new ScheduleClassReminders({
			uow: buildUow(repositories),
			ids: { next: () => 'job-1' } as never,
			clock: { now: () => now },
			logger,
			horizonDays: 7,
		});

		const result = await useCase.execute();

		expect(result.jobsCreated).toBe(1);
		const job = enqueue.mock.calls[0]?.[0] as {
			selectionId: string;
			subscriptionId: string | null;
			dueAt: Date;
		};
		expect(job.selectionId).toBe('selection-1');
		expect(job.subscriptionId).toBeNull();
		expect(job.dueAt.toISOString()).toBe('2026-01-10T09:30:00.000Z');
	});

	it('skips selections with reminders disabled', async () => {
		const disabled = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
			classReminderEnabled: false,
			updatedAt: now,
		});
		const { repositories, enqueue } = buildRepositories(disabled);
		const useCase = new ScheduleClassReminders({
			uow: buildUow(repositories),
			ids: { next: () => 'job-1' } as never,
			clock: { now: () => now },
			logger,
			horizonDays: 7,
		});

		const result = await useCase.execute();

		expect(result.jobsCreated).toBe(0);
		expect(enqueue).not.toHaveBeenCalled();
	});

	it('does not schedule exam reminders while the data source is disabled', async () => {
		const listActive = vi.fn();
		const useCase = new ScheduleExamReminders({
			uow: {
				run: async () => {
					listActive();
				},
			} as never,
			ids: { next: () => 'job-1' } as never,
			clock: { now: () => now },
			logger,
			enabled: false,
			horizonDays: 7,
			offsetsMinutes: [1440, 60],
		});

		const result = await useCase.execute();

		expect(result.enabled).toBe(false);
		expect(result.jobsCreated).toBe(0);
		expect(listActive).not.toHaveBeenCalled();
	});
});
