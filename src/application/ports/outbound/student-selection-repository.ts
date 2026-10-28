import type { UserAcademicSelection } from '../../../domain/academic/study-field.js';

export interface ActiveStudentSelection {
	selection: UserAcademicSelection;
	courseOfferingIds: string[];
}

export interface StudentSelectionRepository {
	create(selection: UserAcademicSelection): Promise<UserAcademicSelection>;
	update(selection: UserAcademicSelection): Promise<UserAcademicSelection>;
	findActiveByUserId(userId: string): Promise<UserAcademicSelection | null>;
	findById(id: string): Promise<UserAcademicSelection | null>;
	listActive(): Promise<ActiveStudentSelection[]>;
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
