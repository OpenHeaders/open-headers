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
 *
 * Persisted shapes derive from the valibot schemas so the runtime validator
 * and the type stay locked together. `AuthType` (picklist) is the union of
 * `AuthConfig['type']` values — kept hand-written so callers that only need
 * the tag can import it cheaply.
 */

import type * as v from 'valibot';
import type {
  AuthConfigSchema,
  BodyTypeSchema,
  CredentialsModeSchema,
  HttpMethodSchema,
  QueryParamSchema,
  RequestBodySchema,
  RequestHeaderSchema,
  RequestSchema,
} from '../../schemas/request';

// ── HTTP method ────────────────────────────────────────────────────

export type HttpMethod = v.InferOutput<typeof HttpMethodSchema>;

// ── Headers ────────────────────────────────────────────────────────

export type RequestHeader = v.InferOutput<typeof RequestHeaderSchema>;

// ── Query parameters ───────────────────────────────────────────────

export type QueryParam = v.InferOutput<typeof QueryParamSchema>;

// ── Authentication ─────────────────────────────────────────────────

export type AuthType = 'none' | 'inherit' | 'basic' | 'bearer' | 'api-key';
export type AuthConfig = v.InferOutput<typeof AuthConfigSchema>;

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

export type BodyType = v.InferOutput<typeof BodyTypeSchema>;
export type RequestBody = v.InferOutput<typeof RequestBodySchema>;

// ── Request (unified in-memory type) ───────────────────────────────

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
export type CredentialsMode = v.InferOutput<typeof CredentialsModeSchema>;

export type Request = v.InferOutput<typeof RequestSchema>;
