/**
 * Presence verb — message-shape validation and the anchored answer:
 * running at all IS presence, and `anchored` mirrors exactly what the
 * launch verb would enforce (dev layouts and gutted installs say no).
 */

import { describe, expect, it } from 'vitest';
import { parsePresenceRequest, performPresence } from '../../src/presence';

describe('parsePresenceRequest', () => {
  it('accepts the presence shape and refuses foreign ones', () => {
    expect(parsePresenceRequest({ kind: 'presence' })).toEqual({ kind: 'presence' });
    expect(parsePresenceRequest(null)).toBeNull();
    expect(parsePresenceRequest({ kind: 'launch' })).toBeNull();
  });
});

describe('performPresence', () => {
  it('a dev-layout host answers unanchored — no install root to launch from', () => {
    const result = performPresence({
      ownExecutablePath: '/repo/apps/nm-host/dist-bun/oh-nm-host',
      platform: 'darwin',
    });
    expect(result).toEqual({ ok: true, anchored: false });
  });

  it('a host inside the macOS bundle answers anchored', () => {
    const result = performPresence({
      ownExecutablePath: '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host',
      platform: 'darwin',
    });
    expect(result).toEqual({ ok: true, anchored: true });
  });

  it('a packaged install whose app binary is gone answers unanchored', () => {
    const result = performPresence({
      ownExecutablePath: 'C:\\Users\\dev\\AppData\\Local\\Programs\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      fileExists: () => false,
    });
    expect(result).toEqual({ ok: true, anchored: false });
  });

  it('an intact packaged Windows install answers anchored', () => {
    const result = performPresence({
      ownExecutablePath: 'C:\\Users\\dev\\AppData\\Local\\Programs\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      fileExists: () => true,
    });
    expect(result).toEqual({ ok: true, anchored: true });
  });
});
