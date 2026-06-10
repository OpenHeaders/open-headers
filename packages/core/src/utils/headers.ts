/**
 * Header name/value validation and sanitization.
 *
 * Used by both the desktop app and browser extension for validating
 * headers before they're applied via declarativeNetRequest or proxy.
 *
 * Also the single source of truth for "which operations can modify which
 * headers in which direction" — consumed by the DNR compiler (skip invalid
 * mods), the `isRuleComplete` gate (invalid rules become drafts and never
 * execute), and the UI (autocomplete + inline warnings on the header row).
 */

import type { HeaderOperation } from '../types/rule';

// ── Validation result types ─────────────────────────────────────────

export interface HeaderNameValidation {
  valid: boolean;
  sanitized?: string;
  warning?: string;
  message: string;
}

export interface HeaderValueValidation {
  valid: boolean;
  message?: string;
  warning?: string;
}

export type HeaderDirection = 'request' | 'response';

export interface HeaderOperationCapability {
  /** Whether this (direction × operation × header) combo is valid. */
  allowed: boolean;
  /** Human-readable reason when !allowed. Empty when allowed. */
  reason: string;
  /** When !allowed, the best alternative operation the user should use instead. */
  suggestion?: HeaderOperation;
}

// Headers that cannot be modified by extensions
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'transfer-encoding',
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'date',
  'dnt',
  'expect',
  'origin',
  'permissions-policy',
  'tk',
  'upgrade-insecure-requests',
  'proxy-authorization',
  'proxy-connection',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'x-devtools-emulate-network-conditions-client-id',
  'x-devtools-request-id',
]);

