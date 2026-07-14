import type { AuthConfig, HttpMethod, QueryParam, RequestBody, RequestHeader } from '../../types/request';
import type { ImportReport } from '../report';

/**
 * Per-request execution settings an importer mapped from its source
 * (e.g. Postman's `protocolProfileBehavior`). Field names and value
 * semantics mirror the `Request` schema knobs one-for-one so consumers
 * spread the object straight into a request seed.
 */
export interface ImportedRequestSettings {
  sslVerification?: boolean;
  followRedirects?: boolean;
  maxRedirects?: number;
  followOriginalHttpMethod?: boolean;
  followAuthorizationHeader?: boolean;
}

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
  /**
   * Execution-settings knobs mapped from the source, absent when the
   * source carries none. Spread into the request seed as-is.
   */
  settings?: ImportedRequestSettings;
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
