import type { InspectorHarEntry } from '@openheaders/core/types';
import {
  enrichCookies,
  explainFilteredOut,
  parseSetCookieLine,
} from '@openheaders/ui/panel/data/cookies/cookie-enrich';
import { cookieEditKey } from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import type { JarCookie } from '@openheaders/ui/panel/host-cookie-jar';
import { describe, expect, it } from 'vitest';

const NOW = Date.UTC(2026, 4, 18, 23, 0, 0); // 2026-05-18T23:00:00Z

function jar(over: Partial<JarCookie> = {}): JarCookie {
  return {
    name: 'session',
    value: 'cached-value',
    domain: '.openheaders.io',
    path: '/',
    hostOnly: false,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    session: false,
    expirationDate: Math.floor(NOW / 1000) + 86400,
    ...over,
  };
}

function har(over: Partial<InspectorHarEntry> = {}): InspectorHarEntry {
  return {
    startedDateTime: new Date(NOW).toISOString(),
    time: 0,
    request: {
      method: 'GET',
      url: 'https://openheaders.io/',
      httpVersion: '',
      cookies: [],
      headers: [],
      queryString: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: '',
      cookies: [],
      headers: [],
      content: { size: 0, mimeType: '' },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    ...over,
  } as InspectorHarEntry;
}

describe('parseSetCookieLine', () => {
  it('parses a basic Set-Cookie with Secure / HttpOnly / SameSite', () => {
    const row = parseSetCookieLine('sid=abc; Path=/; Secure; HttpOnly; SameSite=None', NOW);
    expect(row).toMatchObject({
      name: 'sid',
      value: 'abc',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'no_restriction',
      session: true,
    });
    expect(row?.attribution).toBe('response-set');
  });

  it('translates Max-Age to expirationDate, overriding Expires', () => {
    const row = parseSetCookieLine('s=1; Expires=Wed, 01 Jan 2020 00:00:00 GMT; Max-Age=120', NOW);
    expect(row?.maxAge).toBe(120);
    expect(row?.expirationDate).toBe(Math.floor(NOW / 1000) + 120);
    expect(row?.session).not.toBe(true);
  });

  it('flags session cookies when neither Expires nor Max-Age is present', () => {
    const row = parseSetCookieLine('s=1; Secure', NOW);
    expect(row?.session).toBe(true);
    expect(row?.expirationDate).toBeUndefined();
  });

  it('captures Priority and Partitioned', () => {
    const row = parseSetCookieLine('s=1; Priority=High; Partitioned; Secure', NOW);
    expect(row?.priority).toBe('High');
    expect(row?.partitionKey).toBeDefined();
  });

  it('returns null on empty input', () => {
    expect(parseSetCookieLine('', NOW)).toBeNull();
    expect(parseSetCookieLine('   ', NOW)).toBeNull();
  });
});

describe('enrichCookies', () => {
  it('joins HAR request cookies against the jar by name', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/api',
      har: har({
        request: {
          method: 'GET',
          url: 'https://openheaders.io/api',
          httpVersion: '',
          queryString: [],
          headers: [],
          headersSize: -1,
          bodySize: -1,
          cookies: [{ name: 'session', value: 'request-sent-value' }],
        },
      }),
      jar: [jar()],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.request).toHaveLength(1);
    expect(result.request[0]).toMatchObject({
      name: 'session',
      value: 'request-sent-value', // HAR's value beats jar's cached value
      domain: '.openheaders.io',
      secure: true,
      httpOnly: true,
      attribution: 'request-jar',
    });
    // The live entry stays reachable for Edit / Delete even though the
    // row's value was rewound to what the request carried.
    expect(result.request[0].jarCookie?.value).toBe('cached-value');
  });

  it('falls back to har-only attribution when no jar match', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/api',
      har: har({
        request: {
          method: 'GET',
          url: 'https://openheaders.io/api',
          httpVersion: '',
          queryString: [],
          headers: [],
          headersSize: -1,
          bodySize: -1,
          cookies: [{ name: 'orphan', value: 'v' }],
        },
      }),
      jar: [jar({ name: 'session' })],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.request[0].attribution).toBe('request-har');
    expect(result.request[0].domain).toBeUndefined();
  });

  it('maps repeated cookie names to distinct jar entries with unique ids', () => {
    // The Cookie header carried `tz` twice — one per matching jar entry on
    // different scopes. Each row must claim a DISTINCT jar cookie and get a
    // unique id (duplicate React keys corrupt list reconciliation).
    const result = enrichCookies({
      url: 'https://app.openheaders.io/',
      har: har({
        request: {
          method: 'GET',
          url: 'https://app.openheaders.io/',
          httpVersion: '',
          queryString: [],
          headers: [],
          headersSize: -1,
          bodySize: -1,
          cookies: [
            { name: 'tz', value: 'Europe/Madrid' },
            { name: 'tz', value: 'Europe/Madrid' },
          ],
        },
      }),
      jar: [
        jar({ name: 'tz', domain: '.openheaders.io', path: '/' }),
        jar({ name: 'tz', domain: 'app.openheaders.io', path: '/' }),
      ],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.request).toHaveLength(2);
    const ids = result.request.map((r) => r.id);
    expect(new Set(ids).size).toBe(2); // unique
    expect(result.request.map((r) => r.domain).sort()).toEqual(['.openheaders.io', 'app.openheaders.io']);
  });

  it('surfaces filtered-out jar cookies when toggle is on', () => {
    const result = enrichCookies({
      url: 'http://openheaders.io/api', // http triggers Secure-only filter reason
      har: har({
        request: {
          method: 'GET',
          url: 'http://openheaders.io/api',
          httpVersion: '',
          queryString: [],
          headers: [],
          headersSize: -1,
          bodySize: -1,
          cookies: [],
        },
      }),
      jar: [jar({ name: 'secure-only', secure: true })],
      showFilteredOut: true,
      now: NOW,
    });
    expect(result.request).toHaveLength(1);
    expect(result.request[0].attribution).toBe('filtered-out');
    expect(result.request[0].filteredReason).toMatch(/Secure/i);
  });

  it('parses every Set-Cookie response header into its own row', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: har({
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: '',
          cookies: [],
          content: { size: 0, mimeType: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
          headers: [
            { name: 'Set-Cookie', value: 'a=1; Path=/; Secure' },
            { name: 'set-cookie', value: 'b=2; HttpOnly' },
            { name: 'Content-Type', value: 'text/html' },
          ],
        },
      }),
      jar: null,
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.response).toHaveLength(2);
    expect(result.response.map((r) => r.name).sort()).toEqual(['a', 'b']);
    expect(result.responseBytes).toBeGreaterThan(0);
  });

  it('joins a response Set-Cookie row to its jar entry', () => {
    const jarEntry = jar({ name: 'sid', value: 'live', domain: 'openheaders.io', hostOnly: true });
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: har({
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: '',
          cookies: [],
          content: { size: 0, mimeType: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
          headers: [{ name: 'Set-Cookie', value: 'sid=abc; Secure' }],
        },
      }),
      jar: [jarEntry],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.response[0].jarCookie).toBe(jarEntry);
    // Columns keep the header's own facts, not the jar's.
    expect(result.response[0].value).toBe('abc');
  });

  it('matches the jar entry by domain (dot-insensitive) when the line names one', () => {
    const wide = jar({ name: 'sid', domain: '.openheaders.io' });
    const sub = jar({ name: 'sid', domain: 'app.openheaders.io', hostOnly: true });
    const result = enrichCookies({
      url: 'https://app.openheaders.io/',
      har: har({
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: '',
          cookies: [],
          content: { size: 0, mimeType: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
          headers: [{ name: 'Set-Cookie', value: 'sid=x; Domain=openheaders.io' }],
        },
      }),
      jar: [wide, sub],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.response[0].jarCookie).toBe(wide);
  });

  it('leaves the row jar-less when several jar cookies are plausible', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: har({
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: '',
          cookies: [],
          content: { size: 0, mimeType: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1,
          headers: [{ name: 'Set-Cookie', value: 'sid=x' }],
        },
      }),
      jar: [
        jar({ name: 'sid', domain: '.openheaders.io' }),
        jar({ name: 'sid', domain: 'openheaders.io', hostOnly: true }),
      ],
      showFilteredOut: false,
      now: NOW,
    });
    expect(result.response[0].jarCookie).toBeUndefined();
  });
});

