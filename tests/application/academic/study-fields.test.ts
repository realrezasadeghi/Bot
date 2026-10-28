import { describe, expect, it, vi } from 'vitest';
import type { Repositories } from '../../../src/application/ports/outbound/unit-of-work.js';
import { GetAvailableCourseOfferings } from '../../../src/application/use-cases/academic/get-available-course-offerings.js';
import { GetStudentTimetable } from '../../../src/application/use-cases/academic/get-student-timetable.js';
import { GetStudyFields } from '../../../src/application/use-cases/academic/get-study-fields.js';
import { SaveStudentCourseSelection } from '../../../src/application/use-cases/academic/save-student-course-selection.js';
import { UpdateStudentCourseSelection } from '../../../src/application/use-cases/academic/update-student-course-selection.js';
import {
	AcademicLevel,
	AcademicTerm,
} from '../../../src/domain/academic/entities.js';
import {
	StudyField,
	UserAcademicSelection,
} from '../../../src/domain/academic/study-field.js';

const now = new Date('2026-01-10T00:00:00.000Z');

function buildRepositories(
	overrides: Record<string, unknown> = {},
): Repositories {
	return {
		academic: {
			listLevels: vi.fn(async () => []),
			listFieldsOfStudy: vi.fn(async () => []),
			listTerms: vi.fn(async () => []),
			getTermById: vi.fn(async () => null),
			getTermByExternalCode: vi.fn(async () => null),
			listProgramOfferings: vi.fn(async () => []),
			getProgramOffering: vi.fn(async () => null),
			listProgramCourseOfferingIds: vi.fn(async () => []),
			listCourseOfferingsByTerm: vi.fn(async () => []),
			getCourseOffering: vi.fn(async () => null),
			listMeetingPatternsByCourseOfferingIds: vi.fn(async () => []),
			listScheduleExceptionsByCourseOfferingIds: vi.fn(async () => []),
			listCourseOfferingIdsByTerm: vi.fn(async () => []),
			upsertLevel: vi.fn(async () => undefined),
			upsertFieldOfStudy: vi.fn(async () => undefined),
			upsertTerm: vi.fn(async () => undefined),
			upsertProgram: vi.fn(async () => undefined),
			upsertProgramOffering: vi.fn(async () => undefined),
			upsertCourse: vi.fn(async () => undefined),
			upsertInstructor: vi.fn(async () => undefined),
			upsertCourseOffering: vi.fn(async () => undefined),
			upsertMeetingPattern: vi.fn(async () => undefined),
			upsertScheduleException: vi.fn(async () => undefined),
			deactivateMeetingPatternsNotIn: vi.fn(async () => []),
			deactivateCourseOfferingsNotIn: vi.fn(async () => []),
			deleteScheduleExceptionsNotIn: vi.fn(async () => 0),
		},
		externalIds: {
			record: vi.fn(async () => undefined),
			findInternalId: vi.fn(async () => null),
			findExternalId: vi.fn(async () => null),
		},
		users: {
			findUserById: vi.fn(async () => null),
			findIdentityById: vi.fn(async () => null),
			findIdentitiesForUser: vi.fn(async () => []),
			findPreferredIdentityForUser: vi.fn(async () => null),
			createUser: vi.fn(async () => undefined),
			updateUser: vi.fn(async () => undefined),
			createIdentity: vi.fn(async () => undefined),
			updateIdentity: vi.fn(async () => undefined),
			findIdentityByIdWithUser: vi.fn(async () => null),
			listIdentitiesForUser: vi.fn(async () => []),
		},
		subscriptions: {
			create: vi.fn(async () => undefined),
			update: vi.fn(async () => undefined),
			findById: vi.fn(async () => null),
			findActiveByUserId: vi.fn(async () => null),
			listActive: vi.fn(async () => []),
			deactivateOtherActiveSubscriptions: vi.fn(async () => 0),
			getPreferenceBySubscriptionId: vi.fn(async () => null),
			upsertPreference: vi.fn(async () => undefined),
		},
		studentSelections: {
			create: vi.fn(async () => undefined),
			update: vi.fn(async () => undefined),
			findActiveByUserId: vi.fn(async () => null),
			findById: vi.fn(async () => null),
			deactivateByUserId: vi.fn(async () => undefined),
			addSelectedOffering: vi.fn(async () => undefined),
			removeSelectedOffering: vi.fn(async () => undefined),
			listSelectedOfferings: vi.fn(async () => []),
			replaceSelectedOfferings: vi.fn(async () => undefined),
		},
		studyFields: {
			create: vi.fn(async () => undefined),
			update: vi.fn(async () => undefined),
			findById: vi.fn(async () => null),
			findByCode: vi.fn(async () => null),
			listByLevel: vi.fn(async () => []),
			listActive: vi.fn(async () => []),
			deactivate: vi.fn(async () => undefined),
		},
		studyFieldOfferingMappings: {
			create: vi.fn(async () => undefined),
			deleteByField: vi.fn(async () => undefined),
			deleteByOfferingExternalKey: vi.fn(async () => undefined),
			listByField: vi.fn(async () => []),
			listByOfferingExternalKey: vi.fn(async () => []),
		},
		occurrences: {
			upsertMany: vi.fn(async () => undefined),
			findById: vi.fn(async () => null),
			listForCourses: vi.fn(async () => []),
			listFutureScheduledForCourses: vi.fn(async () => []),
			cancelFutureNotInKeys: vi.fn(async () => []),
		},
		jobs: {
			enqueue: vi.fn(async () => ({ created: false, job: null })),
			findById: vi.fn(async () => null),
			findByIdForUpdate: vi.fn(async () => null),
			claimDue: vi.fn(async () => []),
			cancelPendingBySubscription: vi.fn(async () => 0),
			cancelPendingByOccurrenceIds: vi.fn(async () => 0),
			save: vi.fn(async () => undefined),
			recordDeliveryAttempt: vi.fn(async () => undefined),
		},
		syncRuns: {
			start: vi.fn(async () => undefined),
			finish: vi.fn(async () => undefined),
			findLatest: vi.fn(async () => null),
		},
		...overrides,
	} as unknown as Repositories;
}

