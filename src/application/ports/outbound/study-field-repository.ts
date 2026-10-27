import type {
	StudyField,
	StudyFieldOfferingMapping,
	UserAcademicSelection,
} from '../../../domain/academic/study-field.js';

export interface StudyFieldRepository {
	create(field: StudyField): Promise<StudyField>;
	update(field: StudyField): Promise<StudyField>;
	findById(id: string): Promise<StudyField | null>;
	findByCode(code: string): Promise<StudyField | null>;
	listByLevel(levelId?: string): Promise<StudyField[]>;
	listActive(): Promise<StudyField[]>;
	deactivate(id: string): Promise<void>;
}

export interface StudyFieldOfferingMappingRepository {
	create(mapping: StudyFieldOfferingMapping): Promise<StudyFieldOfferingMapping>;
	deleteByField(fieldId: string): Promise<void>;
	deleteByOfferingExternalKey(courseOfferingExternalKey: string): Promise<void>;
	listByField(fieldId: string): Promise<StudyFieldOfferingMapping[]>;
	listByOfferingExternalKey(
		courseOfferingExternalKey: string,
	): Promise<StudyFieldOfferingMapping[]>;
}

export interface StudentSelectionRepository {
	create(selection: UserAcademicSelection): Promise<UserAcademicSelection>;
	update(selection: UserAcademicSelection): Promise<UserAcademicSelection>;
	findActiveByUserId(userId: string): Promise<UserAcademicSelection | null>;
	findById(id: string): Promise<UserAcademicSelection | null>;
	deactivateByUserId(userId: string): Promise<void>;
	addSelectedOffering(
		selectionId: string,
		courseOfferingId: string,
	): Promise<void>;
	removeSelectedOffering(
		selectionId: string,
		courseOfferingId: string,
	): Promise<void>;
	listSelectedOfferings(selectionId: string): Promise<string[]>;
	replaceSelectedOfferings(
		selectionId: string,
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<void>;
}
