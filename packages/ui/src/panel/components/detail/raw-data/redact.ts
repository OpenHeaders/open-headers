/**
 * Header-value redaction for the Raw Data export pipeline.
 *
 * The danger this guards against: a user pastes a generated curl/fetch
 * snippet into a Slack thread or a bug report and ships a bearer token
 * or session cookie to people who shouldn't see it. So we mask by
 * default; the user must opt-in to include real values.
 *
 * The match list is name-based (not value-based) because secret-shaped
 * heuristics on values produce too many false positives. We match the
 * common credential-carrying header names plus name-suffix patterns
 * (`*-token`, `*-key`, `*-secret`, etc.) that vendors use widely.
 */

const REDACTED = '<redacted>';

const EXACT_NAMES = new Set<string>([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
  'x-access-token',
  'x-session-id',
  'x-session-token',
  'x-amz-security-token',
]);

const SUFFIX_PATTERNS = ['-token', '-secret', '-key', '-credential', '-session', '-auth', '-password', '-passwd'];

export function isSecretHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  if (EXACT_NAMES.has(lower)) return true;
  return SUFFIX_PATTERNS.some((s) => lower.endsWith(s));
}

export function maybeRedactHeaderValue(name: string, value: string, redact: boolean): string {
  if (!redact) return value;
  return isSecretHeaderName(name) ? REDACTED : value;
}

export const REDACTED_PLACEHOLDER = REDACTED;
