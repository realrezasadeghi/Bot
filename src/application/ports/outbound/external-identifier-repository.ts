export type ExternalEntityType =
	| 'ACADEMIC_LEVEL'
	| 'FIELD_OF_STUDY'
	| 'ACADEMIC_TERM'
	| 'ACADEMIC_PROGRAM'
	| 'PROGRAM_OFFERING'
	| 'COURSE'
	| 'INSTRUCTOR'
	| 'COURSE_OFFERING'
	| 'MEETING_PATTERN'
	| 'SCHEDULE_EXCEPTION';

export interface ExternalIdentifierRepository {
	record(input: {
		entityType: ExternalEntityType;
		internalId: string;
		sourceKey: string;
		externalId: string;
	}): Promise<void>;

	findInternalId(input: {
		entityType: ExternalEntityType;
		sourceKey: string;
		externalId: string;
	}): Promise<string | null>;
}
