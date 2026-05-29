import { describe, expect, it } from 'vitest';
import {
  type CacheSummary,
  computeDeferredFireAt,
  computeNextFireAt,
  DEFAULT_PEER_DEFER_LEAD_MS,
  isWithinDeferHatchWindow,
  MAX_BACKOFF_SECONDS,
  MIN_ALARM_DELAY_MS,
} from '../../src/live/refresh-cadence';
import type { LiveWorkflow, RefreshPolicy } from '../../src/types/live';

const NOW = 1_700_000_000_000;

function makeWorkflow(refresh: RefreshPolicy, overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wflow001',
    path: 'live-workflows/demo-wflow001',
    name: 'Demo',
    enabled: true,
    refresh,
    steps: [
      {
        uid: 'stpfetch',
        id: 'fetch',
        requestUid: 'reqfetch1',
        captures: [
          { uid: 'capvalue', name: 'value', extractor: { kind: 'whole-body' } },
          { uid: 'capexpin', name: 'expires_in', extractor: { kind: 'json-path', path: '$.expires_in' } },
          { uid: 'capexpat', name: 'exp', extractor: { kind: 'json-path', path: '$.exp' } },
        ],
      },
    ],
    ...overrides,
  };
}

function makeCache(overrides: Partial<CacheSummary> = {}): CacheSummary {
  return {
    extractedAt: NOW - 10_000,
    stepCaptures: {},
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe('computeNextFireAt — manual', () => {
  it('returns null regardless of cache state', () => {
    const wf = makeWorkflow({ kind: 'manual' });
    expect(computeNextFireAt(wf, null, NOW)).toBeNull();
    expect(computeNextFireAt(wf, makeCache(), NOW)).toBeNull();
  });
});

describe('computeNextFireAt — interval', () => {
  it('fires at extractedAt + interval on healthy path', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    const cache = makeCache({ extractedAt: NOW - 10_000 });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(cache.extractedAt! + 300_000);
  });

  it('clamps to MIN_ALARM_DELAY when the computed target is in the past', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 60 });
    const cache = makeCache({ extractedAt: NOW - 10 * 60_000 }); // 10 minutes old
    const result = computeNextFireAt(wf, cache, NOW);
    expect(result).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('fires ASAP (min delay) when never refreshed', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    expect(computeNextFireAt(wf, null, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });
});

describe('computeNextFireAt — expires-in', () => {
  it('computes fire = extractedAt + expires_in - leadSeconds', () => {
    const wf = makeWorkflow({ kind: 'expires-in', stepId: 'fetch', captureName: 'expires_in', leadSeconds: 60 });
    const cache = makeCache({
      extractedAt: NOW,
      stepCaptures: { fetch: { expires_in: '600' } },
    });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + 600_000 - 60_000);
  });

  it('kicks a fast retry when the capture is missing', () => {
    const wf = makeWorkflow({ kind: 'expires-in', stepId: 'fetch', captureName: 'expires_in', leadSeconds: 60 });
    const cache = makeCache({ extractedAt: NOW - 1000, stepCaptures: {} });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('kicks a fast retry when the capture is non-numeric', () => {
    const wf = makeWorkflow({ kind: 'expires-in', stepId: 'fetch', captureName: 'expires_in', leadSeconds: 60 });
    const cache = makeCache({ extractedAt: NOW - 1000, stepCaptures: { fetch: { expires_in: 'abc' } } });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('fires ASAP when never refreshed', () => {
    const wf = makeWorkflow({ kind: 'expires-in', stepId: 'fetch', captureName: 'expires_in', leadSeconds: 60 });
    expect(computeNextFireAt(wf, null, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });
});

describe('computeNextFireAt — expires-at', () => {
  it('computes fire = absolute - leadSeconds', () => {
    const wf = makeWorkflow({ kind: 'expires-at', stepId: 'fetch', captureName: 'exp', leadSeconds: 30 });
    const absolute = NOW + 2 * 60_000;
    const cache = makeCache({
      extractedAt: NOW,
      stepCaptures: { fetch: { exp: String(absolute) } },
    });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(absolute - 30_000);
  });

  it('respects the min-delay floor when the computed target is past', () => {
    const wf = makeWorkflow({ kind: 'expires-at', stepId: 'fetch', captureName: 'exp', leadSeconds: 30 });
    const cache = makeCache({
      extractedAt: NOW - 60_000,
      stepCaptures: { fetch: { exp: String(NOW - 10_000) } },
    });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });
});

describe('computeNextFireAt — backoff', () => {
  it('applies 60·2^(n-1) on failure state (n=1)', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    const cache = makeCache({ consecutiveFailures: 1, lastErrorAt: NOW });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + 60_000);
  });

  it('doubles on each consecutive failure', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    // n=3 → 60 * 2^2 = 240s
    const cache = makeCache({ consecutiveFailures: 3, lastErrorAt: NOW });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + 240_000);
  });

  it('caps backoff at MAX_BACKOFF_SECONDS', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    // n=20 would explode; capped at 3600s
    const cache = makeCache({ consecutiveFailures: 20, lastErrorAt: NOW });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MAX_BACKOFF_SECONDS * 1000);
  });

  it('overrides manual policy with backoff once failures accumulate', () => {
    // Defensive: the scheduler shouldn't re-fire a manual workflow on its
    // own, but if the caller explicitly asks for the next-fire-at with a
    // failure in play, we serve the backoff tick rather than null.
    const wf = makeWorkflow({ kind: 'manual' });
    const cache = makeCache({ consecutiveFailures: 1, lastErrorAt: NOW });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + 60_000);
  });

  it('clamps backoff target to min-delay when lastErrorAt is old', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    const cache = makeCache({ consecutiveFailures: 1, lastErrorAt: NOW - 120_000 });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });
});