function buildUow(repositories: Repositories) {
	return {
		run: async <T>(work: (repos: Repositories) => Promise<T>) => {
			return work(repositories);
		},
	} as unknown as {
		run: <T>(work: (repos: Repositories) => Promise<T>) => Promise<T>;
	};
}

function buildIds() {
	return {
		next: vi.fn(() => 'id-1'),
	};
}

function buildClock() {
	return {
		now: () => now,
	};
}

const selectionLevel = AcademicLevel.create({
	id: 'level-1',
	code: 'UNDERGRADUATE',
	title: 'Undergraduate',
});

const selectionTerm = AcademicTerm.create({
	id: 'term-1',
	externalCode: '2026-1',
	title: 'First Term 2026',
	isActive: true,
});

const selectionField = StudyField.create({
	id: 'field-1',
	name: 'Computer Engineering',
	code: 'COMP-ENG',
	academicLevelId: 'level-1',
	isActive: true,
	sortOrder: 1,
});

function offeringView(id: string, externalKey: string) {
	return {
		courseOffering: {
			id,
			courseId: `course-${id}`,
			termId: 'term-1',
			programOfferingId: null,
			sectionCode: null,
			instructorIds: [],
			location: null,
			externalKey,
			isActive: true,
		},
		course: {
			id: `course-${id}`,
			code: `COMP-${id}`,
			title: `Course ${id}`,
			units: null,
		},
		instructors: [],
		patterns: [],
	};
}

function validSelectionContext(
	extra: {
		studentSelections?: Record<string, unknown>;
		users?: Record<string, unknown>;
		academic?: Record<string, unknown>;
		studyFields?: Record<string, unknown>;
		studyFieldOfferingMappings?: Record<string, unknown>;
		jobs?: Record<string, unknown>;
	} = {},
) {
	const offeringIds = ['co-1', 'co-2', 'co-3'];
	return {
		users: {
			findUserById: vi.fn(async () => ({ id: 'user-1', timeZone: 'UTC' })),
			...extra.users,
		},
		academic: {
			listLevels: vi.fn(async () => [selectionLevel]),
			getTermById: vi.fn(async () => selectionTerm),
			listCourseOfferingsByIds: vi.fn(async (ids: string[]) =>
				ids.map((id) => offeringView(id, `ext-${id}`)),
			),
			listCourseOfferingsByTerm: vi.fn(async () =>
				offeringIds.map((id) => offeringView(id, `ext-${id}`)),
			),
			...extra.academic,
		},
		studyFields: {
			findById: vi.fn(async () => selectionField),
			listByLevel: vi.fn(async () => [selectionField]),
			...extra.studyFields,
		},
		studyFieldOfferingMappings: {
			listByField: vi.fn(async () =>
				offeringIds.map((id) => ({
					id: `mapping-${id}`,
					studyFieldId: 'field-1',
					courseOfferingExternalKey: `ext-${id}`,
				})),
			),
			...extra.studyFieldOfferingMappings,
		},
		studentSelections: {
			cancelPendingBySelection: vi.fn(async () => 0),
			...extra.studentSelections,
		},
		jobs: {
			cancelPendingBySelection: vi.fn(async () => 0),
			...extra.jobs,
		},
	};
}

