/**
 * The registered public clients of the daemon's person sign-in (the
 * client sign-in plan §14.6): the three ids, their grants, and the
 * redirect rule — exact match, the desktop's loopback on any port, the
 * extension's identity-API hosts pinned to the published ids.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DAEMON_AUTHORIZATION_CLIENTS,
  DAEMON_CLI_CLIENT_ID,
  DAEMON_DESKTOP_CLIENT_ID,
  DAEMON_EXTENSION_CLIENT_ID,
  findDaemonAuthorizationClient,
  GECKO_IDENTITY_REDIRECT_HOSTS,
  isRegisteredRedirect,
} from '../../src/identity';
import { CHROME_EXTENSION_ID, EDGE_EXTENSION_ID, GECKO_EXTENSION_IDS } from '../../src/protocol';

describe('registered authorization clients', () => {
  it('declares three public clients with the grants the plan assigns', () => {
    expect(DAEMON_AUTHORIZATION_CLIENTS.map((client) => [client.id, client.kind, client.grants])).toEqual([
      [DAEMON_DESKTOP_CLIENT_ID, 'desktop', ['code']],
      [DAEMON_EXTENSION_CLIENT_ID, 'extension', ['code', 'device']],
      [DAEMON_CLI_CLIENT_ID, 'cli', ['device']],
    ]);
    expect(findDaemonAuthorizationClient(DAEMON_EXTENSION_CLIENT_ID)?.name).toBe('the browser extension');
    expect(findDaemonAuthorizationClient('openheaders-phone')).toBeNull();
  });

  it("pins the Gecko identity redirect hosts to the SHA-1 hex of the add-on ids — Firefox's own derivation", () => {
    const derived = GECKO_EXTENSION_IDS.map(
      (id) => `${createHash('sha1').update(id, 'utf8').digest('hex')}.extensions.allizom.org`,
    );
    expect(GECKO_IDENTITY_REDIRECT_HOSTS).toEqual(derived);
  });

  describe('the desktop redirect — the loopback callback on any port', () => {
    it('accepts both loopback literals on any port with the exact path', () => {
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:8137/oauth/callback')).toBe(true);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:51234/oauth/callback')).toBe(true);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1/oauth/callback')).toBe(true);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://[::1]:8137/oauth/callback')).toBe(true);
    });

    it('refuses localhost, a foreign host, https, a path mismatch and a query or fragment', () => {
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://localhost:8137/oauth/callback')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://192.168.1.20:8137/oauth/callback')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://evil.openheaders.io/oauth/callback')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'https://127.0.0.1:8137/oauth/callback')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:8137/oauth/callback/')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:8137/callback')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:8137/oauth/callback?x=1')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'http://127.0.0.1:8137/oauth/callback#f')).toBe(false);
      expect(isRegisteredRedirect(DAEMON_DESKTOP_CLIENT_ID, 'not a url')).toBe(false);
    });
  });

  describe('the extension redirect — the identity-API hosts of the published ids', () => {
    it('accepts the Chromium hosts of the pinned ids and the Gecko hosts of the add-on ids', () => {
      expect(
        isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, `https://${CHROME_EXTENSION_ID}.chromiumapp.org/callback`),
      ).toBe(true);
      expect(
        isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, `https://${EDGE_EXTENSION_ID}.chromiumapp.org/callback`),
      ).toBe(true);
      for (const host of GECKO_IDENTITY_REDIRECT_HOSTS) {
        expect(isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, `https://${host}/callback`)).toBe(true);
      }
    });

    it('refuses an unpinned extension id, http, a port, a path mismatch and a foreign domain', () => {
      expect(
        isRegisteredRedirect(
          DAEMON_EXTENSION_CLIENT_ID,
          'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/callback',
        ),
      ).toBe(false);
      expect(
        isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, `http://${CHROME_EXTENSION_ID}.chromiumapp.org/callback`),
      ).toBe(false);
      expect(
        isRegisteredRedirect(
          DAEMON_EXTENSION_CLIENT_ID,
          `https://${CHROME_EXTENSION_ID}.chromiumapp.org:8443/callback`,
        ),
      ).toBe(false);
      expect(isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, `https://${CHROME_EXTENSION_ID}.chromiumapp.org/`)).toBe(
        false,
      );
      expect(
        isRegisteredRedirect(
          DAEMON_EXTENSION_CLIENT_ID,
          `https://${CHROME_EXTENSION_ID}.chromiumapp.org.openheaders.io/callback`,
        ),
      ).toBe(false);
      expect(isRegisteredRedirect(DAEMON_EXTENSION_CLIENT_ID, 'https://deadbeef.extensions.allizom.org/callback')).toBe(
        false,
      );
    });
  });

  it('the CLI registers no redirect: every URI is refused, as is an unknown client', () => {
    expect(isRegisteredRedirect(DAEMON_CLI_CLIENT_ID, 'http://127.0.0.1:8137/oauth/callback')).toBe(false);
    expect(isRegisteredRedirect('openheaders-phone', 'http://127.0.0.1:8137/oauth/callback')).toBe(false);
  });
});
