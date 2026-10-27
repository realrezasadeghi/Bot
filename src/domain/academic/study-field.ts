import { ValidationError } from '../shared/errors.js';

export class StudyField {
	private constructor(
		readonly id: string,
		readonly name: string,
		readonly code: string,
		readonly description: string | null,
		readonly academicLevelId: string,
		readonly isActive: boolean,
		readonly sortOrder: number,
	) {}

	static create(input: {
		id: string;
		name: string;
		code: string;
		description?: string | null;
		academicLevelId: string;
		isActive?: boolean;
		sortOrder?: number;
	}): StudyField {
		return new StudyField(
			requireNonEmpty(input.id, 'StudyField.id'),
			requireNonEmpty(input.name, 'StudyField.name'),
			requireNonEmpty(input.code, 'StudyField.code'),
			input.description ?? null,
			requireNonEmpty(input.academicLevelId, 'StudyField.academicLevelId'),
			input.isActive ?? true,
			input.sortOrder ?? 0,
		);
	}

	activate(): StudyField {
		return StudyField.create({
			id: this.id,
			name: this.name,
			code: this.code,
			description: this.description,
			academicLevelId: this.academicLevelId,
			isActive: true,
			sortOrder: this.sortOrder,
		});
	}

	deactivate(): StudyField {
		return StudyField.create({
			id: this.id,
			name: this.name,
			code: this.code,
			description: this.description,
			academicLevelId: this.academicLevelId,
			isActive: false,
			sortOrder: this.sortOrder,
		});
	}
}

function requireNonEmpty(value: string, field: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new ValidationError(`${field} must not be empty`);
	}
	return trimmed;
}

export class StudyFieldOfferingMapping {
	private constructor(
		readonly id: string,
		readonly studyFieldId: string,
		readonly courseOfferingExternalKey: string,
	) {}

	static create(input: {
		id: string;
		studyFieldId: string;
		courseOfferingExternalKey: string;
	}): StudyFieldOfferingMapping {
		return new StudyFieldOfferingMapping(
			requireNonEmpty(input.id, 'StudyFieldOfferingMapping.id'),
			requireNonEmpty(
				input.studyFieldId,
				'StudyFieldOfferingMapping.studyFieldId',
			),
			requireNonEmpty(
				input.courseOfferingExternalKey,
				'StudyFieldOfferingMapping.courseOfferingExternalKey',
			),
		);
	}
}

export class UserAcademicSelection {
	private constructor(
		readonly id: string,
		readonly userId: string,
		readonly academicLevelId: string | null,
		readonly studyFieldId: string | null,
		readonly academicTermId: string | null,
		readonly isActive: boolean,
		readonly updatedAt: Date,
	) {}

	static create(input: {
		id: string;
		userId: string;
		academicLevelId?: string | null;
		studyFieldId?: string | null;
		academicTermId?: string | null;
		isActive?: boolean;
		updatedAt?: Date;
	}): UserAcademicSelection {
		return new UserAcademicSelection(
			requireNonEmpty(input.id, 'UserAcademicSelection.id'),
			requireNonEmpty(input.userId, 'UserAcademicSelection.userId'),
			input.academicLevelId ?? null,
			input.studyFieldId ?? null,
			input.academicTermId ?? null,
			input.isActive ?? true,
			input.updatedAt ?? new Date(),
		);
	}

	withLevel(levelId: string | null): UserAcademicSelection {
		return UserAcademicSelection.create({
			id: this.id,
			userId: this.userId,
			academicLevelId: levelId,
			studyFieldId: this.studyFieldId,
			academicTermId: this.academicTermId,
			isActive: this.isActive,
			updatedAt: new Date(),
		});
	}

	withField(fieldId: string | null): UserAcademicSelection {
		return UserAcademicSelection.create({
			id: this.id,
			userId: this.userId,
			academicLevelId: this.academicLevelId,
			studyFieldId: fieldId,
			academicTermId: this.academicTermId,
			isActive: this.isActive,
			updatedAt: new Date(),
		});
	}

	withTerm(termId: string | null): UserAcademicSelection {
		return UserAcademicSelection.create({
			id: this.id,
			userId: this.userId,
			academicLevelId: this.academicLevelId,
			studyFieldId: this.studyFieldId,
			academicTermId: termId,
			isActive: this.isActive,
			updatedAt: new Date(),
		});
	}

	deactivate(): UserAcademicSelection {
		return UserAcademicSelection.create({
			id: this.id,
			userId: this.userId,
			academicLevelId: this.academicLevelId,
			studyFieldId: this.studyFieldId,
			academicTermId: this.academicTermId,
			isActive: false,
			updatedAt: new Date(),
		});
	}
}
