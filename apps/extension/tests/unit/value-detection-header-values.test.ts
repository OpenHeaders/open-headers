/**
 * Header-value codecs + their detector routing. Pins:
 *   - HTTP dates decode IMF-fixdate ↔ ISO deterministically;
 *   - query strings need ≥2 `&`-pairs and edit line-per-pair;
 *   - Cache-Control / HSTS / Content-Disposition / Accept lists claim
 *     only via their closed vocabularies or structural evidence;
 *   - Link and auth-param splitting is quote-aware (commas inside
 *     quoted params never split) and re-encode rejects lines that
 *     would smuggle the join delimiter back in;
 *   - routing: header-list shapes claim ahead of url-encoded despite
 *     embedded %XX, and never steal cookie/CSP values.
 */

import {
  detectValueType,
  encodeAcceptList,
  encodeAuthParams,
  encodeCacheControl,
  encodeContentDisposition,
  encodeHsts,
  encodeHttpDate,
  encodeLinkHeader,
  encodeQueryString,
  tryDecodeAcceptList,
  tryDecodeAuthParams,
  tryDecodeCacheControl,
  tryDecodeContentDisposition,
  tryDecodeHsts,
  tryDecodeHttpDate,
  tryDecodeLinkHeader,
  tryDecodeQueryString,
} from '@openheaders/ui/shared/value-detection';
import { describe, expect, it } from 'vitest';

