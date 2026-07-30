/**
 * Valibot schema for `Request`.
 *
 * Mirrors `types/request.ts` field-for-field. Auth is a discriminated
 * union on `type`; body carries an optional `content` + graphql vars.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

/**
 * HTTP method — the standard verbs plus custom tokens (PROPFIND, PURGE,
 * vendor verbs). Uppercase token characters, capped at 32 chars.
 * CONNECT / TRACE / TRACK are rejected: `fetch()` forbids them, so
 * accepting them would only defer the failure to send time.
 */
export const HttpMethodSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Z][A-Z0-9-]{0,31}$/, 'Must be an uppercase HTTP method token (letters, digits, hyphens)'),
  v.check((m) => !['CONNECT', 'TRACE', 'TRACK'].includes(m), 'This method cannot be sent from a browser'),
);

export const BodyTypeSchema = v.picklist(['none', 'json', 'xml', 'graphql', 'form', 'multipart', 'text']);

/**
 * Bounds on the per-request wall-clock timeout. The 1 s floor keeps a
 * typo (e.g. "5" meant as seconds) from making every send abort
 * instantly; the 1 h ceiling exists only so the value stays a sane
 * duration — anything longer is indistinguishable from "no limit".
 */
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 3_600_000;

export const RequestTimeoutMsSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_REQUEST_TIMEOUT_MS),
  v.maxValue(MAX_REQUEST_TIMEOUT_MS),
);

/**
 * Bounds on the per-request response-body cap. The 1 KiB floor keeps
 * the knob usable for truncation testing without allowing a zero cap
 * that would blank every response. The ceiling is a hard 10 MiB: the
 * executor's own default is 2 MiB (the always-on process's memory
 * bound), and a per-request value may RAISE it up to this ceiling for
 * legitimately large payloads — never beyond.
 */
export const MIN_RESPONSE_BYTES = 1_024;
export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export const MaxResponseBytesSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_RESPONSE_BYTES),
  v.maxValue(MAX_RESPONSE_BYTES),
);

/**
 * Bounds on the per-request redirect cap. `0` is meaningful — "fail on
 * any redirect" — so the floor is zero, not one. The 50 ceiling keeps
 * the knob a sane chain length (2.5× the runtime's own 20 default);
 * a genuinely longer chain is a redirect loop, not a workflow.
 */
export const MIN_MAX_REDIRECTS = 0;
export const MAX_MAX_REDIRECTS = 50;

export const MaxRedirectsSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_MAX_REDIRECTS),
  v.maxValue(MAX_MAX_REDIRECTS),
);

/**
 * TLS protocol versions selectable for the per-request negotiation
 * window. UI-facing tokens (`'1.2'`), translated to the runtime's own
 * version tokens at the transport. Exported as a list so the Settings
 * tab builds its selects from the same source the schema validates.
 */
export const TLS_VERSIONS = ['1.0', '1.1', '1.2', '1.3'] as const;

export const TlsVersionSchema = v.picklist(TLS_VERSIONS);

/**
 * HTTP versions selectable for the per-request `httpVersion` knob.
 * `'auto'` (the default when the field is absent) lets the server pick
 * via ALPN (h2 + http/1.1); the explicit tokens PIN the send to one
 * protocol — a pinned send fails honestly when the server won't speak
 * it, never silently downgrades. `'2-prior-knowledge'` skips ALPN and
 * speaks h2 directly (h2c-capable targets); `'3'` is QUIC. Exported as
 * a list so the Settings tab builds its select from the same source
 * the schema validates.
 */
export const HTTP_VERSIONS = ['auto', '1.1', '2', '2-prior-knowledge', '3'] as const;

export const HttpVersionSchema = v.picklist(HTTP_VERSIONS);

/**
 * OpenSSL-format cipher suite list: colon-joined suite names (TLS ≤1.2
 * and TLS 1.3 suites both ride the one string). The token alphabet is
 * OpenSSL's — suite names plus the list operators (`:`, `!`, `+`, `-`,
 * `=`, `@`) — with whitespace rejected so a stray space never ships in
 * YAML. Whether the listed suites are USABLE is only known at connect
 * time; the transport classifies that failure naming this setting.
 */
export const MAX_TLS_CIPHER_SUITES_LENGTH = 2_048;

/** Shared with the Settings tab so the editor flags a malformed list
 *  in place instead of failing at save validation. */
