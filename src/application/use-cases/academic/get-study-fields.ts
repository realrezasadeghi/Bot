import type { StudyField } from '../../../domain/academic/study-field.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export class GetStudyFields {
	constructor(private readonly uow: UnitOfWork) {}

	async execute(levelId?: string): Promise<StudyField[]> {
		return this.uow.run(async (repositories) => {
			const fields = await repositories.studyFields.listByLevel(levelId ?? '');
			return fields.filter((field) => field.isActive);
		});
	}
}
