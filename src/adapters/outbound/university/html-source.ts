import type { UniversityAcademicSnapshot } from "../../../application/dto/university.js";
import type {
  UniversityAcademicSource,
  UniversitySourceRequest,
} from "../../../application/ports/outbound/university-source.js";
import {
  ExternalSourceError,
  ValidationError,
} from "../../../domain/shared/errors.js";

export class HTMLUniversitySource implements UniversityAcademicSource {
  constructor() {}

  async fetchSnapshot(
    request: UniversitySourceRequest,
  ): Promise<UniversityAcademicSnapshot> {
    const html = await this.getHtmlResponse(request);
  }

  async getHtmlResponse(request: UniversitySourceRequest) {
    const url = new URL(request.offerUrl);

    if (!request.queryParam) {
      throw new ValidationError(
        "Query param in HTMLUniversitySource is required",
      );
    }

    if (!request.queryR) {
      throw new ValidationError("Query r in HTMLUniversitySource is required");
    }

    url.searchParams.set("param", request.queryParam);
    url.searchParams.set("r", request.queryR);

    const raw = new URLSearchParams({
      __VIEWSTATEGENERATOR: request.viewStateGenerator,
      HiTerm: request.termCode,
      Name: "",
      Chk_main: String(request.chkMain),
      mx_grid_info: request.gridInfo,
      Term_Drp: request.termCode,
    });

    const response = await fetch(url, {
      signal: AbortSignal.timeout(request.requestTimeoutMs),
      body: raw,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "academic-scheduling-bot/0.1 (inspection)",
      },
    });

    if (!response.ok) {
      throw new ExternalSourceError(
        "Error in fetch university response",
        false,
      );
    }

    return response.text();
  }
}
