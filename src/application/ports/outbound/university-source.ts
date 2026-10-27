import type { UniversityAcademicSnapshot } from "../../dto/university.js";

export interface UniversitySourceRequest {
  termCode: string;
}

export interface UniversityAcademicSource {
  fetchSnapshot(request: UniversitySourceRequest): Promise<UniversityAcademicSnapshot>;
}
