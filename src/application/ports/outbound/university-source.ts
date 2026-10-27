import type { UniversityAcademicSnapshot } from '../../dto/university.js';

export interface UniversitySourceRequest {
	sourceKey: string;
	offerUrl: string;
	queryParam?: string;
	queryR?: string;
	termCode: string;
	viewStateGenerator: string;
	gridInfo: string;
	chkMain: boolean;
	requestTimeoutMs: number;
	fixturePath?: string;
}

export interface UniversityAcademicSource {
	fetchSnapshot(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot>;
}
