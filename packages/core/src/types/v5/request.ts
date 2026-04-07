/**
 * Request types for the git-based workspace format.
 *
 * A Request is a standalone HTTP call (API client).
 * On disk, each request is a folder containing:
 *   request.yaml  — method, URL, headers, params, auth
 *   body.*        — body content (extension = content type)
 *   scripts.js    — pre-request and post-response scripts
 *
 * The reader/writer layer assembles these into a unified Request object.
 * No IDs or timestamps on disk — identity is the filesystem path,
 * with a 4-char uid suffix on the folder name for stable in-memory keys.
 */

// ── HTTP method ────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// ── Headers ────────────────────────────────────────────────────────

export interface RequestHeader {
  key: string;
  value: string;
  /** Defaults to true if omitted (keeps YAML clean for the common case). */
  enabled?: boolean;
}

// ── Query parameters ───────────────────────────────────────────────

export interface QueryParam {
  key: string;
  value: string;
  /** Defaults to true if omitted. */
  enabled?: boolean;
}

// ── Authentication ─────────────────────────────────────────────────

export type AuthType = 'none' | 'inherit' | 'basic' | 'bearer' | 'api-key';

export type AuthConfig =
  | { type: 'none' }
  | { type: 'inherit' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };

// ── Body ───────────────────────────────────────────────────────────
//
// Body type is determined by the file extension on disk:
//   body.json      → json
//   body.xml       → xml
//   body.graphql   → graphql (+ optional variables.json)
//   body.form      → form-urlencoded
//   body.multipart → multipart/form-data
//   body.txt       → text
//   (no file)      → none

export type BodyType = 'none' | 'json' | 'xml' | 'graphql' | 'form' | 'multipart' | 'text';

export interface RequestBody {
  type: BodyType;
  /** Raw content of the body.* file. */
  content?: string;
  /** GraphQL variables from variables.json (graphql type only). */
  graphqlVariables?: string;
}

// ── Request (unified in-memory type) ───────────────────────────────
//
// Assembled from request.yaml + body.* + scripts.js by the reader layer.
// Not stored as a single file — the writer splits it back into separate files.

export interface Request {
  /** 4-char uid from folder name suffix (e.g. "x7k2"). Stable across renames. */
  uid: string;
  /** Relative path within workspace (e.g. "requests/auth/login-x7k2"). */
  path: string;

  // From request.yaml
  name: string;
  method: HttpMethod;
  /** URL template — supports {{VAR}} interpolation. */
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;

  // From body.* file
  body: RequestBody;

  // From scripts.js
  preRequestScript?: string;
  testScript?: string;
}
