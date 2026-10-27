import type { StudyFieldOfferingMapping } from '../../../domain/academic/study-field.js';

export interface StudyFieldOfferingMappingRepository {
	create(mapping: StudyFieldOfferingMapping): Promise<StudyFieldOfferingMapping>;
	deleteByField(fieldId: string): Promise<void>;
	deleteByOfferingExternalKey(courseOfferingExternalKey: string): Promise<void>;
	listByField(fieldId: string): Promise<StudyFieldOfferingMapping[]>;
	listByOfferingExternalKey(
		courseOfferingExternalKey: string,
	): Promise<StudyFieldOfferingMapping[]>;
}
