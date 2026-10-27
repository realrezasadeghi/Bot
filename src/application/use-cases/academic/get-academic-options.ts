import type {
  AcademicLevel,
  FieldOfStudy,
} from "../../../domain/academic/entities.js";
import type { ProgramSummaryDto } from "../../dto/schedule.js";
import { toProgramSummaryDto } from "../../services/dto-mappers.js";
import type { ProgramOfferingFilter } from "../../ports/outbound/academic-catalog-repository.js";
import type { UnitOfWork } from "../../ports/outbound/unit-of-work.js";

export class GetAvailableLevels {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(): Promise<AcademicLevel[]> {
    return this.uow.run((repositories) => repositories.academic.listLevels());
  }
}

export class GetAvailableFields {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(levelId: string): Promise<FieldOfStudy[]> {
    return this.uow.run((repositories) =>
      repositories.academic.listFieldsOfStudy(levelId),
    );
  }
}

export class GetAvailablePrograms {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(filter: ProgramOfferingFilter = {}): Promise<ProgramSummaryDto[]> {
    const offerings = await this.uow.run((repositories) =>
      repositories.academic.listProgramOfferings(filter),
    );
    return offerings.map(toProgramSummaryDto);
  }
}
