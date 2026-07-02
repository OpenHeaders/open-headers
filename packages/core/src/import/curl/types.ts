import type { AuthConfig, HttpMethod, QueryParam, RequestBody, RequestHeader } from '../../types/request';
import type { ImportReport } from '../report';

export interface CurlRequest {
  name: string;
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
