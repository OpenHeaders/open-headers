/**
 * `isLoopbackBackend` — the loopback classification driving the
 * active-workspace mirroring gate. Derived purely from the primary
 * `OH.backends` record (enabled + url); the registry mirror is mocked so
 * each case sets its own.
 */

import type { BackendConnection } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

let primary: BackendConnection | null = null;

vi.mock('@openheaders/core/backends', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/backends')>();
  return {
    ...actual,
    getPrimaryBackend: vi.fn(() => primary),
  };
});

import { isLoopbackBackend } from '../../../src/background/backend-target';

function makePrimary(overrides: Partial<BackendConnection>): BackendConnection {
  return {
    id: 'backend-1',
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-01T00:00:00.000Z',
    lastConnectedAt: null,
    ...overrides,
  };
}

describe('isLoopbackBackend', () => {
  it('treats a missing or disabled backend as loopback regardless of url', () => {
    primary = null;
    expect(isLoopbackBackend()).toBe(true);
    primary = makePrimary({ url: 'wss://daemon.openheaders.io', enabled: false });
    expect(isLoopbackBackend()).toBe(true);
  });

  it('classifies loopback hosts as loopback', () => {
    for (const url of ['ws://127.0.0.1:59210', 'ws://localhost:59210', 'ws://[::1]:59210', 'ws://127.5.5.5:8137']) {
      primary = makePrimary({ url });
      expect(isLoopbackBackend(), url).toBe(true);
    }
  });

  it('classifies LAN / WAN hosts as non-loopback', () => {
    for (const url of ['ws://192.168.1.50:59210', 'ws://10.0.0.7:59210', 'wss://daemon.openheaders.io']) {
      primary = makePrimary({ url });
      expect(isLoopbackBackend(), url).toBe(false);
    }
  });

  it('returns false for an absent or malformed url on an enabled backend', () => {
    primary = makePrimary({ url: '' });
    expect(isLoopbackBackend()).toBe(false);
    primary = makePrimary({ url: 'not a url' });
    expect(isLoopbackBackend()).toBe(false);
  });
});
