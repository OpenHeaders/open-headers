import type { CapturedRequest, CapturedResponse } from '../../types/response-example';
import type { CurlRequest } from '../curl';
import type { ImportReport } from '../report';

// ── Types we read (subset of Postman Collection v2.1) ──────────────

export interface PostmanCollection {
  info?: {
    name?: string;
    description?: string | { content?: string };
    _postman_id?: string;
    schema?: string;
  };
  item?: PostmanItem[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
  event?: PostmanEvent[];
  protocolProfileBehavior?: unknown;
}

export interface PostmanItem {
  name?: string;
  description?: string | { content?: string };
  item?: PostmanItem[];
  request?: PostmanRequest | string;
  event?: PostmanEvent[];
  response?: PostmanSavedResponse[];
  auth?: PostmanAuth;
  protocolProfileBehavior?: unknown;
}

export interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
  description?: string | { content?: string };
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  path?: string | string[];
  port?: string;
  query?: Array<{ key?: string; value?: string; disabled?: boolean; description?: string }>;
  variable?: Array<{ key?: string; value?: string; description?: string }>;
  hash?: string;
}

export interface PostmanHeader {
  key?: string;
  value?: string;
  disabled?: boolean;
  type?: string;
  description?: string | { content?: string };
}

export interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'binary' | string;
  raw?: string;
  urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean; description?: string }>;
  formdata?: Array<{
    key?: string;
    value?: string;
    type?: 'text' | 'file' | string;
    src?: string | string[];
    disabled?: boolean;
    description?: string;
  }>;
  file?: { src?: string; content?: string };
  graphql?: { query?: string; variables?: string };
  options?: {
    raw?: { language?: string };
  };
  disabled?: boolean;
}

export interface PostmanAuth {
  type?:
    | 'noauth'
    | 'basic'
    | 'bearer'
    | 'apikey'
    | 'oauth1'
    | 'oauth2'
    | 'digest'
    | 'hawk'
    | 'awsv4'
    | 'ntlm'
    | 'edgegrid'
    | string;
  basic?: PostmanAuthParam[];
  bearer?: PostmanAuthParam[];
  apikey?: PostmanAuthParam[];
  [k: string]: unknown;
}

export interface PostmanAuthParam {
  key?: string;
  value?: string;
  type?: string;
}

export interface PostmanVariable {
  key?: string;
  value?: string;
  type?: string;
  description?: string;
}

export interface PostmanEvent {
  listen?: 'prerequest' | 'test' | string;
  script?: { exec?: string | string[]; type?: string };
  disabled?: boolean;
}

/**
 * One saved exchange under `item.response[]`. The status phrase rides
 * `status` ("OK") with the numeric code in `code`; `createdAt` is the
 * capture moment on Data API payloads (absent in file exports);
 * `responseTime` is `null` on UI-saved examples.
 */
export interface PostmanSavedResponse {
  name?: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: Array<{ key?: string; value?: string }> | string | null;
  cookie?: unknown[];
  body?: string | null;
  responseTime?: number | string | null;
  createdAt?: string;
  _postman_previewlanguage?: string;
}

// ── Output ─────────────────────────────────────────────────────────

/**
 * One request extracted from the collection — the request-shaped
 * `CurlRequest` (reused so curl + HAR + Postman share one write
 * path downstream) plus the folder path it was nested under. The
 * path is ordered root→leaf and empty when the request lives at the
 * collection root.
 */
export interface PostmanParsedRequest {
  folderPath: string[];
  request: CurlRequest;
  /**
   * Saved responses converted to Response Example payloads — emitted
   * only under `PostmanParseOptions.responseExamples`, and only when
   * the item carries any. `capturedAt` on each entry is the wire
   * capture moment; entries without one take the caller's import
   * timestamp at mint time (core parsers are clock-free).
   */
  examples?: PostmanParsedExample[];
}

/**
 * One saved response as an importable Response Example: the captured
 * request shape (auth excluded per the ResponseExample schema) plus
 * the complete captured response block.
 */
export interface PostmanParsedExample {
  name: string;
  /** Wire `createdAt` when the source carried one. */
  capturedAt?: string;
  request: CapturedRequest;
  response: CapturedResponse;
}

/**
 * Folders discovered during traversal. Callers may want to create
 * matching matching folders and attach requests; or flatten entirely. The
 * parser only reports the structure — the UI decides the write
 * strategy.
 */
export interface PostmanParsedFolder {
  path: string[];
  description?: string;
  /** Folder-level event scripts, translated onto the folder's ancestor
   *  script slots (Phase D landing). */
  preRequestScript?: string;
  postResponseScript?: string;
}

/**
 * Normalized collection variable. Postman has no secret/default
 * split — every variable is effectively `default`, matching the destination
 * collection-variables model. The `type` is pinned to `'default'`
 * here; callers promoting to secret do so via UI.
 */
export interface PostmanCollectionVariable {
  name: string;
  value: string;
  type: 'default';
  description?: string;
}

export interface PostmanParseOptions {
  /**
   * Emit saved responses as `examples` on each parsed request. Off by
   * default: consumers that cannot mint Response Examples yet keep the
   * honest per-request drop note instead of silently discarding
   * emitted examples.
   */
  responseExamples?: boolean;
}

export interface PostmanParseResult {
  collectionName: string;
  collectionDescription: string;
  collectionVariables: PostmanCollectionVariable[];
  /** Collection-level event scripts, translated onto the collection's
   *  ancestor script slots (Phase D landing). */
  collectionPreRequestScript?: string;
  collectionPostResponseScript?: string;
  folders: PostmanParsedFolder[];
  requests: PostmanParsedRequest[];
  report: ImportReport;
}

export class PostmanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostmanParseError';
  }
}
