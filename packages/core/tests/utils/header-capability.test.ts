/**
 * Header capability matrix tests.
 *
 * Exhaustively verifies the (browser × direction × operation × header-class)
 * matrix that `getHeaderOperationCapability` must accept or reject in order
 * for the extension's DNR compiler to never emit a rule Chrome/Edge/Firefox
 * will atomically reject at apply time.
 *
 * Cross-browser compatibility notes:
 *
 *   - **Chrome** (source: `extensions/browser/api/declarative_net_request/`):
 *       Rejects `append` on any header NOT in its built-in allowlist of
 *       standard multi-value headers. Rejects header names with non-token
 *       characters. Rejects values over 8192 bytes or containing control
 *       characters. The append allowlists in `headers.ts` are copied
 *       verbatim from Chromium's C++ source and must stay in sync.
 *
 *   - **Edge** — Chromium-based, identical to Chrome for DNR.
 *
 *   - **Firefox** 113+ — MV3 declarativeNetRequest implementation mirrors
 *       Chrome's allowlists (Mozilla source: `ExtensionDNR.sys.mjs`). Same
 *       rejection semantics for modifyHeaders. Firefox's allowlist is
 *       currently a superset-equal of Chrome's, so a rule accepted by
 *       Chrome is accepted by Firefox.
 *
 *   - **Safari** — Content-Blocker-backed DNR; limited modifyHeaders in
 *       Safari 16.4+ only. Out of scope for this matrix — the extension's
 *       existing `isSafari` branching handles that separately.
 *
 * Atomic rejection causes we must prevent:
 *   1. `append` on non-allowlisted header — COVERED
 *   2. Invalid header-name characters — covered by `validateHeaderName`
 *   3. Empty/missing value on set/append — covered by compiler
 *   4. Value too long / control chars — covered by `validateHeaderValue`
 *   5. Protected headers (host, etc.) — covered by FORBIDDEN_*
 */

import { describe, expect, it } from 'vitest';
import {
  COMMON_REQUEST_HEADERS,
  COMMON_RESPONSE_HEADERS,
  DNR_APPENDABLE_REQUEST_HEADERS,
  DNR_APPENDABLE_RESPONSE_HEADERS,
  getHeaderOperationCapability,
  getHeaderSuggestions,
} from '../../src/utils/headers';
import { isRuleComplete } from '../../src/utils/rule-validation';

const cap = getHeaderOperationCapability;

describe('getHeaderOperationCapability — append allowlist', () => {
  // ── Chrome/Edge/Firefox allowlist: request append ────────────────

  const REQUEST_ALLOWED = [
    'Accept',
    'Accept-Language',
    'Cache-Control',
    'Content-Language',
    'Cookie',
    'Forwarded',
    'If-Match',
    'If-None-Match',
    'Range',
    'Via',
    'Want-Digest',
    'X-Forwarded-For',
  ];

  // These are technically in Chrome's append allowlist but are ALSO in our
  // FORBIDDEN set because the browser manages them at the network layer and
  // any DNR modification is silently ignored. The capability check rejects
  // them via the forbidden path — verified below.
  const REQUEST_APPEND_FORBIDDEN_BY_PROJECT = [
    'Accept-Charset',
    'Accept-Encoding',
    'Access-Control-Request-Headers',
    'Connection',
    'Keep-Alive',
    'Te',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
  ];

  it.each(REQUEST_ALLOWED)('request append: "%s" → allowed', (header) => {
    expect(cap('request', 'add', header).allowed).toBe(true);
  });

  it.each(REQUEST_APPEND_FORBIDDEN_BY_PROJECT)('request append: "%s" → forbidden (protected)', (header) => {
    const result = cap('request', 'add', header);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/protected header/i);
  });

  // ── Chrome/Edge/Firefox allowlist: response append ───────────────

  const RESPONSE_ALLOWED = [
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods',
    'Access-Control-Expose-Headers',
    'Cache-Control',
    'Content-Language',
    'Link',
    'Server',
    'Set-Cookie',
    'Via',
    'Www-Authenticate',
    'X-Content-Type-Options',
    'X-Frame-Options',
  ];

  const RESPONSE_APPEND_FORBIDDEN_BY_PROJECT = ['Vary'];

  it.each(RESPONSE_ALLOWED)('response append: "%s" → allowed', (header) => {
    expect(cap('response', 'add', header).allowed).toBe(true);
  });

  it.each(RESPONSE_APPEND_FORBIDDEN_BY_PROJECT)('response append: "%s" → forbidden (protected)', (header) => {
    expect(cap('response', 'add', header).allowed).toBe(false);
  });

  // ── Non-allowlisted custom headers — THE bug class we must catch ─

  const CUSTOM_HEADERS = [
    'X-OH-Stack',
    'X-OH-Custom',
    'X-My-Header',
    'X-Request-ID',
    'X-API-Key',
    'X-Correlation-ID',
    'X-Custom-Auth',
    'X-Trace-ID',
  ];

  it.each(CUSTOM_HEADERS)('request append: custom "%s" → REJECT (atomic-rejection guard)', (header) => {
    const result = cap('request', 'add', header);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/appendable allowlist/);
    expect(result.suggestion).toBe('override');
  });

  it.each(CUSTOM_HEADERS)('response append: custom "%s" → REJECT (atomic-rejection guard)', (header) => {
    const result = cap('response', 'add', header);
    expect(result.allowed).toBe(false);
    expect(result.suggestion).toBe('override');
  });
});