describe('GetStudyFields', () => {
	it('returns active study fields for a level', async () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
			isActive: true,
			sortOrder: 1,
		});

		const repositories = buildRepositories({
			studyFields: {
				listByLevel: vi.fn(async () => [field]),
			},
		});

		const useCase = new GetStudyFields(buildUow(repositories));
		const result = await useCase.execute('level-1');

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe('field-1');
		expect(repositories.studyFields.listByLevel).toHaveBeenCalledWith('level-1');
	});

	it('filters out inactive fields', async () => {
		const activeField = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
			isActive: true,
			sortOrder: 1,
		});
		const inactiveField = StudyField.create({
			id: 'field-2',
			name: 'Electrical Engineering',
			code: 'ELEC-ENG',
			academicLevelId: 'level-1',
			isActive: false,
			sortOrder: 2,
		});

		const repositories = buildRepositories({
			studyFields: {
				listByLevel: vi.fn(async () => [activeField, inactiveField]),
			},
		});

		const useCase = new GetStudyFields(buildUow(repositories));
		const result = await useCase.execute('level-1');

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe('field-1');
	});

	it('returns all active fields when no levelId provided', async () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
			isActive: true,
			sortOrder: 1,
		});

		const repositories = buildRepositories({
			studyFields: {
				listByLevel: vi.fn(async () => [field]),
			},
		});

		const useCase = new GetStudyFields(buildUow(repositories));
		const result = await useCase.execute();

		expect(result).toHaveLength(1);
		expect(repositories.studyFields.listByLevel).toHaveBeenCalledWith();
	});
});

describe('SaveStudentCourseSelection', () => {
	it('creates a new selection when none exists', async () => {
		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => null),
					create: vi.fn(async () => undefined),
					replaceSelectedOfferings: vi.fn(async () => undefined),
				},
			}),
		);

		const useCase = new SaveStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await useCase.execute({
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
			selectedCourseOfferingIds: ['co-1', 'co-2'],
		});

		expect(repositories.studentSelections.create).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				academicLevelId: 'level-1',
				studyFieldId: 'field-1',
				academicTermId: 'term-1',
			}),
		);
		expect(
			repositories.studentSelections.replaceSelectedOfferings,
		).toHaveBeenCalledWith(expect.any(String), ['co-1', 'co-2']);
	});

	it('updates existing selection', async () => {
		const existingSelection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: null,
			academicTermId: null,
		});

		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => existingSelection),
					update: vi.fn(async () => undefined),
					replaceSelectedOfferings: vi.fn(async () => undefined),
				},
			}),
		);

		const useCase = new SaveStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await useCase.execute({
			userId: 'user-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
			selectedCourseOfferingIds: ['co-1'],
		});

		expect(repositories.studentSelections.update).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'selection-1',
				studyFieldId: 'field-1',
			}),
		);
		expect(
			repositories.studentSelections.replaceSelectedOfferings,
		).toHaveBeenCalledWith('selection-1', ['co-1']);
	});

	it('preserves existing fields when not provided', async () => {
		const existingSelection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
		});

		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => existingSelection),
					update: vi.fn(async () => undefined),
					replaceSelectedOfferings: vi.fn(async () => undefined),
				},
			}),
		);

		const useCase = new SaveStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await useCase.execute({
			userId: 'user-1',
			selectedCourseOfferingIds: ['co-1'],
		});

		expect(repositories.studentSelections.update).toHaveBeenCalledWith(
			expect.objectContaining({
				academicLevelId: 'level-1',
				studyFieldId: 'field-1',
				academicTermId: 'term-1',
			}),
		);
	});
});