export const TLS_CIPHER_SUITES_PATTERN = /^[A-Za-z0-9:_+!@=-]+$/;

export const TlsCipherSuitesSchema = v.pipe(
  v.string(),
  v.regex(TLS_CIPHER_SUITES_PATTERN, 'Must be an OpenSSL-format cipher list (colon-separated, no spaces)'),
  v.maxLength(MAX_TLS_CIPHER_SUITES_LENGTH),
);

/**
 * IPv4 / IPv6 address literal for the per-request resolve-to-address
 * override. The IPv4 branch is an exact dotted-quad (octets 0–255);
 * the IPv6 branch is a pragmatic alphabet check — hex digits, colons,
 * dots (IPv4-mapped forms), an optional `%zone` suffix — rather than
 * the full RFC 4291 grammar. Whether the address is REACHABLE is only
 * known at connect time; the transport classifies that failure naming
 * this setting.
 */
export const MAX_RESOLVE_TO_ADDRESS_LENGTH = 64;

/** Shared with the Settings tab so the editor flags a malformed
 *  address in place instead of failing at save validation. */
export const RESOLVE_TO_ADDRESS_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}|[0-9A-Fa-f]*:[0-9A-Fa-f:.]*(?:%[0-9A-Za-z._~-]+)?)$/;

export const ResolveToAddressSchema = v.pipe(
  v.string(),
  v.regex(RESOLVE_TO_ADDRESS_PATTERN, 'Must be an IPv4 or IPv6 address literal'),
  v.maxLength(MAX_RESOLVE_TO_ADDRESS_LENGTH),
);

/**
 * Reference to a vault `client-certificate` entry by NAME. The vault is
 * local-per-device and never syncs, so the entry name is the only
 * cross-device contract — a synced request finds each device's own
 * certificate under the same name (the `{{vault.X}}` model). The PEM
 * material itself never rides the request: the executor resolves the
 * ref against the vault at send time. Whether the named entry EXISTS
 * is a device-local question the editor and the transport both answer
 * in place.
 */
export const MAX_CLIENT_CERTIFICATE_REF_LENGTH = 256;

export const ClientCertificateRefSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(MAX_CLIENT_CERTIFICATE_REF_LENGTH),
);

/**
 * Per-request HTTP(S) proxy URL: scheme + host + optional port, nothing
 * else. `http://` or `https://` only — SOCKS schemes are rejected (the
 * node fetch stack does not support SOCKS proxies). Userinfo is
 * rejected outright: the runtime WOULD honor `user:pass@` credentials,
 * which is exactly why they must not land in synced request YAML by
 * muscle memory — credentials ride a vault ref instead (see
 * `proxyCredentialRef`). Validated by {@link isValidProxyUrl}, shared
 * with the Settings tab so the editor flags a malformed URL in place.
 */
export const MAX_PROXY_URL_LENGTH = 512;

/** Shared with the Settings tab so the editor flags a malformed proxy
 *  URL in place instead of failing at save validation. */
export function isValidProxyUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;
  if (url.search !== '' || url.hash !== '') return false;
  return url.pathname === '' || url.pathname === '/';
}

export const ProxyUrlSchema = v.pipe(
  v.string(),
  v.maxLength(MAX_PROXY_URL_LENGTH),
  v.check(isValidProxyUrl, 'Must be an http:// or https:// proxy URL — host and port only, no credentials'),
);

/**
 * Request-plane proxy routing mode. ABSENT is the default and means
 * INHERIT: the executing host's environment plane (system settings /
 * PAC on the desktop, HTTP_PROXY-family env vars on the node tier)
 * resolves whether the send traverses a proxy — see
 * docs/REQUEST_ENGINE_PROXY_DESIGN.md. `'direct'` is the explicit
 * opt-out (never proxy this request, whatever the machine says);
 * `'url'` routes through the request's own `proxyUrl`. The H11 reset
 * law holds: per-row reset returns the field to absent = inherit.
 */
export const PROXY_MODES = ['direct', 'url'] as const;

export const ProxyModeSchema = v.picklist(PROXY_MODES);

/**
 * Reference to a vault string entry by NAME, holding the proxy
 * credentials as `user:password`. Same contract as
 * {@link ClientCertificateRefSchema}: the vault is local-per-device and
 * never syncs, so the entry name is the only cross-device contract, and
 * the credential value itself never rides the request. Whether the
 * named entry EXISTS is a device-local question the editor and the
 * transport both answer in place.
 */
