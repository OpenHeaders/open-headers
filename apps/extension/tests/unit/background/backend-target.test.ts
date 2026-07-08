/**
 * `isOrgBackendOffDevice` — the per-Org reach classification driving the
 * outbound reach floor (a vault mutation may cross a loopback socket but
 * never a LAN/WAN one). Derived purely from the Org's backend binding +
 * that record's URL; both mirrors are mocked so each case sets its own.
 */

import type { BackendConnection } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

let bindings = new Map<string, string>();
let records = new Map<string, BackendConnection>();

vi.mock('@openheaders/core/backends', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/backends')>();
  return {
    ...actual,
    getBackend: vi.fn((id: string) => records.get(id) ?? null),
  };
});

vi.mock('@openheaders/core/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/identity')>();
  return {
    ...actual,
    getOrgBackendBindings: vi.fn(() => bindings),
  };
});

import { isOrgBackendOffDevice } from '../../../src/background/backend-target';

function makeRecord(id: string, url: string): BackendConnection {
  return {
    id,
    label: '',
    url,
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-01T00:00:00.000Z',
    lastConnectedAt: null,
  };
}

function bind(orgId: string, url: string): void {
  const backendId = `backend-${orgId}`;
  bindings = new Map([[orgId, backendId]]);
  records = new Map([[backendId, makeRecord(backendId, url)]]);
}

describe('isOrgBackendOffDevice', () => {
  it('treats an unbound Org (home Org — routes nowhere) as same-device', () => {
    bindings = new Map();
    records = new Map();
    expect(isOrgBackendOffDevice('org-home')).toBe(false);
  });

  it('treats a binding whose record is gone as same-device (no wire exists)', () => {
    bindings = new Map([['org-a', 'backend-gone']]);
    records = new Map();
    expect(isOrgBackendOffDevice('org-a')).toBe(false);
  });

  it('classifies loopback-bound Orgs as same-device', () => {
    for (const url of ['ws://127.0.0.1:59210', 'ws://localhost:59210', 'ws://[::1]:59210', 'ws://127.5.5.5:8137']) {
      bind('org-a', url);
      expect(isOrgBackendOffDevice('org-a'), url).toBe(false);
    }
  });

  it('classifies LAN / WAN-bound Orgs as off-device', () => {
    for (const url of ['ws://192.168.1.50:59210', 'ws://10.0.0.7:59210', 'wss://daemon.openheaders.io']) {
      bind('org-a', url);
      expect(isOrgBackendOffDevice('org-a'), url).toBe(true);
    }
  });

  it('treats an absent or malformed url as off-device (fail closed for the vault)', () => {
    bind('org-a', '');
    expect(isOrgBackendOffDevice('org-a')).toBe(true);
    bind('org-a', 'not a url');
    expect(isOrgBackendOffDevice('org-a')).toBe(true);
  });
});
