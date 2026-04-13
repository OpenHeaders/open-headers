import { describe, expect, it } from 'vitest';
import { parseTestTargetUrl } from '../../src/utils/test-target-url';

describe('parseTestTargetUrl', () => {
  // ── Empty / whitespace ─────────────────────────────────────────

  it('rejects empty input', () => {
    const result = parseTestTargetUrl('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/enter a URL/i);
  });

  it('rejects whitespace-only input', () => {
    const result = parseTestTargetUrl('   ');
    expect(result.ok).toBe(false);
  });

  it('trims surrounding whitespace before parsing', () => {
    const result = parseTestTargetUrl('  https://api.openheaders.io  ');
    expect(result.ok).toBe(true);
    // WHATWG would canonicalize the empty path to `/` here; we strip
    // it back off so URL-string-comparing downstream code sees the
    // form the user typed. See the file header for rationale.
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io');
  });

  // ── Scheme already present ─────────────────────────────────────

  it('accepts http:// URLs', () => {
    const result = parseTestTargetUrl('http://api.openheaders.io/v1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://api.openheaders.io/v1');
  });

  it('accepts https:// URLs', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io/v1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/v1');
  });

  it('lowercases the scheme as part of canonicalization', () => {
    const result = parseTestTargetUrl('HTTPS://api.openheaders.io');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io');
  });

  // ── Auto-prepend http:// for bare hosts ────────────────────────

  it('auto-prepends http:// to bare host:port', () => {
    const result = parseTestTargetUrl('127.0.0.1:3000/echo');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://127.0.0.1:3000/echo');
  });

  it('auto-prepends http:// to localhost:port', () => {
    const result = parseTestTargetUrl('localhost:8080');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://localhost:8080');
  });

  it('auto-prepends http:// to bare hosts (hosts-file aliases)', () => {
    const result = parseTestTargetUrl('staging.openheaders.io/api');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://staging.openheaders.io/api');
  });

  it('auto-prepends http:// to a bare domain', () => {
    const result = parseTestTargetUrl('openheaders.io');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://openheaders.io');
  });

  // ── Protocol allowlist ─────────────────────────────────────────

  it('rejects ftp:// URLs', () => {
    const result = parseTestTargetUrl('ftp://files.openheaders.io');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/http/i);
  });

  it('rejects file:// URLs', () => {
    const result = parseTestTargetUrl('file:///etc/passwd');
    expect(result.ok).toBe(false);
  });

  it('rejects chrome:// URLs', () => {
    const result = parseTestTargetUrl('chrome://extensions');
    expect(result.ok).toBe(false);
  });

  it('rejects data: URLs', () => {
    const result = parseTestTargetUrl('data:text/html,<h1>hi</h1>');
    expect(result.ok).toBe(false);
  });

  // ── Spaces: host vs. path ──────────────────────────────────────
  //
  // The WHATWG URL parser rejects spaces in the HOST portion but
  // accepts (and percent-encodes) spaces in the PATH portion. This
  // matches browser address-bar UX exactly — pasting
  // `https://openheaders.io/some path` into Chrome loads it as
  // `https://openheaders.io/some%20path`. We deliberately preserve
  // that behavior; rejecting all spaces would break the legitimate
  // case of testing a URL whose path contains literal spaces.

  it('rejects spaces inside the host segment', () => {
    const result = parseTestTargetUrl('api.openheaders.io v1');
    expect(result.ok).toBe(false);
  });

  it('rejects multiple words separated by spaces (all bare hosts)', () => {
    const result = parseTestTargetUrl('api.openheaders.io static.openheaders.io');
    expect(result.ok).toBe(false);
  });

  it('accepts and percent-encodes spaces inside the path segment', () => {
    // Matches WHATWG / browser address-bar behavior: literal space in
    // the path is normalized to %20 at canonicalization time.
    const result = parseTestTargetUrl('api.openheaders.io/v1 path');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://api.openheaders.io/v1%20path');
  });

  it('accepts spaces in the path on a fully-qualified URL', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io/some path with space');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/some%20path%20with%20space');
  });

  it('idempotent on already-encoded paths', () => {
    // A user paste-from-clipboard with %20 already in place must round-
    // trip through the parser unchanged. Important because users often
    // copy URLs from the address bar (which shows the encoded form) and
    // we must not double-encode the %.
    const result = parseTestTargetUrl('https://api.openheaders.io/some%20path');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/some%20path');
  });

  // ── Single-word inputs are deliberately valid ──────────────────
  //
  // A single word with no scheme, no port, and no TLD is structurally
  // indistinguishable from a /etc/hosts alias (`staging`, `dev`,
  // `myapp`) or a built-in hostname (`localhost`). Rejecting them
  // would break legitimate local-dev workflows. Single-word inputs
  // therefore always pass the modal — Chrome's DNS / connection layer
  // surfaces the "site can't be reached" error during navigation if
  // the host doesn't resolve, and the test session's error-grace path
  // produces a correct empty report. These tests pin the
  // "deliberately permissive" behavior so a future "stricter" fix
  // doesn't quietly break the hosts-file case.

  it('accepts a single-word host (could be a hosts-file alias)', () => {
    const result = parseTestTargetUrl('staging');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://staging');
  });

  it('accepts a single-word host with a port', () => {
    const result = parseTestTargetUrl('staging:3010');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('http://staging:3010');
  });

  // ── Trailing-slash preservation ────────────────────────────────
  //
  // We strip WHATWG's auto-added empty-path slash so URL-string-
  // comparing intermediaries see what the user typed. But we never
  // touch a slash the user typed themselves, and we never touch
  // slashes WHATWG inserts before a query / fragment because those
  // are required by the URL grammar. These tests pin both halves of
  // that contract.

  it('preserves a user-typed trailing slash on the empty-path case', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io/');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/');
  });

  it('strips the auto-added slash when the user typed no path', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io');
  });

  it('preserves trailing slash on a non-empty path (WHATWG never touches it)', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io/v1/');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/v1/');
  });

  it('preserves the absence of trailing slash on a non-empty path', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io/v1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/v1');
  });

  it('keeps the structurally-required slash before a query string', () => {
    // WHATWG inserts `/` between host and `?` because the URL grammar
    // requires a path segment when a query is present. Stripping it
    // would produce an invalid URL, so we leave it alone.
    const result = parseTestTargetUrl('https://api.openheaders.io?debug=1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/?debug=1');
  });

  it('keeps the structurally-required slash before a fragment', () => {
    const result = parseTestTargetUrl('https://api.openheaders.io#section');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://api.openheaders.io/#section');
  });
});
