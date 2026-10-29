import {
	AcademicLevel,
	AcademicProgram,
	AcademicTerm,
	Course,
	CourseOffering,
	FieldOfStudy,
	Instructor,
	MeetingPattern,
	ProgramOffering,
} from '../../../domain/academic/entities.js';
import { CourseExamination } from '../../../domain/academic/examination.js';
import type { ScheduleExceptionType } from '../../../domain/academic/schedule-exception.js';
import { ScheduleException } from '../../../domain/academic/schedule-exception.js';
import {
	type SyncRunStats,
	SyncRunStatus,
} from '../../../domain/academic/sync-run.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import type { Weekday } from '../../../domain/shared/weekday.js';
import {
	type UniversityAcademicSnapshot,
	UniversitySnapshotValidationError,
} from '../../dto/university.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { ExternalEntityType } from '../../ports/outbound/external-identifier-repository.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import { validateUniversitySnapshot } from '../../services/snapshot-validator.js';

/**
 * When the new snapshot has fewer course offerings than this fraction of the
 * last good sync, destructive reconciliation is skipped to preserve the last
 * known good dataset. A value of 0.5 means the new snapshot must have at least
 * half as many offerings as the last good sync before deactivating anything.
 */
const DESTRUCTIVE_REDUCTION_THRESHOLD = 0.5;

export interface SynchronizationResult {
	syncRunId: string;
	status: SyncRunStatus;
	stats: SyncRunStats;
	warnings: string[];
	complete: boolean;
	reconcileAbsent: boolean;
}

function parseDate(value: string | null): LocalDate | null {
	return value === null ? null : LocalDate.parse(value);
}

/**
 * Decides whether destructive reconciliation (deactivating records absent from
 * the new snapshot) is safe to apply.
 *
 * Destructive reconciliation is skipped when:
 * - The snapshot is not marked complete, or
 * - There is no previous good sync (first sync is always safe), or
 * - The new snapshot has zero offerings when the last good sync had some, or
 * - The new snapshot has fewer than 50% of the last good sync's offerings
 *   (unexpectedly reduced dataset).
 */
function shouldAllowDestructive(
	snapshot: UniversityAcademicSnapshot,
	lastGoodOfferings: number,
): boolean {
	if (!snapshot.complete) return false;
	if (lastGoodOfferings === 0) return true;
	if (snapshot.courseOfferings.length === 0) return false;
	return (
		snapshot.courseOfferings.length /
			lastGoodOfferings >=
		DESTRUCTIVE_REDUCTION_THRESHOLD
	);
}

