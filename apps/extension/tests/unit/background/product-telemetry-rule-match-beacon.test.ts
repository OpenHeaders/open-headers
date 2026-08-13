/**
 * rule_matched beacon (plan §3, S16) — the activation funnel's fired
 * side, off the tab-telemetry fire pipeline.
 *
 * Pins:
 *   - one event per rule type per UTC day, however many fires land;
 *   - the uid→type mapping reads the oracle rule store, and a fire for
 *     an unknown uid (deleted rule, cold store) reports nothing;
 *   - the in-memory day guard re-arms on UTC rollover, mirroring the
 *     controller's daily latch re-arm.
 */

import type { RequestRecord } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FireListener = (tabId: number, record: RequestRecord) => void;

const { mockSubscribeFiresAll, mockGetRules, mockTrack } = vi.hoisted(() => ({
  mockSubscribeFiresAll: vi.fn((_listener: FireListener) => () => {}),
  mockGetRules: vi.fn(() => [] as unknown[]),
  mockTrack: vi.fn(),
}));

vi.mock('@/background/modules/tab-telemetry', () => ({
  subscribeFiresAll: mockSubscribeFiresAll,
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getRules: mockGetRules,
}));

vi.mock('@/background/modules/product-telemetry', () => ({
  trackProductTelemetryEvent: mockTrack,
}));

// The sync-beacon half of the module pulls oracle sync seams — inert here.
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  subscribeOnWebSocketOpen: vi.fn(),
}));
vi.mock('@openheaders/oracle/sync/client/mutation-forwarder', () => ({
  setOutboundSyncFailureObserver: vi.fn(),
}));
// The storage-beacon half pulls the host storage adapter — inert here.
vi.mock('@/host/extension-storage', () => ({
  setStorageQuotaObserver: vi.fn(),
}));

import { installProductTelemetryRuleMatchBeacon } from '@/background/bootstrap/product-telemetry-beacons';

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = 1_760_000_000_000;

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    ruleUid: 'rule-header-1',
    url: 'https://openheaders.io/api',
    pattern: '*://openheaders.io/*',
    resourceType: 'xmlhttprequest',
    t: T0,
    evidence: 'matched',
    ...overrides,
  };
}

function installBeacon(): FireListener {
  installProductTelemetryRuleMatchBeacon();
  const listener = mockSubscribeFiresAll.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('beacon never subscribed');
  return listener;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  mockGetRules.mockReturnValue([
    { uid: 'rule-header-1', type: 'header' },
    { uid: 'rule-block-1', type: 'block' },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('installProductTelemetryRuleMatchBeacon', () => {
  it('reports the fired rule type once per day, however many fires land', () => {
    const onFire = installBeacon();
    onFire(7, rec());
    onFire(7, rec());
    onFire(9, rec({ ruleUid: 'rule-header-1', url: 'https://api.openheaders.io/other' }));
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith({ name: 'rule_matched', ruleType: 'header' });
  });

  it('reports each distinct rule type', () => {
    const onFire = installBeacon();
    onFire(7, rec());
    onFire(7, rec({ ruleUid: 'rule-block-1' }));
    expect(mockTrack.mock.calls.map(([event]) => event)).toEqual([
      { name: 'rule_matched', ruleType: 'header' },
      { name: 'rule_matched', ruleType: 'block' },
    ]);
  });

  it('reports nothing for a fire whose rule is gone from the store', () => {
    const onFire = installBeacon();
    onFire(7, rec({ ruleUid: 'rule-deleted' }));
    expect(mockTrack).not.toHaveBeenCalled();
    // A later fire for the same uid retries the lookup — nothing was cached.
    mockGetRules.mockReturnValue([{ uid: 'rule-deleted', type: 'delay' }]);
    onFire(7, rec({ ruleUid: 'rule-deleted' }));
    expect(mockTrack).toHaveBeenCalledWith({ name: 'rule_matched', ruleType: 'delay' });
  });

  it('re-arms on UTC-day rollover — a long-lived session reports each active day', () => {
    const onFire = installBeacon();
    onFire(7, rec());
    expect(mockTrack).toHaveBeenCalledTimes(1);
    vi.setSystemTime(T0 + DAY_MS);
    onFire(7, rec());
    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenLastCalledWith({ name: 'rule_matched', ruleType: 'header' });
  });
});
