import { describe, expect, it } from 'vitest';
import {
	StudyField,
	StudyFieldOfferingMapping,
	UserAcademicSelection,
} from '../../../src/domain/academic/study-field.js';

describe('StudyField', () => {
	it('creates with all fields', () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			description: 'Computer engineering program',
			academicLevelId: 'level-1',
			isActive: true,
			sortOrder: 1,
		});

		expect(field.id).toBe('field-1');
		expect(field.name).toBe('Computer Engineering');
		expect(field.code).toBe('COMP-ENG');
		expect(field.description).toBe('Computer engineering program');
		expect(field.academicLevelId).toBe('level-1');
		expect(field.isActive).toBe(true);
		expect(field.sortOrder).toBe(1);
	});

	it('defaults isActive to true and sortOrder to 0', () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
		});

		expect(field.isActive).toBe(true);
		expect(field.sortOrder).toBe(0);
		expect(field.description).toBeNull();
	});

	it('defaults description to null', () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
		});

		expect(field.description).toBeNull();
	});

	it('activate sets isActive to true', () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
			isActive: false,
		});

		const activated = field.activate();
		expect(activated.isActive).toBe(true);
		expect(field.isActive).toBe(false); // original unchanged
	});

	it('deactivate sets isActive to false', () => {
		const field = StudyField.create({
			id: 'field-1',
			name: 'Computer Engineering',
			code: 'COMP-ENG',
			academicLevelId: 'level-1',
			isActive: true,
		});

		const deactivated = field.deactivate();
		expect(deactivated.isActive).toBe(false);
		expect(field.isActive).toBe(true); // original unchanged
	});

	it('throws on empty id', () => {
		expect(() =>
			StudyField.create({
				id: '',
				name: 'Computer Engineering',
				code: 'COMP-ENG',
				academicLevelId: 'level-1',
			}),
		).toThrow();
	});

	it('throws on empty name', () => {
		expect(() =>
			StudyField.create({
				id: 'field-1',
				name: '',
				code: 'COMP-ENG',
				academicLevelId: 'level-1',
			}),
		).toThrow();
	});

	it('throws on empty code', () => {
		expect(() =>
			StudyField.create({
				id: 'field-1',
				name: 'Computer Engineering',
				code: '',
				academicLevelId: 'level-1',
			}),
		).toThrow();
	});

	it('throws on empty academicLevelId', () => {
		expect(() =>
			StudyField.create({
				id: 'field-1',
				name: 'Computer Engineering',
				code: 'COMP-ENG',
				academicLevelId: '',
			}),
		).toThrow();
	});
});

describe('StudyFieldOfferingMapping', () => {
	it('creates with all fields', () => {
		const mapping = StudyFieldOfferingMapping.create({
			id: 'mapping-1',
			studyFieldId: 'field-1',
			courseOfferingExternalKey: 'co-abc-123',
		});

		expect(mapping.id).toBe('mapping-1');
		expect(mapping.studyFieldId).toBe('field-1');
		expect(mapping.courseOfferingExternalKey).toBe('co-abc-123');
	});

	it('throws on empty id', () => {
		expect(() =>
			StudyFieldOfferingMapping.create({
				id: '',
				studyFieldId: 'field-1',
				courseOfferingExternalKey: 'co-abc-123',
			}),
		).toThrow();
	});

	it('throws on empty studyFieldId', () => {
		expect(() =>
			StudyFieldOfferingMapping.create({
				id: 'mapping-1',
				studyFieldId: '',
				courseOfferingExternalKey: 'co-abc-123',
			}),
		).toThrow();
	});

	it('throws on empty courseOfferingExternalKey', () => {
		expect(() =>
			StudyFieldOfferingMapping.create({
				id: 'mapping-1',
				studyFieldId: 'field-1',
				courseOfferingExternalKey: '',
			}),
		).toThrow();
	});
});

describe('UserAcademicSelection', () => {
	it('creates with all fields', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
			studyFieldId: 'field-1',
			academicTermId: 'term-1',
			isActive: true,
		});

		expect(selection.id).toBe('selection-1');
		expect(selection.userId).toBe('user-1');
		expect(selection.academicLevelId).toBe('level-1');
		expect(selection.studyFieldId).toBe('field-1');
		expect(selection.academicTermId).toBe('term-1');
		expect(selection.isActive).toBe(true);
	});

	it('defaults null fields to null', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
		});

		expect(selection.academicLevelId).toBeNull();
		expect(selection.studyFieldId).toBeNull();
		expect(selection.academicTermId).toBeNull();
		expect(selection.isActive).toBe(true);
	});

	it('isActive returns active status', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			isActive: false,
		});

		expect(selection.isActive).toBe(false);
		expect(selection.isActive).toBe(false);
	});

	it('withLevel returns new selection with updated level', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicLevelId: 'level-1',
		});

		const updated = selection.withLevel('level-2');
		expect(updated.academicLevelId).toBe('level-2');
		expect(updated.studyFieldId).toBeNull();
		expect(selection.academicLevelId).toBe('level-1'); // original unchanged
		expect(updated.isActive).toBe(true);
		expect(updated.updatedAt).not.toBe(selection.updatedAt);
	});

	it('withField returns new selection with updated field', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			studyFieldId: 'field-1',
		});

		const updated = selection.withField('field-2');
		expect(updated.studyFieldId).toBe('field-2');
		expect(updated.academicLevelId).toBeNull();
		expect(selection.studyFieldId).toBe('field-1'); // original unchanged
	});

	it('withTerm returns new selection with updated term', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			academicTermId: 'term-1',
		});

		const updated = selection.withTerm('term-2');
		expect(updated.academicTermId).toBe('term-2');
		expect(updated.academicLevelId).toBeNull();
		expect(selection.academicTermId).toBe('term-1'); // original unchanged
	});

	it('deactivate returns new selection with isActive false', () => {
		const selection = UserAcademicSelection.create({
			id: 'selection-1',
			userId: 'user-1',
			isActive: true,
		});

		const deactivated = selection.deactivate();
		expect(deactivated.isActive).toBe(false);
		expect(selection.isActive).toBe(true); // original unchanged
	});

	it('throws on empty id', () => {
		expect(() =>
			UserAcademicSelection.create({
				id: '',
				userId: 'user-1',
			}),
		).toThrow();
	});

	it('throws on empty userId', () => {
		expect(() =>
			UserAcademicSelection.create({
				id: 'selection-1',
				userId: '',
			}),
		).toThrow();
	});
});
