import type { UniversityAcademicSnapshot } from '../../../application/dto/university.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../../application/ports/outbound/university-source.js';
import { ConfigurationError } from '../../../config/env.js';

export class UnavailableUniversitySource implements UniversityAcademicSource {
	async fetchSnapshot(
		_request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		throw new ConfigurationError(
			'No university source is configured. Set UNIVERSITY_HTML_FIXTURE_PATH to a normalized snapshot fixture, ' +
				'or implement and verify the HTML adapter with a real portal response.',
		);
	}
}