describe('tryDecodeHttpDate', () => {
  it('round-trips IMF-fixdate through ISO', () => {
    expect(tryDecodeHttpDate('Wed, 21 Oct 2026 07:28:00 GMT')).toBe('2026-10-21T07:28:00Z');
    expect(encodeHttpDate('2026-10-21T07:28:00Z')).toBe('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(encodeHttpDate('not a date')).toBeNull();
  });

  it('rejects non-IMF shapes', () => {
    expect(tryDecodeHttpDate('2026-10-21T07:28:00Z')).toBeNull();
    expect(tryDecodeHttpDate('Wed, 21 Oct 2026 07:28:00 UTC')).toBeNull();
    expect(tryDecodeHttpDate('21 Oct 2026')).toBeNull();
  });
});

describe('tryDecodeQueryString', () => {
  it('splits pairs one per line and re-joins with &', () => {
    expect(tryDecodeQueryString('grant_type=client_credentials&scope=read%20write&sig=abc=')).toBe(
      'grant_type=client_credentials\nscope=read%20write\nsig=abc=',
    );
    expect(encodeQueryString('a=1\nb=2')).toBe('a=1&b=2');
  });

  it('rejects single pairs, whitespace, and non-pair segments', () => {
    expect(tryDecodeQueryString('a=1')).toBeNull();
    expect(tryDecodeQueryString('a=1&plain words')).toBeNull();
    expect(encodeQueryString('a=1\nb=2&c=3')).toBeNull();
    expect(encodeQueryString('a=1\nhas space')).toBeNull();
  });
});

describe('tryDecodeCacheControl', () => {
  it('splits known directives one per line and re-joins with `, `', () => {
    expect(tryDecodeCacheControl('max-age=3600, must-revalidate, stale-while-revalidate=60')).toBe(
      'max-age=3600\nmust-revalidate\nstale-while-revalidate=60',
    );
    expect(tryDecodeCacheControl('max-age=0')).toBe('max-age=0'); // lone k=v is strong evidence
    expect(encodeCacheControl('max-age=60\nno-store')).toBe('max-age=60, no-store');
  });

  it('rejects lone bare flags, unknown directives, and quoted arguments', () => {
    expect(tryDecodeCacheControl('public')).toBeNull(); // lone bare word — too generic
    expect(tryDecodeCacheControl('max-age=60, custom-thing')).toBeNull();
    expect(tryDecodeCacheControl('no-cache="set-cookie"')).toBeNull();
    expect(encodeCacheControl('no-store, no-cache')).toBeNull(); // comma breaks framing
  });
});

describe('tryDecodeHsts', () => {
  it('splits directives one per line, requiring max-age plus vocabulary segments', () => {
    expect(tryDecodeHsts('max-age=31536000; includeSubDomains; preload')).toBe(
      'max-age=31536000\nincludeSubDomains\npreload',
    );
    expect(encodeHsts('max-age=300\npreload')).toBe('max-age=300; preload');
  });

  it('rejects single segments, missing max-age, and unknown flags', () => {
    expect(tryDecodeHsts('max-age=31536000')).toBeNull();
    expect(tryDecodeHsts('includeSubDomains; preload')).toBeNull();
    expect(tryDecodeHsts('max-age=300; custom')).toBeNull();
  });
});

describe('tryDecodeContentDisposition', () => {
  it('puts the disposition token first, parameters after', () => {
    expect(tryDecodeContentDisposition('attachment; filename="report 2026.pdf"')).toBe(
      'attachment\nfilename="report 2026.pdf"',
    );
    expect(tryDecodeContentDisposition('form-data; name="field"; filename="a.txt"')).toBe(
      'form-data\nname="field"\nfilename="a.txt"',
    );
    expect(encodeContentDisposition('attachment\nfilename="x.pdf"')).toBe('attachment; filename="x.pdf"');
  });

  it('rejects a bare token, unknown tokens, and malformed params', () => {
    expect(tryDecodeContentDisposition('attachment')).toBeNull();
    expect(tryDecodeContentDisposition('download; filename="x.pdf"')).toBeNull();
    expect(tryDecodeContentDisposition('attachment; just words')).toBeNull();
  });
});

describe('tryDecodeLinkHeader', () => {
  const LINK = '<https://api.openheaders.io/v2?page=3>; rel="next", <https://api.openheaders.io/v2?page=1>; rel="prev"';

  it('splits links one per line — quote-aware, commas in titles survive', () => {
    expect(tryDecodeLinkHeader(LINK)).toBe(
      '<https://api.openheaders.io/v2?page=3>; rel="next"\n<https://api.openheaders.io/v2?page=1>; rel="prev"',
    );
    const titled = '<https://api.openheaders.io/a>; title="one, two", <https://api.openheaders.io/b>; rel="next"';
    expect(tryDecodeLinkHeader(titled)?.split('\n')).toHaveLength(2);
    expect(encodeLinkHeader('<https://api.openheaders.io/a>; rel="a"\n<https://api.openheaders.io/b>')).toBe(
      '<https://api.openheaders.io/a>; rel="a", <https://api.openheaders.io/b>',
    );
  });

  it('rejects non-link values and encode lines with unquoted commas', () => {
    expect(tryDecodeLinkHeader('https://api.openheaders.io/v2')).toBeNull();
    expect(tryDecodeLinkHeader('<broken url>; rel="next"')).toBeNull();
    expect(encodeLinkHeader('<https://a.openheaders.io>, <https://b.openheaders.io>')).toBeNull();
  });
});

describe('tryDecodeAuthParams', () => {
  it('claims Digest and SigV4 credentials, carrying the scheme', () => {
    expect(tryDecodeAuthParams('Digest username="oh-user", realm="api", nonce="abc123"')).toEqual({
      scheme: 'Digest',
      decoded: 'username="oh-user"\nrealm="api"\nnonce="abc123"',
    });
    const sigv4 =
      'AWS4-HMAC-SHA256 Credential=AKIA123/20260710/eu-west-1/s3/aws4_request, SignedHeaders=host, Signature=deadbeef';
    expect(tryDecodeAuthParams(sigv4)?.decoded.split('\n')).toHaveLength(3);
    expect(encodeAuthParams('username="u"\nrealm="r"', { scheme: 'Digest' })).toBe('Digest username="u", realm="r"');
  });

  it('rejects opaque-credential schemes and non-param payloads', () => {
    expect(tryDecodeAuthParams('Bearer abc123')).toBeNull();
    expect(tryDecodeAuthParams('Digest just-an-opaque-blob')).toBeNull();
    expect(encodeAuthParams('a="1", b="2"', { scheme: 'Digest' })).toBeNull(); // unquoted comma
  });
});

describe('tryDecodeAcceptList', () => {
  it('splits accept items one per line', () => {
    expect(tryDecodeAcceptList('text/html,application/xhtml+xml;q=0.9,*/*;q=0.8')).toBe(
      'text/html\napplication/xhtml+xml;q=0.9\n*/*;q=0.8',
    );
    expect(tryDecodeAcceptList('en-US,en;q=0.9')).toBe('en-US\nen;q=0.9');
    expect(encodeAcceptList('text/html\n*/*;q=0.8')).toBe('text/html, */*;q=0.8');
  });

  it('rejects generic word lists and single items', () => {
    expect(tryDecodeAcceptList('gzip, deflate')).toBeNull(); // no MIME slash or param — too generic
    expect(tryDecodeAcceptList('text/html')).toBeNull();
    expect(tryDecodeAcceptList('one two, three')).toBeNull();
  });
});

describe('detectValueType routing for header values', () => {
  it('routes each header shape to its own detector, not cookie or url-encoded', () => {
    expect(detectValueType('Wed, 21 Oct 2026 07:28:00 GMT')?.type).toBe('http-date');
    expect(detectValueType('max-age=31536000; includeSubDomains')?.type).toBe('hsts');
    expect(detectValueType('attachment; filename="report.pdf"')?.type).toBe('content-disposition');
    expect(detectValueType('session=abc123; theme=dark')?.type).toBe('cookie');
    expect(detectValueType('grant_type=x&scope=a%20b')?.type).toBe('query-string');
    expect(detectValueType('<https://api.openheaders.io/v2?page=3>; rel="next"')?.type).toBe('link');
    expect(detectValueType('Digest username="u", realm="r"')?.type).toBe('auth-params');
  });

  it('separates the comma lists: cache-control vs accept', () => {
    expect(detectValueType('no-cache, no-store')?.type).toBe('cache-control');
    expect(detectValueType('max-age=3600, must-revalidate')?.type).toBe('cache-control');
    expect(detectValueType('text/html,application/xhtml+xml;q=0.9')?.type).toBe('accept-list');
  });
});
