/**
 * S17 error beacons (plan §3) — the storage-quota observer mapping and
 * the CDP attach-failure edge detector.
 *
 * Pins:
 *   - the storage beacon maps the host adapter's quota signal onto the
 *     typed `storage-quota` code, nothing else;
 *   - the CDP beacon fires only on a NEW attach-failed fault — re-emits
 *     of unchanged state and fell-back faults stay silent.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CdpAttachFault, CdpAttachState } from '@/background/correlator-host/cdp-attach-controller';

const { mockSetStorageQuotaObserver, mockTrack } = vi.hoisted(() => ({
  mockSetStorageQuotaObserver: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('@/host/extension-storage', () => ({
  setStorageQuotaObserver: mockSetStorageQuotaObserver,
}));

vi.mock('@/background/modules/product-telemetry', () => ({
  trackProductTelemetryEvent: mockTrack,
}));

// The other beacon halves pull seams that stay inert here.
vi.mock('@/background/modules/tab-telemetry', () => ({
  subscribeFiresAll: vi.fn(),
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getRules: vi.fn(() => []),
}));
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  subscribeOnWebSocketOpen: vi.fn(),
}));
vi.mock('@openheaders/oracle/sync/client/mutation-forwarder', () => ({
  setOutboundSyncFailureObserver: vi.fn(),
}));

import {
  installProductTelemetryCdpBeacon,
  installProductTelemetryStorageBeacon,
} from '@/background/bootstrap/product-telemetry-beacons';

afterEach(() => {
  vi.clearAllMocks();
});

describe('installProductTelemetryStorageBeacon', () => {
  it('maps the adapter quota signal onto the typed storage-quota code', () => {
    installProductTelemetryStorageBeacon();
    const observer = mockSetStorageQuotaObserver.mock.calls.at(-1)?.[0] as () => void;
    expect(observer).toBeTypeOf('function');
    expect(mockTrack).not.toHaveBeenCalled();
    observer();
    expect(mockTrack).toHaveBeenCalledWith({ name: 'error_beacon', code: 'storage-quota' });
  });
});

function makeCdpObservable(initialFault: CdpAttachFault | null = null) {
  const listeners = new Set<(state: CdpAttachState) => void>();
  let state: CdpAttachState = { enabled: true, attachedTabs: [], pinnedTabs: [], lastFault: initialFault };
  return {
    observable: {
      getState: () => state,
      onChange(listener: (next: CdpAttachState) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      isPinned: () => false,
    },
    emit(next: Partial<CdpAttachState>): void {
      state = { ...state, ...next };
      for (const listener of listeners) listener(state);
    },
  };
}

describe('installProductTelemetryCdpBeacon', () => {
  it('beacons cdp-attach-failed on a new attach-failed fault', () => {
    const { observable, emit } = makeCdpObservable();
    installProductTelemetryCdpBeacon(observable);
    emit({ lastFault: { kind: 'attach-failed', tabId: 7 } });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith({ name: 'error_beacon', code: 'cdp-attach-failed' });
  });

  it('stays silent on re-emits of the same fault and on fell-back faults', () => {
    const fault: CdpAttachFault = { kind: 'attach-failed', tabId: 7 };
    const { observable, emit } = makeCdpObservable();
    installProductTelemetryCdpBeacon(observable);
    emit({ lastFault: fault });
    emit({ lastFault: fault, attachedTabs: [3] });
    emit({ lastFault: { kind: 'fell-back', tabId: 3 } });
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('beacons again for a fresh failure after a clean attach cleared the fault', () => {
    const { observable, emit } = makeCdpObservable();
    installProductTelemetryCdpBeacon(observable);
    emit({ lastFault: { kind: 'attach-failed', tabId: 7 } });
    emit({ lastFault: null, attachedTabs: [7] });
    emit({ lastFault: { kind: 'attach-failed', tabId: 9 } });
    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('does not re-report a fault that predates the install (SW rewire)', () => {
    const { observable, emit } = makeCdpObservable({ kind: 'attach-failed', tabId: 4 });
    installProductTelemetryCdpBeacon(observable);
    emit({ attachedTabs: [2] });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