export const MAX_PROXY_CREDENTIAL_REF_LENGTH = 256;

export const ProxyCredentialRefSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(MAX_PROXY_CREDENTIAL_REF_LENGTH),
);

/**
 * Local socket the send dials instead of opening a TCP connection: an
 * absolute Unix domain socket path (`/…`) or a Windows named pipe
 * (`\\.\pipe\…`). Whether the socket EXISTS, listens, or is dialable
 * at all (the OS caps Unix socket paths at ~104 bytes on macOS / ~108
 * on Linux) is a connect-time classification naming this setting — the
 * schema only pins the shape. Validated by
 * {@link isValidUnixSocketPath}, shared with the Settings tab so the
 * editor flags a malformed path in place.
 */
export const MAX_UNIX_SOCKET_PATH_LENGTH = 256;

/** Shared with the Settings tab so the editor flags a malformed socket
 *  path in place instead of failing at save validation. */
export function isValidUnixSocketPath(value: string): boolean {
  if (value.startsWith('\\\\.\\pipe\\')) return value.length > '\\\\.\\pipe\\'.length;
  return value.startsWith('/') && value.length > 1;
}

export const UnixSocketPathSchema = v.pipe(
  v.string(),
  v.maxLength(MAX_UNIX_SOCKET_PATH_LENGTH),
  v.check(isValidUnixSocketPath, 'Must be an absolute Unix socket path or a \\\\.\\pipe\\ named pipe'),
);

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
 * - `password-credentials` — RFC 6749 §4.3 resource-owner password;
 *   POST direct to the token endpoint with username + password (+
 *   client credentials). No browser leg. Deprecated by OAuth 2.1 but
 *   still the only path some legacy IdPs offer.
 * - `refresh-token` — not user-selected; the token store refreshes
 *   silently via this flow before expiry (see §20 refresh machinery).
 *
 * Plain (non-PKCE) authorization-code is NOT a separate flow: it rides
 * `authorization-code-pkce` with `grantType: 'authorization-code'`,
 * which suppresses the PKCE parameters on the wire (see
 * {@link OAuth2UiGrantTypeSchema} + `usesPkce` in `core/oauth`).
 */
export const OAuth2FlowSchema = v.picklist([
  'authorization-code-pkce',
  'client-credentials',
  'device-code',
  'password-credentials',
]);

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
 * Suspends the auth contribution without discarding its configuration —
 * unchecking the auth-derived `Authorization` row in the Headers table
 * sets this; re-checking clears it. The executor skips `applyAuth`
 * entirely while set. Declared on every variant (including `none` /
 * `inherit`) so callers can read `auth.disabled` without narrowing.
 */
const AuthDisabledSchema = v.optional(v.boolean());

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
  disabled: AuthDisabledSchema,
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
  /**
   * Resource-owner credentials (password-credentials flow only).
   * Plain strings like `clientSecret` — templates welcome;
   * `{{vault.password}}` is the expected idiom for the password.
   * Completeness is an exchange-time gate, not a schema constraint,
   * so partial configs stay saveable.
   */
  username: v.optional(v.string()),
  password: v.optional(v.string()),
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
  extraAuthParams: v.optional(v.array(v.object({ uid: UidSchema, key: v.string(), value: v.string() }))),
  /** Optional extra params appended to the token POST body. */
  extraTokenParams: v.optional(v.array(v.object({ uid: UidSchema, key: v.string(), value: v.string() }))),
  /**
   * Optional extra params appended to the refresh-token POST body.
   * Mirrors `extraTokenParams` — some providers require additional
   * knobs on refresh that don't belong on the initial exchange.
   */
  extraRefreshParams: v.optional(v.array(v.object({ uid: UidSchema, key: v.string(), value: v.string() }))),
});

/**
 * AWS Signature Version 4 request signing. Unlike the credential-bearing
 * types above, nothing here rides the wire verbatim: the executor derives
 * the `Authorization` / `X-Amz-Date` (+ `X-Amz-Security-Token`) headers by
 * signing the FINAL wire shape — method, URL, query, headers, payload —
 * just before dispatch, AFTER pre-request scripts have had their say
 * (a resolve-time signature would be invalidated by any script mutation).
 * Both runtimes sign (pure WebCrypto HMAC — no challenge/response), so
 * the type is not host-gated.
 *
 * Fields are plain strings (templates welcome — `{{vault.aws_secret}}`
 * is the expected idiom for the secret); completeness is a send-time
 * gate, not a schema constraint, so partial configs stay saveable.
 */
