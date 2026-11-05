import type { UniversitySourceRequest } from '../application/ports/outbound/university-source.js';
import type { AppConfig } from './env.js';

/**
 * Projects the university configuration onto the outbound port request.
 *
 * Keeps adapter-only concerns (for example the session cookie) out of the
 * application request, so the domain never depends on transport details.
 *
 * Lives next to the configuration because it is the boundary between
 * configuration and the application's outbound port.
 */
export function toUniversitySourceRequest(
	config: AppConfig['university'],
): UniversitySourceRequest {
	return {
		sourceKey: config.sourceKey,
		offerUrl: config.offerUrl,
		queryParam: config.queryParam,
		queryR: config.queryR,
		termCode: config.termCode,
		viewStateGenerator: config.viewStateGenerator,
		gridInfo: config.gridInfo,
		chkMain: config.chkMain,
		requestTimeoutMs: config.requestTimeoutMs,
		fixturePath: config.fixturePath,
	};
}