describe('UpdateStudentCourseSelection', () => {
	it('adds and removes course offerings', async () => {
		const existingSelection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
		});

		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => existingSelection),
					listSelectedOfferings: vi.fn(async () => ['co-1', 'co-2']),
					addSelectedOffering: vi.fn(async () => undefined),
					removeSelectedOffering: vi.fn(async () => undefined),
					update: vi.fn(async () => undefined),
				},
			}),
		);

		const useCase = new UpdateStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await useCase.execute({
			userId: 'user-1',
			addCourseOfferingIds: ['co-3'],
			removeCourseOfferingIds: ['co-1'],
		});

		expect(
			repositories.studentSelections.addSelectedOffering,
		).toHaveBeenCalledWith('selection-1', 'co-3');
		expect(
			repositories.studentSelections.removeSelectedOffering,
		).toHaveBeenCalledWith('selection-1', 'co-1');
	});

	it('throws when no active selection exists', async () => {
		const repositories = buildRepositories({
			studentSelections: {
				findActiveByUserId: vi.fn(async () => null),
			},
		});

		const useCase = new UpdateStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await expect(
			useCase.execute({
				userId: 'user-1',
				addCourseOfferingIds: ['co-1'],
			}),
		).rejects.toThrow('No active academic selection for user user-1');
	});
});

describe('GetStudentTimetable', () => {
	it('returns timetable entries for selected offerings', async () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
		});

		const repositories = buildRepositories({
			studentSelections: {
				findActiveByUserId: vi.fn(async () => selection),
				listSelectedOfferings: vi.fn(async () => ['co-1', 'co-2']),
			},
			occurrences: {
				listForCourses: vi.fn(async () => [
					{
						occurrence: {
							id: 'occ-1',
							courseOfferingId: 'co-1',
							date: {
								toString: () => '2026-01-15',
								weekday: () => 3,
								toUtcInstant: () => new Date('2026-01-15T08:00:00.000Z'),
							},
							startTime: {
								toString: () => '08:00',
								minutes: 480,
							},
							endTime: {
								toString: () => '10:00',
								minutes: 600,
							},
							location: 'Room 101',
							isActive: () => true,
							meetingPatternId: 'mp-1',
							status: 'SCHEDULED' as const,
							exceptionId: null,
							generatedAt: now,
						},
						courseOffering: {
							id: 'co-1',
							courseId: 'course-1',
							termId: 'term-1',
							programOfferingId: null,
							sectionCode: null,
							instructorIds: [],
							location: null,
							externalKey: 'co-ext-1',
							isActive: true,
						},
						course: {
							id: 'course-1',
							code: 'COMP-101',
							title: 'Programming Fundamentals',
							units: null,
						},
						instructors: [{ fullName: 'Professor A' }],
					},
				]),
			},
		});

		const useCase = new GetStudentTimetable({
			uow: buildUow(repositories),
			clock: buildClock(),
		});

		const result = await useCase.execute(
			'user-1',
			new Date('2026-01-15T00:00:00.000Z'),
			new Date('2026-01-15T23:59:59.000Z'),
		);

		expect(result).toHaveLength(1);
		expect(result[0]?.courseCode).toBe('COMP-101');
		expect(result[0]?.courseTitle).toBe('Programming Fundamentals');
		expect(result[0]?.instructorNames).toEqual(['Professor A']);
		expect(result[0]?.location).toBe('Room 101');
		expect(result[0]?.status).toBe('SCHEDULED');
	});

	it('returns empty when no active selection', async () => {
		const repositories = buildRepositories({
			studentSelections: {
				findActiveByUserId: vi.fn(async () => null),
			},
		});

		const useCase = new GetStudentTimetable({
			uow: buildUow(repositories),
			clock: buildClock(),
		});

		const result = await useCase.execute(
			'user-1',
			new Date('2026-01-15T00:00:00.000Z'),
			new Date('2026-01-15T23:59:59.000Z'),
		);

		expect(result).toHaveLength(0);
	});

	it('returns empty when no selected offerings', async () => {
		const repositories = buildRepositories({
			studentSelections: {
				findActiveByUserId: vi.fn(async () =>
					UserAcademicSelection.create({
						id: 'selection-1',
						userId: 'user-1',
						academicLevelId: 'level-1',
						studyFieldId: 'field-1',
						academicTermId: 'term-1',
					}),
				),
				listSelectedOfferings: vi.fn(async () => []),
			},
		});

		const useCase = new GetStudentTimetable({
			uow: buildUow(repositories),
			clock: buildClock(),
		});

		const result = await useCase.execute(
			'user-1',
			new Date('2026-01-15T00:00:00.000Z'),
			new Date('2026-01-15T23:59:59.000Z'),
		);

		expect(result).toHaveLength(0);
	});
});