describe('getHeaderOperationCapability — override (set)', () => {
  // Override is allowed on ANY non-forbidden header in any direction.

  const COMMON_CUSTOM = [
    'X-OH-Test',
    'X-API-Key',
    'X-Custom',
    'Authorization',
    'Content-Type',
    'User-Agent',
    'Referer',
    'Cookie',
  ];

  it.each(COMMON_CUSTOM)('request override: "%s" → allowed', (header) => {
    expect(cap('request', 'override', header).allowed).toBe(true);
  });

  const COMMON_RESPONSE_OVERRIDE = [
    'X-OH-Response',
    'Content-Security-Policy',
    'Access-Control-Allow-Origin',
    'X-Frame-Options',
    'Location',
    'Set-Cookie',
    'ETag',
  ];

  it.each(COMMON_RESPONSE_OVERRIDE)('response override: "%s" → allowed', (header) => {
    expect(cap('response', 'override', header).allowed).toBe(true);
  });

  it('request override: forbidden "Host" → rejected', () => {
    expect(cap('request', 'override', 'Host').allowed).toBe(false);
  });

  it('request override: forbidden "Content-Length" → rejected', () => {
    expect(cap('request', 'override', 'Content-Length').allowed).toBe(false);
  });

  it('response override: forbidden "Strict-Transport-Security" → rejected', () => {
    expect(cap('response', 'override', 'Strict-Transport-Security').allowed).toBe(false);
  });

  it('response override: forbidden "Content-Encoding" → rejected', () => {
    expect(cap('response', 'override', 'Content-Encoding').allowed).toBe(false);
  });
});

describe('getHeaderOperationCapability — remove', () => {
  // Remove shares the forbidden list with override.
  it('request remove: custom "X-OH-Test" → allowed', () => {
    expect(cap('request', 'remove', 'X-OH-Test').allowed).toBe(true);
  });

  it('response remove: custom "X-OH-Response" → allowed', () => {
    expect(cap('response', 'remove', 'X-OH-Response').allowed).toBe(true);
  });

  it('request remove: forbidden "Host" → rejected', () => {
    expect(cap('request', 'remove', 'Host').allowed).toBe(false);
  });
});