export const AwsSigV4AuthSchema = v.object({
  type: v.literal('aws-sigv4'),
  disabled: AuthDisabledSchema,
  accessKeyId: v.string(),
  secretAccessKey: v.string(),
  /** STS temporary-credential session token; sent + signed as
   *  `X-Amz-Security-Token` when present. */
  sessionToken: v.optional(v.string()),
  /** Service namespace the credential scope names (`s3`, `execute-api`,
   *  `dynamodb`, …). `s3` additionally signs `x-amz-content-sha256`. */
  service: v.string(),
  /** Region the credential scope names (`us-east-1`, …). */
  region: v.string(),
});

/**
 * HTTP Digest authentication (RFC 7616 / 2617). Challenge/response —
 * only the credentials are configuration: realm, nonce, algorithm, and
 * qop all arrive on the server's 401 challenge at send time, so nothing
 * else belongs here. The second leg (401 → `WWW-Authenticate` →
 * recompute → resend) lives in the node transport; browser-runtime
 * hosts skip the contribution like a disabled one and the target's 401
 * is the actionable signal, so the editor labels the type as
 * desktop/CLI-only.
 *
 * Both fields are templatable (`{{vault.camera_password}}` is the
 * expected idiom); completeness mirrors basic auth — username
 * non-empty, password may be blank.
 */
export const DigestAuthSchema = v.object({
  type: v.literal('digest'),
  disabled: AuthDisabledSchema,
  username: v.string(),
  password: v.string(),
});

/**
 * OAuth 1.0a request signing (RFC 5849). Like SigV4, nothing rides the
 * wire verbatim: the executor derives the `oauth_*` protocol params by
 * signing the FINAL wire shape just before dispatch, AFTER pre-request
 * scripts have had their say. HMAC-SHA1 rides WebCrypto and PLAINTEXT
 * needs no crypto, so both runtimes sign — the type is not host-gated.
 * RSA-SHA1 is deliberately absent (rare, drags private-key management).
 *
 * `token`/`tokenSecret` are optional — one-legged calls
 * (WooCommerce-style) have neither. Fields are plain strings (templates
 * welcome — `{{vault.consumer_secret}}` is the expected idiom);
 * completeness is a send-time gate, so partial configs stay saveable.
 */
export const OAuth1AuthSchema = v.object({
  type: v.literal('oauth1'),
  disabled: AuthDisabledSchema,
  consumerKey: v.string(),
  consumerSecret: v.string(),
  token: v.optional(v.string()),
  tokenSecret: v.optional(v.string()),
  signatureMethod: v.picklist(['HMAC-SHA1', 'PLAINTEXT']),
  /** Where the `oauth_*` protocol params ride: the `Authorization:
   *  OAuth …` header or the URL's query string. The signature is
   *  identical either way (RFC 5849 §3.5). */
  paramsLocation: v.picklist(['header', 'query']),
  /** Protection realm, echoed in the Authorization header (header mode
   *  only); never signed. */
  realm: v.optional(v.string()),
});

export const AuthConfigSchema = v.variant('type', [
  v.object({ type: v.literal('none'), disabled: AuthDisabledSchema }),
  v.object({ type: v.literal('inherit'), disabled: AuthDisabledSchema }),
  v.object({
    type: v.literal('basic'),
    username: v.string(),
    password: v.string(),
    disabled: AuthDisabledSchema,
  }),
  v.object({
    type: v.literal('bearer'),
    token: v.string(),
    disabled: AuthDisabledSchema,
  }),
  v.object({
    type: v.literal('api-key'),
    key: v.string(),
    value: v.string(),
    in: v.picklist(['header', 'query']),
    disabled: AuthDisabledSchema,
  }),
  OAuth2AuthSchema,
  AwsSigV4AuthSchema,
  DigestAuthSchema,
  OAuth1AuthSchema,
]);