describe('GetAvailableCourseOfferings', () => {
	it('returns offerings mapped to the selected field', async () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
		});

		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => selection),
				},
				studyFieldOfferingMappings: {
					listByField: vi.fn(async () => [
						{
							id: 'mapping-1',
							studyFieldId: 'field-1',
							courseOfferingExternalKey: 'ext-co-1',
						},
					]),
				},
				academic: {
					listCourseOfferingsByTerm: vi.fn(async () => [
						offeringView('co-1', 'ext-co-1'),
					]),
				},
			}),
		);

		const useCase = new GetAvailableCourseOfferings(buildUow(repositories));
		const result = await useCase.execute('user-1');

		expect(result).toHaveLength(1);
		expect(result[0]?.courseOffering.id).toBe('co-1');
	});

	it('returns empty when no selection', async () => {
		const repositories = buildRepositories({
			studentSelections: {
				findActiveByUserId: vi.fn(async () => null),
			},
		});

		const useCase = new GetAvailableCourseOfferings(buildUow(repositories));
		const result = await useCase.execute('user-1');

		expect(result).toHaveLength(0);
	});

	it('returns empty when no field mappings', async () => {
		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () =>
						UserAcademicSelection.create({
							id: 'selection-1',
							userId: 'user-1',
							studyFieldId: 'field-1',
							academicTermId: 'term-1',
						}),
					),
				},
				studyFieldOfferingMappings: {
					listByField: vi.fn(async () => []),
				},
			}),
		);

		const useCase = new GetAvailableCourseOfferings(buildUow(repositories));
		const result = await useCase.execute('user-1');

		expect(result).toHaveLength(0);
	});
});

describe('Student course selection validation', () => {
	it('deduplicates selected course offering IDs', async () => {
		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => null),
					create: vi.fn(async () => undefined),
					replaceSelectedOfferings: vi.fn(async () => undefined),
				},
			}),
		);

		const useCase = new SaveStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await useCase.execute({
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
			selectedCourseOfferingIds: ['co-1', 'co-1', 'co-2'],
		});

		expect(
			repositories.studentSelections.replaceSelectedOfferings,
		).toHaveBeenCalledWith(expect.any(String), ['co-1', 'co-2']);
	});

	it('rejects course offerings that are not mapped to the field', async () => {
		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => null),
					create: vi.fn(async () => undefined),
					replaceSelectedOfferings: vi.fn(async () => undefined),
				},
				academic: {
					listCourseOfferingsByIds: vi.fn(async () => [
						offeringView('co-1', 'unmapped-ext'),
					]),
				},
				studyFieldOfferingMappings: {
					listByField: vi.fn(async () => []),
				},
			}),
		);

		const useCase = new SaveStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await expect(
			useCase.execute({
				userId: 'user-1',
				academicLevelId: 'level-1',
				studyFieldId: 'field-1',
				academicTermId: 'term-1',
				selectedCourseOfferingIds: ['co-1'],
			}),
		).rejects.toThrow('is not mapped to study field');
	});

	it('rejects adding an offering outside the selected term', async () => {
		const existingSelection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
		});

		const repositories = buildRepositories(
			validSelectionContext({
				studentSelections: {
					findActiveByUserId: vi.fn(async () => existingSelection),
					listSelectedOfferings: vi.fn(async () => []),
					update: vi.fn(async () => undefined),
				},
				academic: {
					listCourseOfferingsByIds: vi.fn(async () => [
						{
							...offeringView('co-1', 'ext-co-1'),
							courseOffering: {
								...offeringView('co-1', 'ext-co-1').courseOffering,
								termId: 'term-2',
							},
						},
					]),
				},
			}),
		);

		const useCase = new UpdateStudentCourseSelection({
			uow: buildUow(repositories),
			ids: buildIds(),
			clock: buildClock(),
		});

		await expect(
			useCase.execute({
				userId: 'user-1',
				addCourseOfferingIds: ['co-1'],
			}),
		).rejects.toThrow('does not belong to the selected term');
	});
});
