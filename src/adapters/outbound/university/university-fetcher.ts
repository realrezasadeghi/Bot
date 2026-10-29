import type { UniversitySourceRequest } from '../../../application/ports/outbound/university-source.js';
import { ExternalSourceError } from '../../../domain/shared/errors.js';

export interface FetcherConfig {
	offerUrl: string;
	queryParam: string;
	queryR: string;
	termCode: string;
	viewStateGenerator: string;
	gridInfo: string;
	chkMain: boolean;
	requestTimeoutMs: number;
	cookie?: string;
}

export interface FetcherResponse {
	html: string;
	termCode: string;
}

export class UniversityFetcher {
	private readonly config: FetcherConfig;

	constructor(config: FetcherConfig) {
		this.config = config;
	}

	async fetch(request: UniversitySourceRequest): Promise<FetcherResponse> {
		const url = new URL(request.offerUrl || this.config.offerUrl);

		url.searchParams.set(
			this.config.queryParam,
			request.termCode || this.config.termCode,
		);
		url.searchParams.set('r', this.config.queryR);

		const body = new URLSearchParams({
			__VIEWSTATEGENERATOR: this.config.viewStateGenerator,
			HiTerm: request.termCode || this.config.termCode,
			Name: '',
			Chk_main: String(this.config.chkMain),
			mx_grid_info: this.config.gridInfo,
			Term_Drp: request.termCode || this.config.termCode,
		});

		let response: Response;
		try {
			const headers: Record<string, string> = {
				accept: 'text/html,application/xhtml+xml',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
			};

			if (this.config.cookie) headers.cookie = this.config.cookie;

			response = await fetch(url, {
				signal: AbortSignal.timeout(this.config.requestTimeoutMs),
				method: 'POST',
				body,
				headers,
			});

			if (!response.ok) {
				throw new ExternalSourceError(
					`University endpoint returned HTTP ${response.status}`,
					response.status >= 500,
				);
			}

			const contentType = response.headers.get('content-type') ?? '';
			if (
				!contentType.includes('text/html') &&
				!contentType.includes('application/xhtml')
			) {
				throw new ExternalSourceError(
					`University endpoint returned unexpected content type: ${response.headers.get('content-type')}`,
					false,
				);
			}

			const html = await response.text();

			if (!html || html.trim().length === 0) {
				throw new ExternalSourceError(
					'University endpoint returned an empty response',
					true,
				);
			}

			return { html, termCode: request.termCode || this.config.termCode };
		} catch (error) {
			if (error instanceof ExternalSourceError) throw error;
			const message = error instanceof Error ? error.message : String(error);
			throw new ExternalSourceError(`University request failed: ${message}`, true);
		}
	}
}