// Vary is deliberately NOT here: it is modifiable (it even sits on
// Chrome's response append allowlist below), and unlike the wire-integrity
// entries (content-length, content-encoding, …) rewriting it cannot
// corrupt body decoding — adjusting cache keys is a legitimate use case.
const FORBIDDEN_RESPONSE_HEADERS = new Set([
  'alt-svc',
  'clear-site-data',
  'connection',
  'content-length',
  'content-encoding',
  'content-range',
  'date',
  'expect-ct',
  'keep-alive',
  'public-key-pins',
  'strict-transport-security',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** Matches a `{{...}}` template segment. Used by `validateHeaderName`
 *  to skip variable spans before applying the tchar regex. The braces
 *  themselves aren't valid HTTP token characters, so without this we
 *  reject every templated header name even though the *resolved* name
 *  would be perfectly valid. */
const TEMPLATE_SEGMENT = /\{\{[^}]*\}\}/g;

/**
 * Validates a header name for browser extension compatibility.
 *
 * Header names may contain `{{var}}` template segments — these resolve
 * at request-compile time. The literal portion outside templates must
 * still satisfy RFC 9110 §5.1 tchar rules so a successful resolution
 * always produces a valid token.
 *
 * Forbidden-header check: only applied when the name has no templates.
 * If a template resolves to a forbidden name (e.g. `host`, `content-length`),
 * the runtime DNR builder catches it via this same function on the
 * resolved string and skips the rule. The draft validator can't predict
 * resolution, so we let templated drafts through and rely on the
 * runtime to gate them.
 */
export function validateHeaderName(name: string, isResponse = false): HeaderNameValidation {
  if (!name) {
    return { valid: false, message: 'Header name cannot be empty' };
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return { valid: false, message: 'Header name cannot be only whitespace' };
  }

  if (trimmedName.length > 256) {
    return { valid: false, message: 'Header name is too long (max 256 characters)' };
  }

  const hasTemplate = TEMPLATE_SEGMENT.test(trimmedName);
  TEMPLATE_SEGMENT.lastIndex = 0;
  const literalPart = trimmedName.replace(TEMPLATE_SEGMENT, '');

  const lowerName = trimmedName.toLowerCase();

  if (!hasTemplate) {
    const forbiddenSet = isResponse ? FORBIDDEN_RESPONSE_HEADERS : FORBIDDEN_REQUEST_HEADERS;
    if (forbiddenSet.has(lowerName)) {
      return {
        valid: false,
        message: `"${trimmedName}" is a protected header that cannot be modified by extensions`,
      };
    }
  }

  const validHeaderNameRegex = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
  // The literal portion (everything outside `{{...}}`) must consist of
  // tchar bytes only. An empty literal portion (entire name is one or
  // more templates) trivially passes — runtime resolution decides.
  if (literalPart.length > 0 && !validHeaderNameRegex.test(literalPart)) {
    return {
      valid: false,
      message: "Header name contains invalid characters. Only letters, numbers, and -_.~!#$%&'*+^`| are allowed",
    };
  }

  let warning: string | undefined;
  if (hasTemplate) {
    warning = 'Header name uses templates — resolved value is validated at request time.';
  } else if (lowerName === 'referrer') {
    warning = 'Note: The correct spelling is "Referer" (single r)';
  }

  return { valid: true, sanitized: trimmedName, warning, message: '' };
}

/**
 * Validates if a header value is acceptable for browser APIs.
 */
export function validateHeaderValue(value: string, headerName = ''): HeaderValueValidation {
  if (value === undefined || value === null || value === '') {
    return { valid: false, message: 'Header value cannot be empty' };
  }

  if (!value.trim()) {
    return { valid: false, message: 'Header value cannot be only whitespace' };
  }

  if (value.length > 8192) {
    return { valid: false, message: 'Header value is too long (max 8192 characters)' };
  }

  if (value.includes('\0')) {
    return { valid: false, message: 'Header value cannot contain null bytes' };
  }

  if (/\r\n[\t ]/.test(value)) {
    return { valid: false, message: 'Header value cannot contain line folding (CRLF followed by space/tab)' };
  }

  if (/[\r\n]/.test(value)) {
    return { valid: false, message: 'Header value cannot contain line breaks' };
  }

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — RFC 7230 header value validation
  if (/[\x00-\x08\x0A-\x1F\x7F]/.test(value)) {
    return { valid: false, message: 'Header value contains invalid control characters' };
  }

  if (headerName.toLowerCase() === 'content-type') {
    if (!/^[\w\-/+.]+/.test(value)) {
      return { valid: false, message: 'Content-Type header has invalid format' };
    }
  }

  if (/[\x80-\xFF]/.test(value)) {
    return {
      valid: true,
      warning: 'Header value contains non-ASCII characters that may cause compatibility issues',
      message: '',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Sanitizes a header value by removing or replacing invalid characters.
 */
export function sanitizeHeaderValue(value: string): string {
  if (!value) return '';

  let sanitized = String(value);
  sanitized = sanitized.replace(/\0/g, '');
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping control characters from header values
  sanitized = sanitized.replace(/[\x00-\x08\x0A-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  sanitized = sanitized.trim();

  if (sanitized.length > 8192) {
    sanitized = `${sanitized.substring(0, 8189)}...`;
  }

  return sanitized;
}

/**
 * Normalizes a header name to proper capitalization format.
 */
export function normalizeHeaderName(headerName: string): string {
  if (!headerName) return '';

  return headerName
    .trim()
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

// ── Chrome DNR append allowlists ─────────────────────────────────────
//
// Chrome's declarativeNetRequest.updateDynamicRules rejects any rule that
// uses `operation: "append"` on a header outside its built-in allowlist.
// The allowlist is fixed by Chrome (see Chromium's
// extensions/browser/api/declarative_net_request/flat/indexed_rule.cc):
// only standard HTTP headers whose wire grammar explicitly permits
// multiple-value entries can be appended.
//
// Custom headers (X-OH-Stack, X-My-Thing, …) are NOT on the allowlist.
// Attempting to append them causes Chrome to reject the ENTIRE
// updateDynamicRules batch (atomic operation), leaving the previous DNR
// snapshot installed and making the broken rule invisible. The
// capability check below rejects such combinations at author time so
// they never reach Chrome.

export const DNR_APPENDABLE_REQUEST_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'access-control-request-headers',
  'cache-control',
  'connection',
  'content-language',
  'cookie',
  'forwarded',
  'if-match',
  'if-none-match',
  'keep-alive',
  'range',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'want-digest',
  'x-forwarded-for',
]);

export const DNR_APPENDABLE_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
  'cache-control',
  'content-language',
  'link',
  'server',
  'set-cookie',
  'vary',
  'via',
  'www-authenticate',
  'x-content-type-options',
  'x-frame-options',
]);

// ── Curated header autocomplete lists ────────────────────────────────
//
// Not an allowlist — these drive the header-name AutoComplete dropdown
// in the rule editor. Curated (not exhaustive) so the dropdown stays
// useful instead of overwhelming. Users can still type any header name.

export const COMMON_REQUEST_HEADERS: readonly string[] = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'Pragma',
  'Range',
  'Referer',
  'User-Agent',
  'X-API-Key',
  'X-Auth-Token',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Real-IP',
  'X-Request-ID',
  'X-Requested-With',
];

export const COMMON_RESPONSE_HEADERS: readonly string[] = [
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Access-Control-Expose-Headers',
  'Access-Control-Max-Age',
  'Age',
  'Cache-Control',
  'Content-Disposition',
  'Content-Language',
  'Content-Security-Policy',
  'Content-Security-Policy-Report-Only',
  'Content-Type',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'ETag',
  'Expires',
  'Last-Modified',
  'Link',
  'Location',
  'Permissions-Policy',
  'Pragma',
  'Referrer-Policy',
  'Retry-After',
  'Server',
  'Set-Cookie',
  'Timing-Allow-Origin',
  'WWW-Authenticate',
  'X-Content-Type-Options',
  'X-DNS-Prefetch-Control',
  'X-Frame-Options',
  'X-XSS-Protection',
];

/**
 * Capability check for a (direction × operation × header) combination.
 *
 * Called from `isRuleComplete` (so invalid rules automatically become
 * drafts), the DNR header compiler (defensive skip), and the rule editor
 * UI (inline validation with a suggested alternative). Returns
 * `{ allowed: true, reason: '' }` for an empty header name so the UI can
 * leave the "required" path to the existing isRuleComplete check.
 */
export function getHeaderOperationCapability(
  direction: HeaderDirection,
  operation: HeaderOperation,
  headerName: string,
): HeaderOperationCapability {
  const trimmed = headerName.trim();
  if (!trimmed) return { allowed: true, reason: '' };

  const nameValidation = validateHeaderName(trimmed, direction === 'response');
  if (!nameValidation.valid) {
    return {
      allowed: false,
      reason: nameValidation.message,
      suggestion: operation === 'add' ? 'override' : undefined,
    };
  }

  if (operation === 'merge' || operation === 'override' || operation === 'remove') {
    return { allowed: true, reason: '' };
  }

  if (operation === 'add') {
    const allowlist = direction === 'request' ? DNR_APPENDABLE_REQUEST_HEADERS : DNR_APPENDABLE_RESPONSE_HEADERS;
    if (allowlist.has(trimmed.toLowerCase())) return { allowed: true, reason: '' };
    return {
      allowed: false,
      reason: `Append is only supported on standard multi-value ${direction} headers. "${trimmed}" is not in Chrome's appendable allowlist — use Override instead, or switch to Merge for a script-based append.`,
      suggestion: 'override',
    };
  }

  return { allowed: true, reason: '' };
}

/**
 * Suggested header names for the editor's AutoComplete, filtered by
 * (direction × operation). For `add` we return ONLY the Chrome appendable
 * allowlist (so the dropdown can't lead the user into an invalid choice).
 * For every other operation we return the curated common list minus
 * forbidden headers.
 */
export function getHeaderSuggestions(direction: HeaderDirection, operation: HeaderOperation): string[] {
  const forbidden = direction === 'request' ? FORBIDDEN_REQUEST_HEADERS : FORBIDDEN_RESPONSE_HEADERS;

  if (operation === 'add') {
    const allowlist = direction === 'request' ? DNR_APPENDABLE_REQUEST_HEADERS : DNR_APPENDABLE_RESPONSE_HEADERS;
    return [...allowlist]
      .filter((h) => !forbidden.has(h))
      .map(normalizeHeaderName)
      .sort();
  }

  const common = direction === 'request' ? COMMON_REQUEST_HEADERS : COMMON_RESPONSE_HEADERS;
  return common.filter((h) => !forbidden.has(h.toLowerCase()));
}
