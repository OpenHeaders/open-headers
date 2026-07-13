import { beforeEach, describe, expect, it } from 'vitest';
import { CookieJar, cookieJarFor, peekCookieJar, resetCookieJars } from '../../src/live/cookie-jar';

describe('CookieJar', () => {
  describe('store + cookieHeaderFor', () => {
    it('stores a host-only cookie and attaches it to the same host only', () => {
      const jar = new CookieJar();
      const stored = jar.store('https://api.openheaders.io/login', [{ name: 'session', value: 'abc123' }]);
      expect(stored).toEqual(['session']);
      expect(jar.cookieHeaderFor('https://api.openheaders.io/users')).toBe('session=abc123');
      expect(jar.cookieHeaderFor('https://openheaders.io/users')).toBeUndefined();
      expect(jar.cookieHeaderFor('https://www.openheaders.io/users')).toBeUndefined();
    });

    it('a Domain attribute widens the cookie to subdomains and normalizes a leading dot', () => {
      const jar = new CookieJar();
      jar.store('https://api.openheaders.io/', [{ name: 'tenant', value: 't1', domain: '.openheaders.io' }]);
      expect(jar.cookieHeaderFor('https://api.openheaders.io/')).toBe('tenant=t1');
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBe('tenant=t1');
      expect(jar.cookieHeaderFor('https://www.openheaders.io/')).toBe('tenant=t1');
      expect(jar.cookieHeaderFor('https://openheaders.dev/')).toBeUndefined();
    });

    it('rejects a Domain the setting host does not fall under', () => {
      const jar = new CookieJar();
      const stored = jar.store('https://api.openheaders.io/', [
        { name: 'evil', value: '1', domain: 'openheaders.dev' },
        // A sibling host is not a suffix match either.
        { name: 'sibling', value: '1', domain: 'cdn.openheaders.io' },
      ]);
      expect(stored).toEqual([]);
      expect(jar.cookieHeaderFor('https://openheaders.dev/')).toBeUndefined();
      expect(jar.cookieHeaderFor('https://cdn.openheaders.io/')).toBeUndefined();
    });

    it('path-matches at slash boundaries; a Path attribute scopes attachment', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'scoped', value: '1', path: '/app' }]);
      expect(jar.cookieHeaderFor('https://openheaders.io/app')).toBe('scoped=1');
      expect(jar.cookieHeaderFor('https://openheaders.io/app/settings')).toBe('scoped=1');
      expect(jar.cookieHeaderFor('https://openheaders.io/application')).toBeUndefined();
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
    });

    it('defaults the path to the setting URL directory when no Path attribute is given', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/auth/login', [{ name: 'session', value: 's' }]);
      // Default path is /auth — the sibling endpoint matches, the root doesn't.
      expect(jar.cookieHeaderFor('https://openheaders.io/auth/refresh')).toBe('session=s');
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
    });

    it('replaces a cookie by (name, domain, path) identity', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'session', value: 'old' }]);
      jar.store('https://openheaders.io/', [{ name: 'session', value: 'new' }]);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBe('session=new');
    });

    it('joins multiple matches with longer paths first', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [
        { name: 'root', value: 'r', path: '/' },
        { name: 'deep', value: 'd', path: '/app/settings' },
      ]);
      expect(jar.cookieHeaderFor('https://openheaders.io/app/settings')).toBe('deep=d; root=r');
    });
  });

  describe('expiry', () => {
    it('Max-Age wins over Expires and a non-positive Max-Age deletes the stored cookie', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'session', value: 's' }]);
      const stored = jar.store('https://openheaders.io/', [
        { name: 'session', value: 's', maxAge: 0, expires: new Date(Date.now() + 60_000) },
      ]);
      expect(stored).toEqual([]);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
    });

    it('a past Expires deletes; a future one stores and later lapses', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'gone', value: '1', expires: new Date(Date.now() - 1000) }]);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
      jar.store('https://openheaders.io/', [{ name: 'brief', value: '1', expires: new Date(Date.now() + 50) }]);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBe('brief=1');
    });

    it('an expired cookie stops attaching', async () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'brief', value: '1', expires: new Date(Date.now() + 20) }]);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
    });
  });

  describe('secure', () => {
    it('a Secure cookie attaches over https only', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'sec', value: '1', secure: true }]);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBe('sec=1');
      expect(jar.cookieHeaderFor('http://openheaders.io/')).toBeUndefined();
    });
  });

  describe('bound', () => {
    it('caps the jar, evicting the oldest stored cookie past the bound', () => {
      const jar = new CookieJar();
      for (let i = 0; i < 513; i++) {
        jar.store('https://openheaders.io/', [{ name: `c${i}`, value: 'v', path: '/' }]);
      }
      const header = jar.cookieHeaderFor('https://openheaders.io/');
      expect(header).toBeDefined();
      expect(header).not.toContain('c0=');
      expect(header).toContain('c512=');
    });
  });

  describe('list', () => {
    it('exposes matching metadata only — cookie values never appear', () => {
      const jar = new CookieJar();
      jar.store('https://api.openheaders.io/auth/login', [
        { name: 'session', value: 'top-secret' },
        { name: 'tenant', value: 't1', domain: '.openheaders.io', path: '/', secure: true },
      ]);
      const entries = jar.list();
      expect(entries).toEqual([
        { name: 'session', domain: 'api.openheaders.io', hostOnly: true, path: '/auth', secure: false },
        { name: 'tenant', domain: 'openheaders.io', hostOnly: false, path: '/', secure: true },
      ]);
      for (const entry of entries) {
        expect(entry).not.toHaveProperty('value');
        expect(JSON.stringify(entry)).not.toContain('top-secret');
      }
    });

    it('carries expiry as epoch ms and sweeps lapsed entries out', async () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [
        { name: 'brief', value: '1', expires: new Date(Date.now() + 20) },
        { name: 'lasting', value: '1', maxAge: 3600 },
      ]);
      const before = jar.list();
      expect(before).toHaveLength(2);
      expect(before[0].expiresAt).toBeDefined();
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(jar.list().map((c) => c.name)).toEqual(['lasting']);
    });

    it('empties after clear', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'session', value: 's' }]);
      jar.clear();
      expect(jar.list()).toEqual([]);
    });
  });

  describe('delete', () => {
    it('drops exactly the (name, domain, path) identity, leaving same-name siblings', () => {
      const jar = new CookieJar();
      jar.store('https://api.openheaders.io/', [
        { name: 'session', value: 'a', path: '/' },
        { name: 'session', value: 'b', path: '/app' },
        { name: 'tenant', value: 't', domain: '.openheaders.io', path: '/' },
      ]);
      jar.delete('session', 'api.openheaders.io', '/');
      expect(jar.list().map((c) => `${c.name}|${c.domain}|${c.path}`)).toEqual([
        'session|api.openheaders.io|/app',
        'tenant|openheaders.io|/',
      ]);
    });

    it('misses quietly — an unknown identity leaves the jar untouched', () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [{ name: 'session', value: 's' }]);
      jar.delete('session', 'openheaders.io', '/app');
      jar.delete('other', 'openheaders.io', '/');
      expect(jar.list().map((c) => c.name)).toEqual(['session']);
      expect(jar.cookieHeaderFor('https://openheaders.io/')).toBe('session=s');
    });

    it('sweeps lapsed entries like an attach does', async () => {
      const jar = new CookieJar();
      jar.store('https://openheaders.io/', [
        { name: 'brief', value: '1', expires: new Date(Date.now() + 20) },
        { name: 'lasting', value: '1', maxAge: 3600 },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 40));
      jar.delete('lasting', 'openheaders.io', '/');
      expect(jar.list()).toEqual([]);
    });
  });

  describe('registry', () => {
    beforeEach(() => {
      resetCookieJars();
    });

    it('returns the same jar per key and distinct jars across keys', () => {
      const a = cookieJarFor('ws-a');
      a.store('https://openheaders.io/', [{ name: 'session', value: 'a' }]);
      expect(cookieJarFor('ws-a')).toBe(a);
      expect(cookieJarFor('ws-b').cookieHeaderFor('https://openheaders.io/')).toBeUndefined();
    });

    it('peeking never mints a jar; an existing one is returned as-is', () => {
      expect(peekCookieJar('ws-a')).toBeUndefined();
      const a = cookieJarFor('ws-a');
      expect(peekCookieJar('ws-a')).toBe(a);
      expect(peekCookieJar('ws-b')).toBeUndefined();
    });
  });
});