export const RequestHeaderSchema = v.object({
  /**
   * Stable per-row identity. Persisted alongside the row's `key` /
   * `value` so reorder gestures preserve identity across save/reload —
   * the sync engine's set-modeled paths key by this uid (§7.2 LWW per
   * itemId, §7.3 moveBefore via fractional indexing on the parent's
   * order array). Distinct from the row's `key` (HTTP header name) —
   * two rows can carry the same `key` (`Set-Cookie`, repeated query
   * params) but never the same `uid`.
   */
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

export const QueryParamSchema = v.object({
  /** See {@link RequestHeaderSchema.uid}. */
  uid: UidSchema,
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
    uid: UidSchema,
    name: v.string(),
    value: v.string(),
    /** Optional free-form per-row note rendered in the Description column. */
    description: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  }),
  v.object({
    kind: v.literal('file'),
    uid: UidSchema,
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
  uid: UidSchema,
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

const RequestObjectSchema = v.object({
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
  /**
   * Whether the executing runtime verifies the server's TLS certificate
   * chain. Default `undefined` / `true` → verify against the runtime's
   * trusted CA store. `false` → node runtimes send without verification —
   * a per-request explicit opt-in for self-signed / private-CA targets,
   * never a workspace/global default. Browser runtimes cannot relax
   * verification and ignore the flag (the request still syncs it — one
   * schema, all runtimes carry the value). A verification-off send is
   * recorded on the executed-run snapshot so the response is visibly
   * marked.
   */
  sslVerification: v.optional(v.boolean()),
  /**
   * Lowest TLS protocol version the send may negotiate. Absent = the
   * runtime default floor (TLS 1.2). `'1.0'` / `'1.1'` LOWER the floor
   * below the runtime default — a per-request explicit opt-in for
   * legacy servers, never a workspace/global default; a send that ran
   * with a lowered floor is recorded on the executed-run snapshot so
   * the response is visibly marked. Honored by node runtimes; browser
   * runtimes fix their protocol window and ignore it (the request
   * still syncs it — one schema, all runtimes carry the value).
   */
  tlsMinVersion: v.optional(TlsVersionSchema),
  /**
   * Highest TLS protocol version the send may negotiate. Absent = the
   * runtime default ceiling (TLS 1.3). Useful to force an older
   * protocol against a server under test. Node-only for the same
   * reason as `tlsMinVersion`; not trust-relaxing on its own.
   */
  tlsMaxVersion: v.optional(TlsVersionSchema),
  /**
   * Cipher suites offered during the TLS handshake, as one
   * OpenSSL-format colon-joined list. Absent = the runtime's default
   * list. The server still picks the suite from what is offered, in
   * its own preference order. Node-only for the same reason as
   * `tlsMinVersion`. Bounded — see {@link TlsCipherSuitesSchema}.
   */
  tlsCipherSuites: v.optional(TlsCipherSuitesSchema),
  /**
   * HTTP version policy for the send. Absent / `'auto'` = offer h2
   * alongside http/1.1 via ALPN and let the server pick (plain
   * `http://` targets stay HTTP/1.1 — no h2c under auto). The explicit
   * tokens PIN the protocol: `'1.1'` offers http/1.1 only; `'2'`
   * offers h2 only and fails honestly when the server negotiates
   * anything else; `'2-prior-knowledge'` and `'3'` are carried for
   * runtimes that honor them. The negotiated protocol reported on the
   * executed-run snapshot always comes from the wire, never from this
   * knob. Not trust-relaxing — no snapshot marker. Honored by node
   * runtimes; browser runtimes negotiate their own protocol and ignore
   * it (the request still syncs it — one schema, all runtimes carry
   * the value).
   */
  httpVersion: v.optional(HttpVersionSchema),
  /**
   * Resolve the URL's hostname to this IPv4/IPv6 address at connect
   * time instead of asking DNS — while SNI, the Host header, and
   * certificate verification all keep the ORIGINAL hostname. That
   * preservation is the point: test one specific backend behind a load
   * balancer as if DNS had answered with it. The pin applies to every
   * hop of a redirect chain, cross-host hops included. Not
   * trust-relaxing on its own — with verification on, the certificate
   * must still match the URL's host. The URL keeps its own port; this
   * is an address only. Honored by node runtimes; browser runtimes own
   * their resolver outright and ignore it (the request still syncs it —
   * one schema, all runtimes carry the value). Pattern-validated — see
   * {@link ResolveToAddressSchema}.
   */
  resolveToAddress: v.optional(ResolveToAddressSchema),
  /**
   * Present a TLS client certificate during the handshake, for APIs
   * behind mutual-TLS gateways. The value is the NAME of a vault
   * `client-certificate` entry (cert + key PEM pair, optional
   * passphrase) — never the PEM material itself; the executor resolves
   * the ref against the local vault at send time, and a ref that
   * doesn't resolve on this device fails the send with an error naming
   * this setting. Not trust-relaxing — presenting a client certificate
   * does not weaken server verification; no snapshot marker. Honored
   * by node runtimes; browser runtimes pick client certificates from
   * their own store/prompt and ignore it (the request still syncs it —
   * one schema, all runtimes carry the value).
   */
  clientCertificateRef: v.optional(ClientCertificateRefSchema),
  /**
   * Proxy routing mode for the send. Absent = INHERIT the executing
   * host's environment plane (the default — an unmanaged machine
   * resolves direct and behaves exactly as before; a corporate machine
   * traverses its pushed proxy with zero per-request configuration).
   * `'direct'` opts this request out of any ambient proxy; `'url'`
   * routes through `proxyUrl`. Validation ties the pair — see the
   * checks on {@link RequestSchema}.
   */
  proxyMode: v.optional(ProxyModeSchema),
  /**
   * Route the send through this HTTP(S) proxy instead of connecting
   * directly. The connection to the target tunnels through the proxy
   * (HTTP CONNECT), so end-to-end TLS and certificate verification
   * still run against the TARGET — the proxy sees the tunnel endpoint,
   * not the decrypted exchange; not trust-relaxing, no snapshot marker.
   * Applies to every hop of a redirect chain. Incompatible with
   * `resolveToAddress` — the proxy resolves the hostname itself, so a
   * send carrying both fails with an error naming the conflict.
   * Credentials never ride this URL — see `proxyCredentialRef`. Honored
   * by node runtimes; browser runtimes route through the browser's own
   * proxy settings and ignore it (the request still syncs it — one
   * schema, all runtimes carry the value). Validated — see
   * {@link ProxyUrlSchema}.
   */
  proxyUrl: v.optional(ProxyUrlSchema),
  /**
   * Authenticate against the proxy with the credentials from this
   * vault string entry (by NAME), holding `user:password`. Sent as a
   * `Proxy-Authorization: Basic …` header on the proxy leg only — never
   * to the target. Only meaningful alongside `proxyUrl`; a ref that
   * doesn't resolve on this device fails the send with an error naming
   * this setting. Node-only for the same reason as `proxyUrl`.
   */
  proxyCredentialRef: v.optional(ProxyCredentialRefSchema),
  /**
   * Dial this local socket — an absolute Unix domain socket path or a
   * Windows named pipe (`\\.\pipe\…`) — instead of opening a TCP
   * connection, for Docker-daemon-style APIs, systemd services, and
   * local dev daemons. The URL keeps its scheme and host: the host
   * becomes COSMETIC for dialing, while the Host header, SNI, and
   * certificate verification still use it — an https send over the
   * socket verifies against the URL's hostname. The socket rides every
   * hop of a redirect chain — a cross-host redirect still dials the
   * same socket. Incompatible with `proxyUrl` (a CONNECT tunnel cannot
   * dial a local socket) and with `resolveToAddress` (a socket dial
   * resolves no hostname); a send carrying either pair fails with an
   * error naming the conflict. Not trust-relaxing, no snapshot marker.
   * Honored by node runtimes; browser runtimes cannot dial local
   * sockets and ignore it (the request still syncs it — one schema,
   * all runtimes carry the value). Validated — see
   * {@link UnixSocketPathSchema}.
   */
  unixSocketPath: v.optional(UnixSocketPathSchema),
  /**
   * Attach cookies from — and store Set-Cookie responses into — the
   * app's own per-workspace cookie jar, so multi-step API sessions
   * (login, then an authenticated call) work without hand-copying
   * cookie values. Absent / `false` = today's behavior: no cookies
   * attached, Set-Cookie discarded. The jar lives in the executing
   * process's memory only — per workspace, never persisted, never
   * synced, gone when the app quits. Capture and attach are symmetric:
   * only jar-enabled requests read or write it, on every hop of a
   * redirect chain, and a user-set `Cookie` header always wins (the
   * jar stands down for that hop). Not trust-relaxing — no snapshot
   * marker; the attached header is recorded on the executed-run
   * snapshot for reproducibility. Honored by node runtimes; browser
   * runtimes have the browser's own jar via `credentialsMode` and
   * ignore this (the request still syncs it — one schema, all
   * runtimes carry the value).
   */
  cookieJar: v.optional(v.boolean()),
  /**
   * Wall-clock ceiling (ms) on the whole round-trip — connection,
   * response, and body read. Honored by BOTH runtimes (the browser
   * fetch aborts on a deadline just like the node transport). Absent =
   * no per-request ceiling; only the network stack's own timeouts
   * apply. A workflow step's own per-attempt timeout, when set, takes
   * precedence over this value for that step's sends. Bounded — see
   * {@link RequestTimeoutMsSchema}.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Cap (bytes) on the response body read off the wire. Node runtimes
   * stream + abort past it; a truncated run records the cap on the
   * snapshot (`bodyCapBytes`) so the response labels the actual limit.
   * May raise the runtime's 2 MiB default up to the hard 10 MiB
   * ceiling, or lower it for truncation testing. Browser runtimes keep
   * their app-wide cap and ignore this (the request still syncs it —
   * one schema, all runtimes carry the value). Bounded — see
   * {@link MaxResponseBytesSchema}.
   */
  maxResponseBytes: v.optional(MaxResponseBytesSchema),
  /**
   * Cap on the number of 3xx redirects followed before the send fails
   * with an error naming the limit. Only meaningful while
   * `followRedirects` is on. Absent = the runtime default (20); `0` =
   * fail on any redirect. Honored by node runtimes, whose transport
   * chases the chain itself; browser runtimes are fixed at their own
   * internal cap and ignore this (the request still syncs it — one
   * schema, all runtimes carry the value). Bounded — see
   * {@link MaxRedirectsSchema}.
   */
  maxRedirects: v.optional(MaxRedirectsSchema),
  /**
   * Keep the original HTTP method and body across 301/302/303
   * redirects instead of the standard demotion to GET (307/308 always
   * preserve the method). Absent / `false` → standard behavior.
   * Node-only for the same reason as `maxRedirects`.
   */
  followOriginalHttpMethod: v.optional(v.boolean()),
  /**
   * Keep the `Authorization` header when a redirect crosses origin
   * (scheme + host + port) instead of the default strip. A
   * trust-relaxing per-request explicit opt-in — credentials travel to
   * whatever host the chain lands on — never a workspace/global
   * default. A send that actually re-sent the header cross-origin is
   * recorded on the executed-run snapshot so the response is visibly
   * marked. Node-only for the same reason as `maxRedirects`.
   */
  followAuthorizationHeader: v.optional(v.boolean()),
  body: RequestBodySchema,
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
});

/**
 * The persisted Request shape, with the cross-field ties the field
 * schemas can't express. `proxyMode: 'url'` requires a `proxyUrl` (an
 * URL-mode row with nothing to route through is a config error, not a
 * direct send), `'direct'` forbids one (the opt-out must not carry a
 * dormant URL that silently reactivates on a mode flip), and a
 * `proxyUrl` requires `mode: 'url'` — the tri-state settings row
 * always writes the PAIR, so a URL floating without its mode is a
 * malformed write, never a valid explicit route (the P2 transitional
 * lenience, tightened with the P3 row).
 */
export const RequestSchema = v.pipe(
  RequestObjectSchema,
  v.check((r) => r.proxyMode !== 'url' || r.proxyUrl !== undefined, "Proxy mode 'url' requires a proxy URL"),
  v.check((r) => r.proxyMode !== 'direct' || r.proxyUrl === undefined, "Proxy mode 'direct' cannot carry a proxy URL"),
  v.check((r) => r.proxyUrl === undefined || r.proxyMode === 'url', "A proxy URL requires proxy mode 'url'"),
);

/**
 * Content-only request shape — a `Request` minus its identity fields
 * (`schemaVersion`, `uid`, `path`). The unit of pre-fill handoff:
 * importers produce it, the devpanel "Create API request" draft store
 * validates it, and the workbench scratch tab (`seedRequestContent`)
 * consumes it. Nothing is persisted until the user saves the scratch.
 * Derived from the plain object shape — the proxy-pair ties above
 * apply at the persist boundary, not to pre-fill drafts.
 */
export const RequestSeedSchema = v.omit(RequestObjectSchema, ['schemaVersion', 'uid', 'path']);