describe('enrichCookies — edited cookies', () => {
  const sentHar = har({
    request: {
      method: 'GET',
      url: 'https://openheaders.io/',
      httpVersion: '',
      headers: [],
      queryString: [],
      headersSize: -1,
      bodySize: -1,
      cookies: [{ name: '_octo', value: 'GH1.1.x.4' }],
    },
  });
  const octo = jar({ name: '_octo', value: 'GH1.1.x.3', domain: '.github.com', path: '/' });
  const edited = new Set([cookieEditKey('_octo', '.github.com', '/')]);

  it('shows the live jar value (not the request-carried one) for an edited cookie', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: sentHar,
      jar: [octo],
      showFilteredOut: false,
      editedKeys: edited,
      now: NOW,
    });
    const row = result.request.find((r) => r.name === '_octo');
    expect(row?.value).toBe('GH1.1.x.3'); // the edit, not GH1.1.x.4
    expect(row?.edited).toBe(true);
    expect(row?.sentValue).toBe('GH1.1.x.4');
    expect(row?.size).toBe('_octo'.length + 1 + 'GH1.1.x.3'.length);
  });

  it('keeps the request-carried value when the cookie was not edited', () => {
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: sentHar,
      jar: [octo],
      showFilteredOut: false,
      now: NOW,
    });
    const row = result.request.find((r) => r.name === '_octo');
    expect(row?.value).toBe('GH1.1.x.4');
    expect(row?.edited).toBeUndefined();
    expect(row?.sentValue).toBeUndefined();
  });

  it('flags edited even when the edited value equals what was sent', () => {
    const same = jar({ name: '_octo', value: 'GH1.1.x.4', domain: '.github.com', path: '/' });
    const result = enrichCookies({
      url: 'https://openheaders.io/',
      har: sentHar,
      jar: [same],
      showFilteredOut: false,
      editedKeys: edited,
      now: NOW,
    });
    const row = result.request.find((r) => r.name === '_octo');
    expect(row?.edited).toBe(true);
    expect(row?.value).toBe('GH1.1.x.4');
    expect(row?.sentValue).toBeUndefined();
  });
});