describe('getHeaderOperationCapability — merge (scriptable)', () => {
  // Merge is the scriptable monkey-patch path. Not subject to DNR constraints,
  // only to the forbidden list (so we don't fabricate rules the browser will
  // actively strip at the network layer).

  const MERGE_REQUEST = ['X-OH-Stack', 'Cookie', 'Authorization', 'X-Custom'];
  const MERGE_RESPONSE = ['X-OH-Response', 'Set-Cookie', 'Cache-Control', 'Content-Type'];

  it.each(MERGE_REQUEST)('request merge: "%s" → allowed', (header) => {
    expect(cap('request', 'merge', header).allowed).toBe(true);
  });

  it.each(MERGE_RESPONSE)('response merge: "%s" → allowed', (header) => {
    expect(cap('response', 'merge', header).allowed).toBe(true);
  });

  it('request merge: forbidden "Host" → still rejected', () => {
    expect(cap('request', 'merge', 'Host').allowed).toBe(false);
  });
});

describe('getHeaderOperationCapability — edge cases', () => {
  it('empty header name → allowed (deferred to field validation)', () => {
    expect(cap('request', 'override', '').allowed).toBe(true);
    expect(cap('request', 'add', '').allowed).toBe(true);
    expect(cap('response', 'remove', '   ').allowed).toBe(true);
  });

  it('case-insensitive: "x-forwarded-for" matches allowlist entry "x-forwarded-for"', () => {
    expect(cap('request', 'add', 'x-forwarded-for').allowed).toBe(true);
    expect(cap('request', 'add', 'X-FORWARDED-FOR').allowed).toBe(true);
    expect(cap('request', 'add', 'X-Forwarded-For').allowed).toBe(true);
  });

  it('invalid header name (contains space) → rejected', () => {
    expect(cap('request', 'override', 'Invalid Header').allowed).toBe(false);
  });

  it('invalid header name (contains colon) → rejected', () => {
    expect(cap('request', 'override', 'Bad:Header').allowed).toBe(false);
  });

  it('header name with leading/trailing whitespace is trimmed', () => {
    expect(cap('request', 'add', '  X-Forwarded-For  ').allowed).toBe(true);
  });

  it('suggestion is "override" for bad append, undefined for bad override', () => {
    expect(cap('request', 'add', 'X-Custom').suggestion).toBe('override');
    expect(cap('request', 'override', 'Host').suggestion).toBeUndefined();
  });
});

describe('getHeaderSuggestions', () => {
  it('request + add: returns ONLY the Chrome DNR allowlist, minus forbidden', () => {
    const suggestions = getHeaderSuggestions('request', 'add');
    // No forbidden entries leak through.
    expect(suggestions).not.toContain('Accept-Encoding');
    expect(suggestions).not.toContain('Connection');
    expect(suggestions).not.toContain('Transfer-Encoding');
    // Legitimate appendable headers are present.
    expect(suggestions).toContain('X-Forwarded-For');
    expect(suggestions).toContain('Cookie');
    expect(suggestions).toContain('Cache-Control');
    // Custom headers are NEVER suggested for append.
    expect(suggestions).not.toContain('X-OH-Stack');
    expect(suggestions).not.toContain('X-API-Key');
  });

  it('response + add: returns ONLY the Chrome DNR response allowlist, minus forbidden', () => {
    const suggestions = getHeaderSuggestions('response', 'add');
    expect(suggestions).not.toContain('Vary'); // forbidden
    expect(suggestions).toContain('Set-Cookie');
    expect(suggestions).toContain('Access-Control-Allow-Headers');
    expect(suggestions).toContain('X-Frame-Options');
  });

  it('request + override: returns curated common list', () => {
    const suggestions = getHeaderSuggestions('request', 'override');
    expect(suggestions).toContain('Authorization');
    expect(suggestions).toContain('Content-Type');
    expect(suggestions).toContain('User-Agent');
    expect(suggestions).not.toContain('Accept-Encoding'); // forbidden
  });

  it('response + override: returns curated common list', () => {
    const suggestions = getHeaderSuggestions('response', 'override');
    expect(suggestions).toContain('Content-Security-Policy');
    expect(suggestions).toContain('Access-Control-Allow-Origin');
    expect(suggestions).toContain('X-Frame-Options');
  });

  it('suggestions for append never contain custom X- headers', () => {
    // Enforces the autocomplete contract: impossible to pick an invalid
    // header from the dropdown for the append operation.
    const reqSuggestions = getHeaderSuggestions('request', 'add');
    const resSuggestions = getHeaderSuggestions('response', 'add');
    const allAppendSuggestions = [...reqSuggestions, ...resSuggestions];
    const customHeaders = allAppendSuggestions.filter((h) => /^x-(oh|custom|my|api-key|trace)/i.test(h));
    expect(customHeaders).toEqual([]);
  });
});

