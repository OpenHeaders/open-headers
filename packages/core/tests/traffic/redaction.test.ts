/**
 * Redaction predicates (the agent-traffic plan §4, slice S2).
 *
 * Pinned invariants:
 *   - The marker is `[redacted:<8-hex sha256 prefix>]`, STABLE per value
 *     (equality comparisons survive redaction) and DISTINCT across
 *     values — the origin session's "same token on both requests"
 *     reasoning depends on both halves.
 *   - The sync sha256 matches the FIPS 180-4 test vectors, so markers
 *     are reproducible across hosts.
 *   - Name-family redaction is structure-preserving: auth schemes,
 *     cookie names and set-cookie attributes survive; secret values
 *     never do.
 *   - Shape-family redaction catches JWTs and long opaque tokens in any
 *     header value and in URL query-parameter values, and leaves plain
 *     values, paths and timestamps alone.
 *   - Untouched inputs come back by REFERENCE (allocation-free pass).
 */

import { describe, expect, it } from 'vitest';
import {
  isSensitiveHeaderName,
  isTokenShapedValue,
  redactBodyText,
  redactHeaders,
  redactHeaderValue,
  redactionMarker,
  redactUrl,
} from '../../src/traffic';
import { sha256HexSync } from '../../src/traffic/sha256';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
const OPAQUE = 'oh_9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const MARKER = /^\[redacted:[0-9a-f]{8}\]$/;

