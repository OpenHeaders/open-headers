/**
 * Fires-bridge ownership routing — the chrome-side half of the
 * cross-id-space authoritative join.
 *
 * Pins:
 *   - heuristic-owned tabs keep the exact-key ingest, byte-identical;
 *   - CDP-owned tabs route through the hub's translated ingest with the
 *     host-NORMALIZED url as the match key (driver fires record
 *     normalized urls — a raw event url would never compare equal);
 *   - rule-snapshot enrichment rides both paths.
 */

import type { RequestRecord } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/background/modules/tab-telemetry', () => ({
  subscribeFiresAll: vi.fn(() => () => {}),
}));

import type { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { startTabTelemetryFiresBridge } from '@/background/modules/tab-telemetry-fires-bridge';

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    ruleUid: 'rule-a',
    url: 'https://openheaders.io/api#section',
    pattern: '*://openheaders.io/*',
    resourceType: 'xmlhttprequest',
    t: 1000,
    evidence: 'matched',
    requestId: '4471',
    ...overrides,
  };
}

function makeHub() {
  return {
    notifyHeuristicFire: vi.fn(),
    notifyAuthoritativeFire: vi.fn(),
    notifyAuthoritativeFireTranslated: vi.fn(),
  };
}

describe('startTabTelemetryFiresBridge — authoritative routing by tab ownership', () => {
  it('heuristic-owned tab: exact-key ingest, untranslated', () => {
    const hub = makeHub();
    const bridge = startTabTelemetryFiresBridge({
      hub: hub as unknown as RuleFireHub,
      isCdpOwned: () => false,
    });
    bridge.notifyAuthoritativeFire(7, rec());
    expect(hub.notifyAuthoritativeFire).toHaveBeenCalledTimes(1);
    expect(hub.notifyAuthoritativeFireTranslated).not.toHaveBeenCalled();
    const [tabId, record] = hub.notifyAuthoritativeFire.mock.calls[0];
    expect(tabId).toBe(7);
    expect(record.requestId).toBe('4471');
  });

  it('CDP-owned tab: translated ingest with the normalized url as match key', () => {
    const hub = makeHub();
    const bridge = startTabTelemetryFiresBridge({
      hub: hub as unknown as RuleFireHub,
      isCdpOwned: (tabId) => tabId === 7,
    });
    bridge.notifyAuthoritativeFire(7, rec());
    expect(hub.notifyAuthoritativeFireTranslated).toHaveBeenCalledTimes(1);
    expect(hub.notifyAuthoritativeFire).not.toHaveBeenCalled();
    const [tabId, record, matchUrl] = hub.notifyAuthoritativeFireTranslated.mock.calls[0];
    expect(tabId).toBe(7);
    expect(record.requestId).toBe('4471');
    // normalizeUrlForTracking strips the fragment — the driver records the
    // same normalized form, so the match key must too.
    expect(matchUrl).toBe('https://openheaders.io/api');
  });

  it('ownership is read per arrival, not captured at bridge start', () => {
    const hub = makeHub();
    let owner: 'heuristic' | 'cdp' = 'heuristic';
    const bridge = startTabTelemetryFiresBridge({
      hub: hub as unknown as RuleFireHub,
      isCdpOwned: () => owner === 'cdp',
    });
    bridge.notifyAuthoritativeFire(7, rec());
    owner = 'cdp';
    bridge.notifyAuthoritativeFire(7, rec());
    expect(hub.notifyAuthoritativeFire).toHaveBeenCalledTimes(1);
    expect(hub.notifyAuthoritativeFireTranslated).toHaveBeenCalledTimes(1);
  });
});