describe('computeNextFireAt — definitionally stale', () => {
  it('fires ASAP for a flagged row whose interval has not elapsed', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    // Healthy cadence would be extractedAt + 300s — far in the future.
    const cache = makeCache({ extractedAt: NOW - 10_000, definitionallyStale: true });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('fires ASAP for a flagged expires-at row not yet near expiry', () => {
    const wf = makeWorkflow({ kind: 'expires-at', stepId: 'fetch', captureName: 'exp', leadSeconds: 30 });
    const cache = makeCache({
      extractedAt: NOW - 10_000,
      stepCaptures: { fetch: { exp: String(NOW + 3_600_000) } },
      definitionallyStale: true,
    });
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('still returns null for a flagged manual workflow — the flag never auto-runs', () => {
    const wf = makeWorkflow({ kind: 'manual' });
    const cache = makeCache({ definitionallyStale: true });
    expect(computeNextFireAt(wf, cache, NOW)).toBeNull();
  });

  it('backoff takes precedence over the flag — a failing flagged row stays on its curve', () => {
    const wf = makeWorkflow({ kind: 'interval', seconds: 300 });
    const cache = makeCache({ consecutiveFailures: 1, lastErrorAt: NOW, definitionallyStale: true });
    // Without precedence the flag would hot-loop a failing workflow at
    // the alarm floor; the backoff tick (60s) must win.
    expect(computeNextFireAt(wf, cache, NOW)).toBe(NOW + 60_000);
  });
});

describe('cadence ownership — computeDeferredFireAt / isWithinDeferHatchWindow', () => {
  it('arms the safety fire at expiresAt − default peer lead when expiry is far', () => {
    const expiresAt = NOW + 3_600_000; // 1h out
    expect(computeDeferredFireAt(expiresAt, NOW)).toBe(expiresAt - DEFAULT_PEER_DEFER_LEAD_MS);
  });

  it('fires later than a typical lead-time cadence (peer waits closer to expiry)', () => {
    const expiresAt = NOW + 3_600_000;
    // A normal expires-in fire at the 60s default lead vs. the deferred
    // 30s lead — the deferred fire is strictly later, giving the backend
    // (which fires at its own larger lead) the first shot.
    const normalLeadFire = expiresAt - 60_000;
    expect(computeDeferredFireAt(expiresAt, NOW)).toBeGreaterThan(normalLeadFire);
  });

  it('clamps to the MV3 alarm floor when expiry is already near', () => {
    const expiresAt = NOW + 10_000; // 10s out — inside the 30s lead
    expect(computeDeferredFireAt(expiresAt, NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('honours an explicit lead override', () => {
    const expiresAt = NOW + 3_600_000;
    expect(computeDeferredFireAt(expiresAt, NOW, 90_000)).toBe(expiresAt - 90_000);
  });

  it('isWithinDeferHatchWindow is false before the threshold, true at/after it', () => {
    const expiresAt = NOW + 100_000;
    expect(isWithinDeferHatchWindow(expiresAt, NOW)).toBe(false);
    // At exactly expiresAt − lead the hatch opens.
    expect(isWithinDeferHatchWindow(expiresAt, expiresAt - DEFAULT_PEER_DEFER_LEAD_MS)).toBe(true);
    // And past it.
    expect(isWithinDeferHatchWindow(expiresAt, expiresAt - 5_000)).toBe(true);
  });
});
