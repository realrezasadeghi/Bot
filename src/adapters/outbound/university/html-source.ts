import type { UniversityAcademicSnapshot } from "../../../application/dto/university.js";
import type {
  UniversityAcademicSource,
  UniversitySourceRequest,
} from "../../../application/ports/outbound/university-source.js";

export class HTMLUniversitySource implements UniversityAcademicSource {
  constructor() {}

  fetchSnapshot(
    request: UniversitySourceRequest,
  ): Promise<UniversityAcademicSnapshot> {
    
  }
}