export class SynchronizeAcademicData {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
			logger: Logger;
		},
	) {}

	async execute(
		snapshot: UniversityAcademicSnapshot,
	): Promise<SynchronizationResult> {
		// --- Validation: reject invalid snapshots before touching data ---
		try {
			validateUniversitySnapshot(snapshot);
		} catch (error) {
			if (error instanceof UniversitySnapshotValidationError) {
				const syncRunId = this.deps.ids.next();
				const startedAt = this.deps.clock.now();
				const finishedAt = this.deps.clock.now();

				await this.deps.uow.run((repositories) =>
					repositories.syncRuns.start({
						id: syncRunId,
						sourceKey: snapshot.sourceKey,
						startedAt,
					}),
				);
				await this.deps.uow.run((repositories) =>
					repositories.syncRuns.finish({
						id: syncRunId,
						status: SyncRunStatus.Rejected,
						finishedAt,
						stats: null,
						errorSummary: `Snapshot validation rejected: ${error.issues.join('; ')}`,
					}),
				);

				this.deps.logger.error(
					{
						syncRunId,
						sourceKey: snapshot.sourceKey,
						issues: error.issues,
					},
					'University snapshot rejected before synchronization',
				);
			}
			throw error;
		}

		const syncRunId = this.deps.ids.next();
		const startedAt = this.deps.clock.now();

		// --- Determine if destructive reconciliation is safe ---
		const lastGood = await this.deps.uow.run((repositories) =>
			repositories.syncRuns.findLatestGood(snapshot.sourceKey),
		);
		const lastGoodOfferings = lastGood?.stats?.courseOfferings ?? 0;
		const allowDestructive = shouldAllowDestructive(
			snapshot,
			lastGoodOfferings,
		);

		if (!allowDestructive && lastGoodOfferings > 0) {
			this.deps.logger.warn(
				{
					sourceKey: snapshot.sourceKey,
					lastGoodOfferings,
					newOfferings: snapshot.courseOfferings.length,
					complete: snapshot.complete,
				},
				'Skipping destructive reconciliation: new snapshot is unexpectedly reduced; preserving last known good data',
			);
		}

		// --- Record sync run start ---
		await this.deps.uow.run((repositories) =>
			repositories.syncRuns.start({
				id: syncRunId,
				sourceKey: snapshot.sourceKey,
				startedAt,
			}),
		);

		const stats: SyncRunStats = {
			levels: 0,
			fields: 0,
			terms: 0,
			programs: 0,
			programOfferings: 0,
			courses: 0,
			instructors: 0,
			courseOfferings: 0,
			meetingPatterns: 0,
			scheduleExceptions: 0,
			examinations: 0,
			occurrencesCreated: 0,
			occurrencesUpdated: 0,
			occurrencesCancelled: 0,
			warnings: snapshot.warnings.length,
		};

		try {
			await this.deps.uow.run(async (repositories) => {
				const recordExternalId = async (
					entityType: ExternalEntityType,
					internalId: string,
					externalId: string,
				) => {
					await repositories.externalIds.record({
						entityType,
						internalId,
						sourceKey: snapshot.sourceKey,
						externalId,
					});
				};

				const term = await repositories.academic.upsertTerm(
					AcademicTerm.create({
						id: this.deps.ids.next(),
						externalCode: snapshot.term.externalCode,
						title: snapshot.term.title,
						startsOn: parseDate(snapshot.term.startsOn),
						endsOn: parseDate(snapshot.term.endsOn),
						isActive: snapshot.term.isActive,
					}),
				);
				stats.terms += 1;
				await recordExternalId(
					'ACADEMIC_TERM',
					term.id,
					snapshot.term.externalCode,
				);

				const levelsByExternalKey = new Map<string, AcademicLevel>();
				for (const levelDto of snapshot.levels) {
					const level = await repositories.academic.upsertLevel(
						AcademicLevel.create({
							id: this.deps.ids.next(),
							code: levelDto.code,
							title: levelDto.title,
						}),
					);
					levelsByExternalKey.set(levelDto.externalKey, level);
					stats.levels += 1;
					await recordExternalId(
						'ACADEMIC_LEVEL',
						level.id,
						levelDto.externalKey,
					);
				}

				const fieldsByExternalKey = new Map<string, FieldOfStudy>();
				for (const fieldDto of snapshot.fields) {
					const level = levelsByExternalKey.get(fieldDto.levelExternalKey);
					if (!level) {
						throw new UniversitySnapshotValidationError(
							`Missing level ${fieldDto.levelExternalKey} for field ${fieldDto.externalKey}`,
						);
					}
					const field = await repositories.academic.upsertFieldOfStudy(
						FieldOfStudy.create({
							id: this.deps.ids.next(),
							levelId: level.id,
							code: fieldDto.code,
							title: fieldDto.title,
						}),
					);
					fieldsByExternalKey.set(fieldDto.externalKey, field);
					stats.fields += 1;
					await recordExternalId(
						'FIELD_OF_STUDY',
						field.id,
						fieldDto.externalKey,
					);
				}

				const programsByExternalKey = new Map<string, AcademicProgram>();
				for (const programDto of snapshot.programs) {
					const level = levelsByExternalKey.get(programDto.levelExternalKey);
					const field = fieldsByExternalKey.get(programDto.fieldExternalKey);
					if (!level || !field) {
						throw new UniversitySnapshotValidationError(
							`Missing level or field for program ${programDto.externalKey}`,
						);
					}
					const program = await repositories.academic.upsertProgram(
						AcademicProgram.create({
							id: this.deps.ids.next(),
							levelId: level.id,
							fieldOfStudyId: field.id,
							code: programDto.code,
							title: programDto.title,
						}),
					);
					programsByExternalKey.set(programDto.externalKey, program);
					stats.programs += 1;
					await recordExternalId(
						'ACADEMIC_PROGRAM',
						program.id,
						programDto.externalKey,
					);
				}

				const programOfferingsByExternalKey =
					new Map<string, ProgramOffering>();
				for (const offeringDto of snapshot.programOfferings) {
					const program = programsByExternalKey.get(
						offeringDto.programExternalKey,
					);
					if (!program) {
						throw new UniversitySnapshotValidationError(
							`Missing program ${offeringDto.programExternalKey} for program offering ${offeringDto.externalKey}`,
						);
					}
					const offering = await repositories.academic.upsertProgramOffering(
						ProgramOffering.create({
							id: this.deps.ids.next(),
							programId: program.id,
							termId: term.id,
							externalKey: offeringDto.externalKey,
							title: offeringDto.title,
						}),
					);
					programOfferingsByExternalKey.set(
						offeringDto.externalKey,
						offering,
					);
					stats.programOfferings += 1;
					await recordExternalId(
						'PROGRAM_OFFERING',
						offering.id,
						offeringDto.externalKey,
					);
				}

				const coursesByExternalKey = new Map<string, Course>();
				for (const courseDto of snapshot.courses) {
					const course = await repositories.academic.upsertCourse(
						Course.create({
							id: this.deps.ids.next(),
							code: courseDto.code,
							title: courseDto.title,
							units: courseDto.units,
						}),
					);
					coursesByExternalKey.set(courseDto.externalKey, course);
					stats.courses += 1;
					await recordExternalId(
						'COURSE',
						course.id,
						courseDto.externalKey,
					);
				}

				const instructorsByExternalKey = new Map<string, Instructor>();
				for (const instructorDto of snapshot.instructors) {
					const instructor = await repositories.academic.upsertInstructor(
						Instructor.create({
							id: this.deps.ids.next(),
							externalKey: instructorDto.externalKey,
							fullName: instructorDto.fullName,
						}),
					);
					instructorsByExternalKey.set(
						instructorDto.externalKey,
						instructor,
					);
					stats.instructors += 1;
					await recordExternalId(
						'INSTRUCTOR',
						instructor.id,
						instructorDto.externalKey,
					);
				}

				const offeringIdByExternalKey = new Map<string, string>();
				const patternIdByOfferingAndIndex = new Map<string, string>();
				const syncedCourseOfferingIds: string[] = [];

				for (const offeringDto of snapshot.courseOfferings) {
					const course = coursesByExternalKey.get(
						offeringDto.courseExternalKey,
					);
					if (!course) {
						throw new UniversitySnapshotValidationError(
							`Missing course ${offeringDto.courseExternalKey} for course offering ${offeringDto.externalKey}`,
						);
					}

					const programOffering = offeringDto.programOfferingExternalKey
						? programOfferingsByExternalKey.get(
								offeringDto.programOfferingExternalKey,
							)
						: null;
					if (offeringDto.programOfferingExternalKey && !programOffering) {
						throw new UniversitySnapshotValidationError(
							`Missing program offering ${offeringDto.programOfferingExternalKey} for course offering ${offeringDto.externalKey}`,
						);
					}

					const instructorIds = offeringDto.instructorExternalKeys.map(
						(externalKey) => {
							const instructor = instructorsByExternalKey.get(externalKey);
							if (!instructor) {
								throw new UniversitySnapshotValidationError(
									`Missing instructor ${externalKey} for course offering ${offeringDto.externalKey}`,
								);
							}
							return instructor.id;
						},
					);

					const courseOffering = await repositories.academic.upsertCourseOffering(
						CourseOffering.create({
							id: this.deps.ids.next(),
							courseId: course.id,
							termId: term.id,
							programOfferingId: programOffering?.id ?? null,
							sectionCode: offeringDto.sectionCode,
							instructorIds,
							location: offeringDto.location,
							externalKey: offeringDto.externalKey,
						}),
					);
					stats.courseOfferings += 1;
					syncedCourseOfferingIds.push(courseOffering.id);
					offeringIdByExternalKey.set(
						offeringDto.externalKey,
						courseOffering.id,
					);
					await recordExternalId(
						'COURSE_OFFERING',
						courseOffering.id,
						offeringDto.externalKey,
					);

					const patternIds: string[] = [];
					for (const [
						patternIndex,
						patternDto,
					] of offeringDto.meetingPatterns.entries()) {
						const pattern = await repositories.academic.upsertMeetingPattern(
							MeetingPattern.create({
								id: this.deps.ids.next(),
								courseOfferingId: courseOffering.id,
								weekday: patternDto.weekday as Weekday,
								startTime: LocalTime.parse(patternDto.startTime),
								endTime: LocalTime.parse(patternDto.endTime),
								location: patternDto.location ?? offeringDto.location,
								effectiveFrom: parseDate(patternDto.effectiveFrom),
								effectiveTo: parseDate(patternDto.effectiveTo),
								isActive: true,
							}),
						);
						patternIds.push(pattern.id);
						patternIdByOfferingAndIndex.set(
							`${offeringDto.externalKey}|${patternIndex}`,
							pattern.id,
						);
						stats.meetingPatterns += 1;
					}

					if (allowDestructive) {
						await repositories.academic.deactivateMeetingPatternsNotIn(
							courseOffering.id,
							patternIds,
						);
					}
				}

				if (
					allowDestructive &&
					syncedCourseOfferingIds.length > 0
				) {
					await repositories.academic.deactivateCourseOfferingsNotIn(
						term.id,
						syncedCourseOfferingIds,
					);
				}

				const syncedExceptionKeys = new Set<string>();
				for (const exceptionDto of snapshot.scheduleExceptions) {
					const courseOfferingId = offeringIdByExternalKey.get(
						exceptionDto.courseOfferingExternalKey,
					);
					if (!courseOfferingId) {
						throw new UniversitySnapshotValidationError(
							`Missing course offering ${exceptionDto.courseOfferingExternalKey} for schedule exception`,
						);
					}
					const meetingPatternId =
						exceptionDto.meetingPatternIndex === null
							? null
							: (patternIdByOfferingAndIndex.get(
									`${exceptionDto.courseOfferingExternalKey}|${exceptionDto.meetingPatternIndex}`,
								) ?? null);

					const exception = await repositories.academic.upsertScheduleException(
						ScheduleException.create({
							id: this.deps.ids.next(),
							courseOfferingId,
							meetingPatternId,
							date: LocalDate.parse(exceptionDto.date),
							type: exceptionDto.type as ScheduleExceptionType,
							newStartTime: exceptionDto.newStartTime
								? LocalTime.parse(exceptionDto.newStartTime)
								: null,
							newEndTime: exceptionDto.newEndTime
								? LocalTime.parse(exceptionDto.newEndTime)
								: null,
							newLocation: exceptionDto.newLocation,
							reason: exceptionDto.reason,
						}),
					);
					syncedExceptionKeys.add(
						[courseOfferingId, LocalDate.parse(exceptionDto.date).toString()].join(
							'|',
						),
					);
					stats.scheduleExceptions += 1;
					if (exceptionDto.externalKey) {
						await recordExternalId(
							'SCHEDULE_EXCEPTION',
							exception.id,
							exceptionDto.externalKey,
						);
					}
				}

				if (
					allowDestructive &&
					syncedCourseOfferingIds.length > 0
				) {
					await repositories.academic.deleteScheduleExceptionsNotIn(
						term.id,
						[...syncedExceptionKeys],
					);
				}

				const examinations = snapshot.examinations.map(
					(examinationDto) => {
						const courseOfferingId = offeringIdByExternalKey.get(
							examinationDto.courseOfferingExternalKey,
						);
						if (!courseOfferingId) {
							throw new UniversitySnapshotValidationError(
								`Missing course offering ${examinationDto.courseOfferingExternalKey} for examination`,
							);
						}
						return CourseExamination.create({
							id: this.deps.ids.next(),
							courseOfferingId,
							examDate: LocalDate.parse(examinationDto.examDate),
							startTime: examinationDto.startTime
								? LocalTime.parse(examinationDto.startTime)
								: null,
							endTime: examinationDto.endTime
								? LocalTime.parse(examinationDto.endTime)
								: null,
							location: examinationDto.location,
							sourceIdentifier:
								examinationDto.sourceIdentifier ??
								examinationDto.externalKey ??
								null,
						});
					},
				);

				if (examinations.length > 0) {
					await repositories.examinations.upsertMany(examinations);
					stats.examinations += examinations.length;
				}

				if (
					allowDestructive &&
					syncedCourseOfferingIds.length > 0
				) {
					await repositories.examinations.deactivateByCourseOfferingIdsNotIn(
						syncedCourseOfferingIds,
						examinations
							.map((examination) => examination.sourceIdentifier)
							.filter(
								(identifier): identifier is string =>
									identifier !== null,
							),
					);
				}
			});

			const finishedAt = this.deps.clock.now();
			await this.deps.uow.run((repositories) =>
				repositories.syncRuns.finish({
					id: syncRunId,
					status: SyncRunStatus.Completed,
					finishedAt,
					stats,
					errorSummary: null,
				}),
			);

			this.deps.logger.info(
				{
					syncRunId,
					stats,
					complete: snapshot.complete,
					reconcileAbsent: allowDestructive,
				},
				'Academic synchronization completed',
			);

			return {
				syncRunId,
				status: SyncRunStatus.Completed,
				stats,
				warnings: snapshot.warnings,
				complete: snapshot.complete,
				reconcileAbsent: allowDestructive,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.deps.uow.run((repositories) =>
				repositories.syncRuns.finish({
					id: syncRunId,
					status: SyncRunStatus.Failed,
					finishedAt: this.deps.clock.now(),
					stats,
					errorSummary: message,
				}),
			);
			this.deps.logger.error(
				{ syncRunId, error: message },
				'Academic synchronization failed; previous data preserved',
			);
			throw error;
		}
	}
}
