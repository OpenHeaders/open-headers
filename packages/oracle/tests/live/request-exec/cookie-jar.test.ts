/**
 * The host-neutral cookie jar's seam-side legs — lifted into oracle
 * at Phase W: `parseSetCookie` reads one `Set-Cookie` row to the jar's
 * input (name=value, Domain / Path / Max-Age / Expires / Secure; a
 * nameless row is null), `withJarCookieHeader` attaches the jar's
 * contribution unless a user-set Cookie header wins,
 * `captureSetCookieRows` stores every Set-Cookie row of an answer
 * through the jar's own matching and expiry. The jar's matching
 * itself stays pinned in the node host's `cookie-jar.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CookieJar,
  captureSetCookieRows,
  cookieJarFor,
  parseSetCookie,
  resetCookieJars,
  withJarCookieHeader,
} from '../../../src/live/request-exec/cookie-jar';
import { setOracleHostHooks } from '../../../src/sync/host-hooks';

describe('parseSetCookie', () => {
  it('reads the pair and the attributes the jar models, ignoring the rest', () => {
    expect(parseSetCookie('sid=abc; Domain=.openheaders.io; Path=/api; Max-Age=60; Secure; HttpOnly')).toEqual({
      name: 'sid',
      value: 'abc',
      domain: '.openheaders.io',
      path: '/api',
      maxAge: 60,
      secure: true,
    });
  });

  it('reads Expires as a date and keeps a value with an equals sign whole', () => {
    const parsed = parseSetCookie('token=a=b; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
    expect(parsed?.value).toBe('a=b');
    expect(parsed?.expires?.toISOString()).toBe('2026-10-21T07:28:00.000Z');
  });

  it('refuses a nameless row and drops an unreadable Expires or Max-Age', () => {
    expect(parseSetCookie('=orphan')).toBeNull();
    expect(parseSetCookie('no-pair')).toBeNull();
    expect(parseSetCookie('a=1; Expires=never; Max-Age=soon')).toEqual({ name: 'a', value: '1' });
  });
});

describe('withJarCookieHeader / captureSetCookieRows', () => {
  beforeEach(() => resetCookieJars());

  it('captures every Set-Cookie row of an answer and attaches the match to the next send', () => {
    const jar = cookieJarFor('ws-1');
    const stored = captureSetCookieRows(jar, 'https://api.openheaders.io/login', [
      { key: 'content-type', value: 'application/json' },
      { key: 'set-cookie', value: 'sid=abc; Path=/' },
      { key: 'Set-Cookie', value: 'theme=dark; Path=/settings' },
      { key: 'set-cookie', value: '=nameless' },
    ]);
    expect(stored).toEqual(['sid', 'theme']);
    expect(withJarCookieHeader(jar, 'https://api.openheaders.io/items', [])).toEqual({
      headers: [{ key: 'Cookie', value: 'sid=abc' }],
      attached: 'sid=abc',
    });
  });

  it('never overrides a user-set Cookie header, and adds nothing when the jar matches nothing', () => {
    const jar = new CookieJar();
    jar.store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc' }]);
    const own = [{ key: 'Cookie', value: 'sid=mine' }];
    expect(withJarCookieHeader(jar, 'https://api.openheaders.io/', own)).toEqual({ headers: own });
    expect(withJarCookieHeader(jar, 'https://other.openheaders.io/', [])).toEqual({ headers: [] });
    expect(captureSetCookieRows(jar, 'https://api.openheaders.io/', [])).toEqual([]);
  });
});

describe("the jar's change signal — the host's broadcastCookieJarChanged hook, named by the jar's key", () => {
  const changed = vi.fn<(workspaceId: string) => void>();

  beforeEach(() => {
    resetCookieJars();
    changed.mockReset();
    setOracleHostHooks({ broadcastCookieJarChanged: changed });
  });

  afterEach(() => {
    setOracleHostHooks({});
  });

  it('fires on a store that wrote, a clear and a delete that hit — once each, with the key', () => {
    const jar = cookieJarFor('ws-1');
    jar.store('https://api.openheaders.io/', [
      { name: 'sid', value: 'abc' },
      { name: 'theme', value: 'dark' },
    ]);
    expect(changed.mock.calls).toEqual([['ws-1']]);
    jar.delete('theme', 'api.openheaders.io', '/');
    expect(changed).toHaveBeenCalledTimes(2);
    jar.clear();
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('stays quiet when nothing changed — an empty store, a delete that misses, a clear of an empty jar, a read', () => {
    const jar = cookieJarFor('ws-2');
    jar.store('https://api.openheaders.io/', []);
    jar.store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc', domain: 'elsewhere.io' }]);
    jar.delete('nope', 'api.openheaders.io', '/');
    jar.clear();
    expect(changed).not.toHaveBeenCalled();
    jar.store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc', maxAge: 1 }]);
    expect(changed).toHaveBeenCalledTimes(1);
    // A read's lazy expiry sweep is not a change the surfaces are told of.
    vi.useFakeTimers();
    vi.advanceTimersByTime(2_000);
    expect(jar.list()).toEqual([]);
    vi.useRealTimers();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('a jar with no host hook and a bare CookieJar stay silent', () => {
    setOracleHostHooks({});
    cookieJarFor('ws-3').store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc' }]);
    new CookieJar().store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc' }]);
    expect(changed).not.toHaveBeenCalled();
  });
});
