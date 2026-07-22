/**
 * Desktop-app companion row state derivation — the loopback record
 * (when one exists) answers alone from its live sync slot; only a
 * record-less registry consults the NM presence probe.
 */

import '@openheaders/ui/workbench/settings/schema';
import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import { deriveDesktopCompanionState } from '@openheaders/ui/shared/status';
import { describe, expect, it } from 'vitest';

function backend(overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id: 'b1',
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: 'oh_token',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-22T00:00:00.000Z',
    lastConnectedAt: null,
    ...overrides,
  };
}

function slot(state: BackendSyncStatus['state']): BackendSyncStatus {
  return { state, message: 'm' };
}

describe('deriveDesktopCompanionState', () => {
  it('a green sync slot on the loopback record reads connected', () => {
    expect(deriveDesktopCompanionState([backend()], { b1: slot('green') }, null)).toBe('connected');
  });

  it('an enabled record with no slot yet reads connecting', () => {
    expect(deriveDesktopCompanionState([backend()], {}, null)).toBe('connecting');
  });

  it('a red slot reads not-connected', () => {
    expect(deriveDesktopCompanionState([backend()], { b1: slot('red') }, null)).toBe('not-connected');
  });

  it('a disabled loopback record reads off — presence is never consulted', () => {
    expect(deriveDesktopCompanionState([backend({ enabled: false })], {}, false)).toBe('off');
  });

  it('a LAN-only registry falls through to the presence probe', () => {
    const lan = backend({ id: 'b2', url: 'ws://192.168.1.20:8137' });
    expect(deriveDesktopCompanionState([lan], {}, true)).toBe('installed-not-connected');
    expect(deriveDesktopCompanionState([lan], {}, false)).toBe('not-installed');
  });

  it('an unresolved probe with no record reads unknown', () => {
    expect(deriveDesktopCompanionState([], {}, null)).toBe('unknown');
  });
});
