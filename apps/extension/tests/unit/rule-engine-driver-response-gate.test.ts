/**
 * Rule Engine Driver — lifecycle subscription's response-gated judgment
 * wiring. The headers-received phase (with headers) judges parked
 * candidates; a failed phase drops them; tab-forgotten on the bus clears
 * the tab's park. The judgment itself is pinned in fire-recorder.test.ts —
 * this suite pins the seams that drive it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/background/rule-engine-driver/fire-recorder', () => ({
  recordFiresForObservation: vi.fn(),
  recordFiresForReport: vi.fn(),
  judgeResponseGatedCandidates: vi.fn(),
  dropResponseGatedCandidates: vi.fn(),
  dropResponseGatedTab: vi.fn(),
}));

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { clearAllTracking } from '@openheaders/oracle/tracking/tab-tracking-store';
import { startRuleEngineDriver } from '@/background/rule-engine-driver';
import {
  dropResponseGatedCandidates,
  dropResponseGatedTab,
  judgeResponseGatedCandidates,
} from '@/background/rule-engine-driver/fire-recorder';

const mockJudge = judgeResponseGatedCandidates as ReturnType<typeof vi.fn>;
const mockDrop = dropResponseGatedCandidates as ReturnType<typeof vi.fn>;
const mockDropTab = dropResponseGatedTab as ReturnType<typeof vi.fn>;

let store: RequestLifecycleStore;
let bus: TabLifecycleBus;
let dispose: () => void;

function startLifecycle(tabId: number, requestId: string): void {
  const lifecycle: RequestLifecycle = {
    tabId,
    requestId,
    url: 'https://api.openheaders.io/x',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100,
    hopStartedAtMs: 100,
    har: [],
    harBodyByHop: [],
  };
  store.apply({ kind: 'started', lifecycle });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAllTracking();
  store = new RequestLifecycleStore();
  bus = new TabLifecycleBus();
  const handle = startRuleEngineDriver({ store, updateBadge: () => {}, bus });
  dispose = handle.dispose;
});

afterEach(() => {
  dispose();
  clearAllTracking();
});

describe('rule-engine-driver — response-gated judgment seams', () => {
  it('judges parked candidates on a headers-received phase carrying response headers', () => {
    startLifecycle(1, 'req-1');
    const headers = [{ name: 'X-OH-Echo', value: 'true' }];

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'headers-received', statusCode: 200, responseHeaders: headers },
    });

    expect(mockJudge).toHaveBeenCalledWith(1, 'req-1', headers);
    expect(mockDrop).not.toHaveBeenCalled();
  });

  it('does not judge a headers-received phase without headers (nothing to judge against)', () => {
    startLifecycle(1, 'req-1');

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'headers-received', statusCode: 200 },
    });

    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('drops parked candidates on a failed phase — the gate was never judged', () => {
    startLifecycle(1, 'req-1');

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'failed', completedAtMs: 200, error: { code: 'net::ERR_FAILED', reason: 'failed' } },
    });

    expect(mockDrop).toHaveBeenCalledWith(1, 'req-1');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('clears the tab park on tab-forgotten', () => {
    bus.notifyTabForgotten(7);
    expect(mockDropTab).toHaveBeenCalledWith(7);
  });
});
