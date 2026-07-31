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
  AwsSigV4AuthSchema,
  BodyTypeSchema,
  CredentialsModeSchema,
  DigestAuthSchema,
  FileRefSchema,
  FormFieldSchema,
  HttpMethodSchema,
  HttpVersionSchema,
  MultipartPartSchema,
  OAuth1AuthSchema,
  OAuth2AuthSchema,
  OAuth2FlowSchema,
  ProxyModeSchema,
  QueryParamSchema,
  RequestBodySchema,
  RequestHeaderSchema,
  RequestSchema,
  RequestSeedSchema,
  TlsVersionSchema,
} from '../schemas/request';

// ── HTTP method ────────────────────────────────────────────────────

export type HttpMethod = v.InferOutput<typeof HttpMethodSchema>;

// ── Headers ────────────────────────────────────────────────────────

export type RequestHeader = v.InferOutput<typeof RequestHeaderSchema>;

// ── Query parameters ───────────────────────────────────────────────

export type QueryParam = v.InferOutput<typeof QueryParamSchema>;

// ── Authentication ─────────────────────────────────────────────────

export type AuthType =
  | 'none'
  | 'inherit'
  | 'basic'
  | 'bearer'
  | 'api-key'
  | 'oauth2'
  | 'aws-sigv4'
  | 'digest'
  | 'oauth1';
export type AuthConfig = v.InferOutput<typeof AuthConfigSchema>;
export type OAuth2Flow = v.InferOutput<typeof OAuth2FlowSchema>;
export type OAuth2Auth = v.InferOutput<typeof OAuth2AuthSchema>;
export type AwsSigV4Auth = v.InferOutput<typeof AwsSigV4AuthSchema>;
export type DigestAuth = v.InferOutput<typeof DigestAuthSchema>;
export type OAuth1Auth = v.InferOutput<typeof OAuth1AuthSchema>;

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

/**
 * Content-addressed reference to a user-uploaded file blob. See
 * `@openheaders/core/files` for the storage contract (IDB on the
 * extension, OPFS on the desktop) and ARCHITECTURE.md §6.
 */
export type FileRef = v.InferOutput<typeof FileRefSchema>;

/** One part of a multipart/form-data body. Discriminated union on `kind`. */
export type MultipartPart = v.InferOutput<typeof MultipartPartSchema>;

/** One key/value field of an `application/x-www-form-urlencoded` body. */
export type FormField = v.InferOutput<typeof FormFieldSchema>;

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

/**
 * TLS protocol version token for the per-request negotiation window
 * (`tlsMinVersion` / `tlsMaxVersion`). UI-facing form (`'1.2'`);
 * transports translate to their runtime's own tokens.
 */
export type TlsVersion = v.InferOutput<typeof TlsVersionSchema>;

/**
 * HTTP version policy for the per-request `httpVersion` knob. Absent /
 * `'auto'` = ALPN offer of h2 + http/1.1, server picks; explicit
 * tokens pin the protocol and fail honestly when the server won't
 * speak it. The reported protocol always comes from the wire, never
 * from this knob.
 */
export type HttpVersion = v.InferOutput<typeof HttpVersionSchema>;

/**
 * Request-plane proxy routing mode. Absent = inherit the executing
 * host's system plane; `'direct'` opts out of any ambient proxy;
 * `'url'` routes through the request's own `proxyUrl`.
 */
export type ProxyMode = v.InferOutput<typeof ProxyModeSchema>;

export type Request = v.InferOutput<typeof RequestSchema>;

/**
 * Content-only request shape (no `uid` / `path` / `schemaVersion`) —
 * the pre-fill handoff unit shared by importers, the devpanel
 * "Create API request" draft store, and the workbench scratch tab.
 */
export type RequestSeed = v.InferOutput<typeof RequestSeedSchema>;
