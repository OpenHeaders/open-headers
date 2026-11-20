import { jarCookieRowKey, type SiteJarCookie } from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { cookieRevealTarget, isCookieHeader } from '@openheaders/ui/panel/data/cookies/cookie-reveal';
import { describe, expect, it } from 'vitest';

const REQUEST_URL = 'https://app.openheaders.io/account?tab=profile';

function makeCookie(over: Partial<SiteJarCookie> = {}): SiteJarCookie {
  return {
    name: 'session',
    value: 'abc123',
    domain: 'app.openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    session: true,
    sendable: true,
    ...over,
  };
}

describe('isCookieHeader', () => {
  it('is the Cookie header on a request and Set-Cookie on a response, any casing', () => {
    expect(isCookieHeader('Cookie', 'request')).toBe(true);
    expect(isCookieHeader('cookie', 'request')).toBe(true);
    expect(isCookieHeader('Set-Cookie', 'response')).toBe(true);
    expect(isCookieHeader('SET-COOKIE', 'response')).toBe(true);
  });

  it('is nothing else — and never the other direction', () => {
    expect(isCookieHeader('Set-Cookie', 'request')).toBe(false);
    expect(isCookieHeader('Cookie', 'response')).toBe(false);
    expect(isCookieHeader('Cookie2', 'request')).toBe(false);
    expect(isCookieHeader('Cache-Control', 'response')).toBe(false);
  });
});

describe('cookieRevealTarget — a Cookie request header', () => {
  it('points at the sendable jar cookies of the names the header carries', () => {
    const session = makeCookie();
    const tz = makeCookie({ name: 'tz', value: 'Europe%2FMadrid', domain: '.openheaders.io', hostOnly: false });
    const theme = makeCookie({ name: 'theme', value: 'dark' });
    const target = cookieRevealTarget('request', 'session=abc123; tz=Europe%2FMadrid', REQUEST_URL, [
      session,
      tz,
      theme,
    ]);
    expect(target.rows).toEqual([jarCookieRowKey(session), jarCookieRowKey(tz)]);
    expect(target.origin).toBe('https://app.openheaders.io');
  });

  it('points at every sendable row of a name the jar holds more than once', () => {
    const hostTz = makeCookie({ name: 'tz' });
    const domainTz = makeCookie({ name: 'tz', domain: '.openheaders.io', hostOnly: false });
    const target = cookieRevealTarget('request', 'tz=Europe%2FMadrid; tz=Europe%2FBerlin', REQUEST_URL, [
      hostTz,
      domainTz,
    ]);
    expect(target.rows).toEqual([jarCookieRowKey(hostTz), jarCookieRowKey(domainTz)]);
  });

  it('leaves out a same-named cookie the browser would not attach to this request', () => {
    const sent = makeCookie();
    const elsewhere = makeCookie({ domain: 'docs.openheaders.io', sendable: false });
    const target = cookieRevealTarget('request', 'session=abc123', REQUEST_URL, [sent, elsewhere]);
    expect(target.rows).toEqual([jarCookieRowKey(sent)]);
  });

  it('points at nothing when the jar holds none of them', () => {
    expect(cookieRevealTarget('request', 'session=abc123', REQUEST_URL, []).rows).toEqual([]);
  });
});

describe('cookieRevealTarget — a Set-Cookie response header', () => {
  it('points at the jar cookie the line names, matched on its stated domain and path', () => {
    const produced = makeCookie({ domain: '.openheaders.io', hostOnly: false, path: '/account' });
    const otherPath = makeCookie({ domain: '.openheaders.io', hostOnly: false, path: '/' });
    const target = cookieRevealTarget(
      'response',
      'session=abc123; Domain=openheaders.io; Path=/account; Secure; HttpOnly',
      REQUEST_URL,
      [produced, otherPath],
    );
    expect(target.rows).toEqual([jarCookieRowKey(produced)]);
  });

  it('points at every candidate when the line left domain and path out', () => {
    const host = makeCookie();
    const wide = makeCookie({ domain: '.openheaders.io', hostOnly: false });
    const target = cookieRevealTarget('response', 'session=abc123; Secure', REQUEST_URL, [host, wide]);
    expect(target.rows).toEqual([jarCookieRowKey(host), jarCookieRowKey(wide)]);
  });

  it('reaches a cookie the request URL would not be sent — a Set-Cookie can set any path', () => {
    const scoped = makeCookie({ path: '/billing', sendable: false });
    const target = cookieRevealTarget('response', 'session=abc123; Path=/billing', REQUEST_URL, [scoped]);
    expect(target.rows).toEqual([jarCookieRowKey(scoped)]);
  });

  it('points at nothing for a line with no cookie in it', () => {
    expect(cookieRevealTarget('response', '', REQUEST_URL, [makeCookie()]).rows).toEqual([]);
  });
});

describe('cookieRevealTarget — origin', () => {
  it('is empty for a URL that does not parse', () => {
    expect(cookieRevealTarget('request', 'session=abc123', 'not-a-url', []).origin).toBe('');
  });
});
