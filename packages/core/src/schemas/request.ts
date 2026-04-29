/**
 * Valibot schema for `V5.Request`.
 *
 * Mirrors `types/v5/request.ts` field-for-field. Auth is a discriminated
 * union on `type`; body carries an optional `content` + graphql vars.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

export const HttpMethodSchema = v.picklist(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export const BodyTypeSchema = v.picklist(['none', 'json', 'xml', 'graphql', 'form', 'multipart', 'text']);

export const CredentialsModeSchema = v.picklist(['omit', 'include']);

/**
 * OAuth 2.0 / OIDC flow identifier (ARCHITECTURE §18).
 *
 * - `authorization-code-pkce` — default for user-consent flows; the
 *   SW opens the authorization URL in a new window via
 *   `chrome.identity.launchWebAuthFlow` and exchanges the code + PKCE
 *   verifier at the token endpoint.
 * - `client-credentials` — machine-to-machine; POST direct to the
 *   token endpoint with client_id + client_secret. No user prompt.
 * - `device-code` — for CLI parity / embedded surfaces; poll the
 *   token endpoint with the device_code until authorization completes.
 * - `refresh-token` — not user-selected; the token store refreshes
 *   silently via this flow before expiry (see §20 refresh machinery).
 */
export const OAuth2FlowSchema = v.picklist(['authorization-code-pkce', 'client-credentials', 'device-code']);

/**
 * UI-level grant-type choice. Independent of `flow` (the runtime wire
 * behavior) because multiple UI choices collapse to the same wire
 * flow — e.g. `authorization-code` and `authorization-code-pkce`
 * both exchange via the token endpoint with a code, but the UI needs
 * to show different field sets + help text for each.
 *
 * When absent, the UI infers a reasonable default from `flow` alone
 * (PKCE-first for browser extensions).
 */
export const OAuth2UiGrantTypeSchema = v.picklist([
  'authorization-code',
  'authorization-code-pkce',
  'implicit',
  'password-credentials',
  'client-credentials',
  'device-code',
]);

/**
 * First-class OAuth 2.0 / OIDC auth config (ARCHITECTURE §18).
 *
 * `credentialRef` is a stable per-request key used by the extension's
 * OAuth token store to look up the long-lived material (refresh token
 * + expires_at + last access token). The access_token + refresh_token
 * are NEVER stored in the request YAML — only the config needed to
 * perform the flow lives here; the secret material flows through
 * `chrome.storage.local` via the Vault interface (§10) keyed by
 * `credentialRef`.
 *
 * `clientSecret` is optional — Authorization Code + PKCE flows should
 * ship without one (public clients). Client Credentials flows need it.
 *
 * `scopes` is space-joined on the wire; stored as an array so the UI
 * can edit individual scopes. `extraAuthParams` / `extraTokenParams`
 * let callers add provider-specific knobs (e.g. Google's `prompt`,
 * Okta's `audience`) without schema churn.
 */
export const OAuth2AuthSchema = v.object({
  type: v.literal('oauth2'),
  /**
   * Stable per-request credential id. The extension's token store keys
   * by this; moving a request between workspaces keeps its tokens.
   * Generated at auth-config creation time (like the request uid).
   */
  credentialRef: v.pipe(v.string(), v.minLength(1)),
  /**
   * Optional provider preset id (`'google'` / `'github'` / …). When
   * set, the UI can rehydrate endpoints + scopes from the preset
   * library without relying on the user to copy-paste them. Drifting
   * endpoints between preset and stored config is tolerated — stored
   * values always win.
   */
  providerPresetId: v.optional(v.string()),
  flow: OAuth2FlowSchema,
  /**
   * UI grant-type choice. When present, the editor uses this value
   * verbatim for display + field-set selection; when absent, derives
   * from `flow`. Persisted so switching between e.g.
   * `authorization-code` and `authorization-code-pkce` round-trips
   * through save.
   */
  grantType: v.optional(OAuth2UiGrantTypeSchema),
  /** Authorization endpoint URL (used by authorization-code-pkce + device-code). */
  authorizationEndpoint: v.optional(v.string()),
  /** Token endpoint URL (used by every flow). */
  tokenEndpoint: v.pipe(v.string(), v.minLength(1)),
  /** Device authorization endpoint (device-code flow only). */
  deviceAuthorizationEndpoint: v.optional(v.string()),
  clientId: v.pipe(v.string(), v.minLength(1)),
  /** Optional — required for client-credentials; absent for public PKCE clients. */
  clientSecret: v.optional(v.string()),
  /** Space-joined on the wire; stored as an array for per-scope UI editing. */
  scopes: v.array(v.string()),
  /**
   * Human-readable name the user gave this credential. Reserved for
   * display only — the token store keys by `credentialRef`, not `label`.
   * Useful when one workspace has multiple OAuth2 credentials against
   * the same provider (e.g. two Google projects).
   */
  label: v.optional(v.string()),
  /**
   * Separate refresh endpoint. Most providers collapse the
   * refresh-token POST onto the same `tokenEndpoint`, but RFC 6749 §6
   * allows distinct endpoints; some providers (notably legacy Okta
   * tenants) use a separate path. When absent, `tokenEndpoint` is
   * used for refresh too.
   */
  refreshEndpoint: v.optional(v.string()),
  /**
   * How the client credentials are carried on token-endpoint POSTs.
   * `'body'` (the default) embeds `client_id` / `client_secret` in the
   * form-urlencoded body — the path that works with the widest set of
   * providers. `'basic-header'` moves them into an `Authorization:
   * Basic <base64(client_id:client_secret)>` header per RFC 6749 §2.3.1
   * — some providers (Auth0, Keycloak) only accept this form. Affects
   * authorization-code, client-credentials, and refresh POSTs alike.
   */
  clientAuthentication: v.optional(v.picklist(['body', 'basic-header'])),
  /**
   * Where the token response's `access_token` is applied on outgoing
   * requests. `'header'` adds `Authorization: Bearer <token>` (the
   * default + overwhelming majority of providers). `'query'` appends
   * `?access_token=<token>` — a deprecated but still-supported path
   * some legacy providers require.
   */
  sendAs: v.optional(v.picklist(['header', 'query'])),
  /** Optional extra params appended to the authorization URL. */
  extraAuthParams: v.optional(v.array(v.object({ key: v.string(), value: v.string() }))),
  /** Optional extra params appended to the token POST body. */
  extraTokenParams: v.optional(v.array(v.object({ key: v.string(), value: v.string() }))),
  /**
   * Optional extra params appended to the refresh-token POST body.
   * Mirrors `extraTokenParams` — some providers require additional
   * knobs on refresh that don't belong on the initial exchange.
   */
  extraRefreshParams: v.optional(v.array(v.object({ key: v.string(), value: v.string() }))),
});