describe('allowlist constants stay in sync with Chrome/Firefox source', () => {
  // This is a canary: if Chrome ever extends or trims its allowlist, these
  // size counts will drift and the test fires. Update the constants
  // in `headers.ts` at the same time as the test counts here — the point is
  // to catch silent edits, not to pin the list forever.

  it('DNR_APPENDABLE_REQUEST_HEADERS size', () => {
    expect(DNR_APPENDABLE_REQUEST_HEADERS.size).toBe(21);
  });

  it('DNR_APPENDABLE_RESPONSE_HEADERS size', () => {
    expect(DNR_APPENDABLE_RESPONSE_HEADERS.size).toBe(13);
  });

  it('all appendable request headers are lowercase (case-insensitive matching)', () => {
    for (const h of DNR_APPENDABLE_REQUEST_HEADERS) {
      expect(h).toBe(h.toLowerCase());
    }
  });

  it('all appendable response headers are lowercase', () => {
    for (const h of DNR_APPENDABLE_RESPONSE_HEADERS) {
      expect(h).toBe(h.toLowerCase());
    }
  });

  it('no COMMON_REQUEST_HEADERS entry is in FORBIDDEN_REQUEST_HEADERS', () => {
    // Redundant guard: if someone adds a header to COMMON and also to
    // FORBIDDEN, getHeaderSuggestions will filter it out — but we want the
    // source lists themselves to stay coherent.
    for (const header of COMMON_REQUEST_HEADERS) {
      expect(cap('request', 'override', header).allowed).toBe(true);
    }
  });

  it('no COMMON_RESPONSE_HEADERS entry is in FORBIDDEN_RESPONSE_HEADERS', () => {
    for (const header of COMMON_RESPONSE_HEADERS) {
      expect(cap('response', 'override', header).allowed).toBe(true);
    }
  });
});

describe('isRuleComplete gate — header rule capability integration', () => {
  const baseRule = {
    schemaVersion: 1,
    uid: 'x1',
    path: 'rules/col/rule-x1',
    name: 'Test',
    enabled: true,
    conditions: [{ type: 'request-domains' as const, values: ['openheaders.io'] }],
  };

  it('marks rule as draft when append is used on non-allowlisted header', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [{ operation: 'add' as const, headerName: 'X-OH-Stack', value: 'a' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(rule)).toBe(false);
  });

  it('keeps rule complete when append is used on allowlisted header', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [{ operation: 'add' as const, headerName: 'X-Forwarded-For', value: '10.0.0.1' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(rule)).toBe(true);
  });

  it('marks rule as draft if any single mod fails capability', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [
          { operation: 'override' as const, headerName: 'X-API-Key', value: 'k' },
          { operation: 'add' as const, headerName: 'X-Custom-Append', value: 'v' }, // invalid
        ],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(rule)).toBe(false);
  });

  it('marks rule as draft when override uses a forbidden header', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [{ operation: 'override' as const, headerName: 'Host', value: 'evil.example' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(rule)).toBe(false);
  });

  it('accepts override + remove mix on response when all headers are valid', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [],
        responseHeaders: [
          { operation: 'override' as const, headerName: 'X-Frame-Options', value: 'DENY' },
          { operation: 'remove' as const, headerName: 'X-Powered-By' },
        ],
      },
    };
    expect(isRuleComplete(rule)).toBe(true);
  });

  it('accepts merge on custom header (scriptable path)', () => {
    const rule = {
      ...baseRule,
      type: 'header' as const,
      action: {
        requestHeaders: [{ operation: 'merge' as const, headerName: 'X-OH-Stack', value: 'a', mergeSeparator: '; ' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(rule)).toBe(true);
  });
});
