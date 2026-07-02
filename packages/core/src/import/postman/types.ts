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
  response?: unknown[];
  auth?: PostmanAuth;
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

export interface PostmanParseResult {
  collectionName: string;
  collectionDescription: string;
  collectionVariables: PostmanCollectionVariable[];
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