describe('explainFilteredOut', () => {
  const url = new URL('https://openheaders.io/account/settings');

  it('orders expiry before scheme before domain before path', () => {
    expect(explainFilteredOut(jar({ expirationDate: Math.floor(NOW / 1000) - 10 }), url, NOW)).toBe('expired');
    expect(explainFilteredOut(jar({ secure: true }), new URL('http://openheaders.io/'), NOW)).toBe(
      'Secure cookie on http',
    );
  });

  it('explains a host-only cookie scoped to another host as a domain mismatch', () => {
    expect(explainFilteredOut(jar({ hostOnly: true, domain: 'app.openheaders.io', secure: false }), url, NOW)).toBe(
      'domain mismatch (cookie domain app.openheaders.io)',
    );
  });

  it('accepts a parent-domain cookie for a subdomain host', () => {
    const subUrl = new URL('https://app.openheaders.io/');
    expect(
      explainFilteredOut(jar({ domain: '.openheaders.io', secure: false, sameSite: 'unspecified' }), subUrl, NOW),
    ).toBe('not sent');
  });

  it('explains a path-scoped cookie against the scope path', () => {
    expect(explainFilteredOut(jar({ path: '/admin', secure: false }), url, NOW)).toBe(
      'path mismatch (cookie path /admin)',
    );
  });
});