describe('sha256HexSync', () => {
  it('matches the FIPS 180-4 vectors', () => {
    expect(sha256HexSync('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256HexSync('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('handles multi-byte UTF-8 and block-boundary lengths', () => {
    // 55/56/64 bytes straddle the padding boundary of one block.
    for (const length of [55, 56, 63, 64, 65]) {
      expect(sha256HexSync('a'.repeat(length))).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(sha256HexSync('café — 流量')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('redactionMarker', () => {
  it('is stable per value and distinct across values', () => {
    expect(redactionMarker(JWT)).toBe(redactionMarker(JWT));
    expect(redactionMarker(JWT)).toMatch(MARKER);
    expect(redactionMarker(OPAQUE)).toMatch(MARKER);
    expect(redactionMarker(JWT)).not.toBe(redactionMarker(OPAQUE));
  });

  it('derives from the value sha256 — reproducible across processes', () => {
    expect(redactionMarker('secret')).toBe(`[redacted:${sha256HexSync('secret').slice(0, 8)}]`);
  });
});

describe('isSensitiveHeaderName', () => {
  it('matches the name family case-insensitively', () => {
    for (const name of ['authorization', 'Authorization', 'COOKIE', 'Set-Cookie', 'Proxy-Authorization']) {
      expect(isSensitiveHeaderName(name)).toBe(true);
    }
    expect(isSensitiveHeaderName('content-type')).toBe(false);
    expect(isSensitiveHeaderName('x-request-id')).toBe(false);
  });
});

describe('isTokenShapedValue', () => {
  it('matches JWTs and long opaque tokens', () => {
    expect(isTokenShapedValue(JWT)).toBe(true);
    expect(isTokenShapedValue(OPAQUE)).toBe(true);
    expect(isTokenShapedValue('a1b2c3d4-e5f6-7890-abcd-ef0123456789')).toBe(true);
  });

  it('leaves ordinary values alone', () => {
    expect(isTokenShapedValue('application/json')).toBe(false);
    expect(isTokenShapedValue('2026-08-02T10:00:00.000Z')).toBe(false);
    expect(isTokenShapedValue('short1')).toBe(false);
    expect(isTokenShapedValue('a value with spaces and 1 digit')).toBe(false);
    expect(isTokenShapedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false); // no digit
    expect(isTokenShapedValue('/path/to/some/long/resource-2026')).toBe(false); // slash charset
  });
});

describe('redactHeaderValue — name family, structure preserving', () => {
  it('keeps the authorization scheme, redacts the credentials', () => {
    const redacted = redactHeaderValue('Authorization', `Bearer ${JWT}`);
    expect(redacted).toBe(`Bearer ${redactionMarker(JWT)}`);
    expect(redacted).not.toContain(JWT);
    // Same token in a different position redacts to the SAME marker.
    expect(redactHeaderValue('X-Api-Key', JWT)).toBe(redactionMarker(JWT));
  });

  it('redacts a schemeless authorization value wholesale', () => {
    expect(redactHeaderValue('authorization', OPAQUE)).toBe(redactionMarker(OPAQUE));
  });

  it('keeps cookie names, redacts every cookie value', () => {
    const redacted = redactHeaderValue('Cookie', `theme=dark; session=${OPAQUE}`);
    expect(redacted).toBe(`theme=${redactionMarker('dark')}; session=${redactionMarker(OPAQUE)}`);
  });

  it('keeps set-cookie attributes, redacts the value', () => {
    const redacted = redactHeaderValue('Set-Cookie', `sid=${OPAQUE}; Path=/; HttpOnly; SameSite=Lax`);
    expect(redacted).toBe(`sid=${redactionMarker(OPAQUE)}; Path=/; HttpOnly; SameSite=Lax`);
  });

  it('redacts token-shaped values in arbitrary headers, scheme-prefixed included', () => {
    expect(redactHeaderValue('X-Auth', `Bearer ${OPAQUE}`)).toBe(`Bearer ${redactionMarker(OPAQUE)}`);
    expect(redactHeaderValue('X-Trace-Token', OPAQUE)).toBe(redactionMarker(OPAQUE));
  });

  it('returns the same string for benign headers', () => {
    expect(redactHeaderValue('Content-Type', 'application/json')).toBe('application/json');
    expect(redactHeaderValue('Accept', 'text/html, application/xhtml+xml')).toBe('text/html, application/xhtml+xml');
  });
});

describe('redactUrl', () => {
  it('redacts token-shaped query values, keeps names and benign params', () => {
    const url = `https://openheaders.io/api?tag=probe&access_token=${JWT}&n=3`;
    const redacted = redactUrl(url);
    expect(redacted).toBe(`https://openheaders.io/api?tag=probe&access_token=${redactionMarker(JWT)}&n=3`);
  });

  it('keeps the fragment and returns the same reference when untouched', () => {
    const clean = 'https://openheaders.io/api?tag=probe&n=3#section';
    expect(redactUrl(clean)).toBe(clean);
    const secret = `https://openheaders.io/api?t=${OPAQUE}#frag`;
    expect(redactUrl(secret)).toBe(`https://openheaders.io/api?t=${redactionMarker(OPAQUE)}#frag`);
  });

  it('leaves query-less URLs alone by reference', () => {
    const url = 'https://openheaders.io/path/only';
    expect(redactUrl(url)).toBe(url);
  });
});

describe('redactHeaders', () => {
  it('returns the SAME array reference when nothing matches', () => {
    const headers = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Accept', value: '*/*' },
    ];
    expect(redactHeaders(headers)).toBe(headers);
  });

  it('redacts matching entries and keeps untouched entries by reference', () => {
    const benign = { name: 'Content-Type', value: 'application/json' };
    const headers = [benign, { name: 'Authorization', value: `Bearer ${JWT}` }];
    const redacted = redactHeaders(headers);
    expect(redacted).not.toBe(headers);
    expect(redacted[0]).toBe(benign);
    expect(redacted[1]?.value).toBe(`Bearer ${redactionMarker(JWT)}`);
    expect(JSON.stringify(redacted)).not.toContain(JWT);
  });
});

describe('redactBodyText (S3 — the body content plane)', () => {
  it('redacts a JWT inside JSON body text with the SAME marker the header plane mints', () => {
    const body = `{"error":"boom","token":"${JWT}","hint":"retry"}`;
    const redacted = redactBodyText(body);
    expect(redacted).not.toContain(JWT);
    expect(redacted).toContain(`"token":"${redactionMarker(JWT)}"`);
    // Cross-position marker algebra: header, URL and body agree.
    expect(redactHeaderValue('Authorization', `Bearer ${JWT}`)).toBe(`Bearer ${redactionMarker(JWT)}`);
  });

  it('redacts long opaque tokens and leaves prose, paths and timestamps alone', () => {
    const body = `stack trace at /var/www/handlers/renew.php:214 (2026-08-03T10:00:00Z) key=${OPAQUE}`;
    const redacted = redactBodyText(body);
    expect(redacted).not.toContain(OPAQUE);
    expect(redacted).toContain('/var/www/handlers/renew.php:214');
    expect(redacted).toContain('2026-08-03T10:00:00Z');
  });

  it('does not fire on long letter-only or digit-only runs', () => {
    const body = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa and 12345678901234567890123456789012';
    expect(redactBodyText(body)).toBe(body);
  });

  it('returns the SAME reference when nothing matches', () => {
    const body = '{"status":503,"message":"service unavailable"}';
    expect(redactBodyText(body)).toBe(body);
  });
});
