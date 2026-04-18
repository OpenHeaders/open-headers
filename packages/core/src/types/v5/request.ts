/**
 * Request types for the git-based workspace format.
 *
 * A Request is a standalone HTTP call (API client).
 * On disk, each request is a folder containing:
 *   request.yaml     — schemaVersion, uid, name, method, URL, headers, params, auth
 *   body.*           — body content (file extension = content type)
 *   pre-request.js   — optional pre-request script
 *   test.js          — optional post-response test script
 *
 * The reader/writer assembles these into a unified Request object.
 * The 8-char uid is embedded in `request.yaml` and mirrored in the folder
 * name's `<slug>-<uid>` suffix (slug is a human hint; uid is the identity).
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

/**
 * Wire-level cookie policy for the request executor.
 *   - `'omit'`    — do not attach any cookies (default; safe under `<all_urls>`).
 *   - `'include'` — ride the browser's cookie jar for this request.
 *     Rarely needed; surfaces a warning in the UI because it can leak
 *     a user's logged-in session to arbitrary hosts.
 *
 * Matches `RequestInit.credentials` values the executor passes to fetch.
 * See ARCHITECTURE.md §14 — cookie-jar policy.
 */
export type CredentialsMode = 'omit' | 'include';

export interface Request {
  /** Persisted format version for `request.yaml`. */
  schemaVersion: number;
  /** 8-char lowercase-alphanumeric identity. Embedded in request.yaml. Stable across renames. */
  uid: string;
  /** Relative path within workspace (e.g. "requests/auth-a1b2c3d4/login-x7k2abcd"). Forward slashes. */
  path: string;

  // From request.yaml
  name: string;
  method: HttpMethod;
  /** URL template — supports {{VAR}} interpolation. */
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;
  /**
   * Cookie-jar policy. Omitted → executor defaults to `'omit'` (safe).
   * Users opt in to `'include'` per request via a UI toggle; the UI
   * surfaces a warning because it attaches the browser's cookies to
   * arbitrary hosts.
   */
  credentialsMode?: CredentialsMode;

  // From body.* file
  body: RequestBody;

  // From pre-request.js / test.js
  preRequestScript?: string;
  testScript?: string;
}
