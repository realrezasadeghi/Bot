import { load } from 'cheerio';
import type {
	UniversityAcademicSnapshot,
	UniversityProgramOfferingDto,
} from '../../../application/dto/university.js';
import type {
	UniversityAcademicSource,
	UniversitySourceRequest,
} from '../../../application/ports/outbound/university-source.js';
import { UniversityFetcher } from './university-fetcher.js';
import { buildSnapshot } from './university-mapper.js';
import type { ParsedRow } from './university-parser.js';
import {
	detectColumnIndices,
	isLikelyErrorOrLoginPage,
	parseRow,
} from './university-parser.js';

export interface HTMLUniversitySourceConfig {
	sourceKey: string;
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

export class HTMLUniversitySource implements UniversityAcademicSource {
	private readonly fetcher: UniversityFetcher;
	private readonly sourceKey: string;
	private readonly termCode: string;

	constructor(config: HTMLUniversitySourceConfig) {
		this.fetcher = new UniversityFetcher({
			offerUrl: config.offerUrl,
			queryParam: config.queryParam,
			queryR: config.queryR,
			termCode: config.termCode,
			viewStateGenerator: config.viewStateGenerator,
			gridInfo: config.gridInfo,
			chkMain: config.chkMain,
			requestTimeoutMs: config.requestTimeoutMs,
			cookie: config.cookie,
		});
		this.sourceKey = config.sourceKey;
		this.termCode = config.termCode;
	}

	async fetchSnapshot(
		request: UniversitySourceRequest,
	): Promise<UniversityAcademicSnapshot> {
		const { html } = await this.fetcher.fetch(request);
		return this.parseHtml(html, request);
	}

	async getHtmlResponse(request: UniversitySourceRequest): Promise<string> {
		const { html } = await this.fetcher.fetch(request);
		return html;
	}

	private parseHtml(
		html: string,
		request: UniversitySourceRequest,
	): UniversityAcademicSnapshot {
		const $ = load(html);
		const warnings: string[] = [];

		if (isLikelyErrorOrLoginPage($)) {
			warnings.push('University response appears to be a login or error page');
			return this.buildIncompleteSnapshot(request, warnings);
		}

		const columns = detectColumnIndices($);
		if (!columns) {
			warnings.push('No course table found in university HTML response');
			return this.buildIncompleteSnapshot(request, warnings);
		}

		const rows: ParsedRow[] = [];
		let unparsedRowCount = 0;

		$('tr').each((_index, el) => {
			if (_index === 0) return;

			const parsed = parseRow($, el, columns);
			if (parsed) {
				rows.push(parsed);
			} else {
				unparsedRowCount += 1;
			}
		});

		if (rows.length === 0) {
			warnings.push(
				unparsedRowCount > 0
					? `Found ${unparsedRowCount} table row(s) but none could be parsed`
					: 'No course rows found in university HTML',
			);
			return this.buildIncompleteSnapshot(request, warnings);
		}

		if (unparsedRowCount > 0) {
			warnings.push(
				`${unparsedRowCount} table row(s) could not be parsed and were skipped`,
			);
		}

		return buildSnapshot(rows, request, this.sourceKey, this.termCode, warnings);
	}

	private buildIncompleteSnapshot(
		request: UniversitySourceRequest,
		warnings: string[],
	): UniversityAcademicSnapshot {
		return {
			sourceKey: request.sourceKey || this.sourceKey,
			fetchedAt: new Date(),
			complete: false,
			term: {
				externalCode: request.termCode ?? this.termCode,
				title: `Term ${request.termCode ?? this.termCode}`,
				startsOn: null,
				endsOn: null,
				isActive: true,
			},
			levels: [],
			fields: [],
			programs: [],
			programOfferings: [],
			courses: [],
			instructors: [],
			courseOfferings: [],
			scheduleExceptions: [],
			examinations: [],
			warnings,
		};
	}
}

export function createHTMLUniversitySource(
	config: HTMLUniversitySourceConfig,
): HTMLUniversitySource {
	return new HTMLUniversitySource(config);
}

export type { UniversityProgramOfferingDto };