export const AuthConfigSchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({ type: v.literal('inherit') }),
  v.object({
    type: v.literal('basic'),
    username: v.string(),
    password: v.string(),
  }),
  v.object({
    type: v.literal('bearer'),
    token: v.string(),
  }),
  v.object({
    type: v.literal('api-key'),
    key: v.string(),
    value: v.string(),
    in: v.picklist(['header', 'query']),
  }),
  OAuth2AuthSchema,
]);

export const RequestHeaderSchema = v.object({
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

export const QueryParamSchema = v.object({
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
  /**
   * Marks the `=` separator as present even when `value` is empty —
   * preserves the distinction between `?key` (key-only form) and
   * `?key=` (key-with-empty-value form) through the URL round-trip.
   * Without this, controlled URL inputs would snap back to the
   * canonical form every time the user typed `=` after an existing
   * key, swallowing their keystroke. `undefined` / `false` means
   * key-only form; `true` means emit `key=`.
   */
  hasEquals: v.optional(v.boolean()),
});

/**
 * A reference to a user-uploaded file blob. Files live in
 * content-addressed storage (IDB on the extension, OPFS on the desktop)
 * keyed by `hash` — see `@openheaders/core/files` for the FileRef
 * namespace contract and ARCHITECTURE.md §6.
 *
 * `hash` matches ONE of two shapes:
 *   • `sha256:<64-hex-char-digest>` — real content-addressed ref.
 *   • `placeholder:<opaque-label>`  — importer emitted a file
 *     reference it couldn't carry bytes for (curl `-F @path`, HAR
 *     multipart, Postman formdata file parts). The UI shows an
 *     "Upload required" badge and offers inline replacement; the
 *     executor silently skips parts whose hash isn't in the
 *     BlobStore, so placeholders drop out of the outgoing FormData
 *     until reconciled.
 *
 * The filename is the user-facing label — rename-free: the same
 * bytes under different names stay one blob.
 */
export const FileRefSchema = v.object({
  /**
   * Stable per-file identity. Independent of content — two uploads of
   * the same bytes under different filenames produce two distinct
   * `fileId`s. This is what the blob store keys by, what the UI uses
   * for dedup inside a row, and what survives a rename without
   * recomputing a hash.
   *
   * Format: `file:<uuid>` for real uploads; `placeholder:<opaque>` for
   * importer stubs that haven't been reconciled yet.
   */
  fileId: v.pipe(v.string(), v.minLength(1)),
  /**
   * Content digest (`sha256:<64-hex>` or `placeholder:<opaque>`).
   * Multiple FileRefs MAY share a hash when users upload identical
   * bytes under different filenames — that's the intended semantic.
   * Used by `{{file.X}}` template resolution by content.
   */
  hash: v.pipe(v.string(), v.regex(/^(sha256:[0-9a-f]{64}|placeholder:.+)$/)),
  filename: v.string(),
  mimeType: v.optional(v.string()),
  size: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/**
 * A single part of a multipart/form-data body.
 *
 * Text parts carry a string value. File parts carry a LIST of
 * `FileRef`s — one field name can bind to multiple files
 * (`<input type="file" multiple>` is the HTML equivalent; HTTP
 * multipart allows repeated field names by design). The executor
 * emits one `FormData.append(name, blob, filename)` per ref. Parts
 * with zero refs render as a placeholder "Select files" row and are
 * skipped at send time.
 *
 * Discriminated on `kind` so TypeScript exhausts the branches at
 * compile time. `enabled: false` preserves the user's "keep around
 * but don't send" intent — the executor skips disabled parts during
 * FormData assembly.
 */
export const MultipartPartSchema = v.variant('kind', [
  v.object({
    kind: v.literal('text'),
    name: v.string(),
    value: v.string(),
    /** Optional free-form per-row note rendered in the Description column. */
    description: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  }),
  v.object({
    kind: v.literal('file'),
    name: v.string(),
    /** One or more file refs bound to this field name. Absent / empty
     *  array is a valid "not yet picked" state the editor surfaces
     *  as a neutral placeholder row. */
    fileRefs: v.array(FileRefSchema),
    /** Optional free-form per-row note rendered in the Description column. */
    description: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  }),
]);

/**
 * Single field of an `application/x-www-form-urlencoded` body. Same
 * shape as `QueryParam` but kept as its own type so the two domains
 * don't get coupled — they happen to look alike today but the wire
 * semantics differ (URL query strings vs request-body form fields).
 */
export const FormFieldSchema = v.object({
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

/**
 * Discriminated union of every body shape the executor can ship.
 *
 * Each variant declares ONLY the fields it uses — there is no shared
 * "optional content / optional formParts / optional multipartParts"
 * bag. Consumers `switch (body.type)` and the compiler refuses to
 * read a wrong field. This is the source-of-truth that gates the
 * resolve/execute/snapshot/mutate/persist pipeline; drift in any one
 * of those is a typecheck error, not a runtime bug.
 *
 * Variants:
 *   - `none`      — no body shipped (Content-Length: 0).
 *   - `json`      — `content` is JSON text; ships verbatim.
 *   - `xml`       — `content` is XML text; ships verbatim.
 *   - `text`      — `content` is plain text; `rawFormat` lets the
 *                   editor remember whether the user typed Text /
 *                   JavaScript / HTML (all three share `text/plain`-
 *                   family wire bytes; the dropdown choice tunes the
 *                   default Content-Type).
 *   - `form`      — `formParts` is the structured key/value list
 *                   serialized as `application/x-www-form-urlencoded`.
 *                   Disabled rows stay on disk but aren't sent.
 *   - `multipart` — `multipartParts` carries the multipart segments
 *                   (text + file refs by hash). The browser sets the
 *                   boundary at fetch time.
 *   - `graphql`   — `content` is the query string; `graphqlVariables`
 *                   is the optional JSON-encoded variables object.
 *                   The executor JSON-wraps both into a single
 *                   `application/json` POST body per the GraphQL HTTP
 *                   transport spec.
 */
export const RequestBodySchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({
    type: v.literal('json'),
    content: v.string(),
  }),
  v.object({
    type: v.literal('xml'),
    content: v.string(),
  }),
  v.object({
    type: v.literal('text'),
    content: v.string(),
    /**
     * Editor-only syntax hint. Persisted so the dropdown choice
     * (Text / JavaScript / HTML) round-trips through save. For
     * `text` bodies, the executor consults this to pick a more
     * specific default Content-Type (`text/javascript` / `text/html`)
     * when the user didn't set one. The literal `'text'` is allowed
     * (the default) so the field can be present without forcing the
     * user into a sub-format choice.
     */
    rawFormat: v.optional(v.picklist(['text', 'javascript', 'html'])),
  }),
  v.object({
    type: v.literal('form'),
    formParts: v.array(FormFieldSchema),
  }),
  v.object({
    type: v.literal('multipart'),
    multipartParts: v.array(MultipartPartSchema),
  }),
  v.object({
    type: v.literal('graphql'),
    content: v.string(),
    graphqlVariables: v.optional(v.string()),
  }),
]);

export const RequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  /**
   * Free-form Markdown notes surfaced in the request editor's Docs tab.
   * Persisted so the body survives across sessions + syncs through git.
   * Absent / empty string both render as the empty docs state.
   */
  description: v.optional(v.string()),
  method: HttpMethodSchema,
  url: v.string(),
  headers: v.array(RequestHeaderSchema),
  params: v.array(QueryParamSchema),
  auth: AuthConfigSchema,
  credentialsMode: v.optional(CredentialsModeSchema),
  /**
   * Whether the executor should transparently follow HTTP 3xx redirects.
   * Default `undefined` / `true` → `fetch(..., { redirect: 'follow' })`.
   * `false` → `'manual'`: fetch returns an opaqueredirect response so
   * the user sees the redirect bounced back instead of the final target.
   * The number of redirect hops is governed by the browser (typically
   * 20) — there is no programmatic way to cap it from MV3 fetch, so
   * that knob lives in the UI as a browser-controlled row and is not
   * persisted.
   */
  followRedirects: v.optional(v.boolean()),
  body: RequestBodySchema,
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
});
