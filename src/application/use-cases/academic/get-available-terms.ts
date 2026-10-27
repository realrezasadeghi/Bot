import type { AcademicTerm } from '../../../domain/academic/entities.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export class GetAvailableTerms {
	constructor(private readonly uow: UnitOfWork) {}

	async execute(): Promise<AcademicTerm[]> {
		return this.uow.run(async (repositories) => {
			const terms = await repositories.academic.listTerms();
			return terms.sort((left, right) => {
				if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
				return right.externalCode.localeCompare(left.externalCode);
			});
		});
	}
}
