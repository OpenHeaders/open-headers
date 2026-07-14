import type { AuthConfig, HttpMethod, QueryParam, RequestBody, RequestHeader } from '../../types/request';
import type { ImportReport } from '../report';

export interface CurlRequest {
  name: string;
  /**
   * Free-form documentation carried into `Request.description`. curl
   * commands have no doc field, but the structured importers sharing
   * this shape (Postman / Insomnia / Bruno) do — absent when the
   * source carries none.
   */
  description?: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;
  body: RequestBody;
}

export interface CurlParseResult {
  request: CurlRequest;
  report: ImportReport;
}

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurlParseError';
  }
}
