/**
 * invariant 8 — totally-ordered output per (tabId, requestId).
 *
 * Property test for the heuristic correlator wired into
 * `RequestLifecycleStore`. For any canonical webRequest sequence plus
 * a HAR entry inserted at any position within the late-arrival
 * window, the per-key *applied* update stream (what consumers see via
 * `store.subscribe`) must form a canonical sequence:
 *
 *   - First applied update is `started`.
 *   - Exactly one `started` per key (the reducer filters duplicate
 *     `started` updates the correlator emits on each post-redirect
 *     `onBeforeRequest`; this is the documented load-bearing
 *     filter — see `reducer.ts` `duplicate-started`).
 *   - `har-attached` (if present) appears after `started`.
 *   - All other applied updates appear after `started`.
 *
 * Body-attached events are exempt from the ordering invariant per the
 * carve-out documented in `core/request-lifecycle/types.ts`; they're
 * not part of the test matrix.
 *
 * Raw correlator emissions are NOT the canonical stream — the
 * correlator emits "intent" (a `started` per `onBeforeRequest`); the
 * store's reducer is the boundary that enforces invariants 1/3/5/6
 * and turns intent into the canonical applied stream. This test
 * asserts on the applied stream because that's what every downstream
 * consumer (popup, panel, rule-engine driver) reduces against.
 *
 * fast-check explores the small input space (scenario × HAR injection
 * position); on failure it shrinks to the minimal counterexample.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type {
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store';

const TAB = 41;
const REQUEST_ID = 'wr-inv8';
const URL_A = 'https://api.openheaders.io/a';
const URL_B = 'https://api.openheaders.io/b';
const STARTED_AT_MS = 1_700_000_000_000;
const STARTED_AT_ISO = new Date(STARTED_AT_MS).toISOString();

class InMemorySource<E> {
  private readonly listeners = new Set<(event: E) => void>();
  subscribe(listener: (event: E) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  emit(event: E): void {
    for (const fn of this.listeners) fn(event);
  }
}

interface Scenario {
  readonly webRequestEvents: readonly WebRequestEvent[];
  readonly harEntry: InspectorHarEntry;
}

function simpleScenario(): Scenario {
  return {
    webRequestEvents: [
      {
        method_kind: 'onBeforeRequest',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: STARTED_AT_MS,
      },
      {
        method_kind: 'onHeadersReceived',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: STARTED_AT_MS + 10,
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        responseHeaders: [],
      },
      {
        method_kind: 'onCompleted',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: STARTED_AT_MS + 20,
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        fromCache: false,
      },
    ],
    harEntry: {
      startedDateTime: STARTED_AT_ISO,
      request: { method: 'GET', url: URL_A, headers: [], queryString: [] },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [],
        content: { size: 0, mimeType: 'text/plain' },
      },
    },
  };
}

function redirectScenario(): Scenario {
  const HOP_START_MS = STARTED_AT_MS + 30;
  return {
    webRequestEvents: [
      {
        method_kind: 'onBeforeRequest',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: STARTED_AT_MS,
      },
      {
        method_kind: 'onBeforeRedirect',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: STARTED_AT_MS + 10,
        statusCode: 302,
        redirectUrl: URL_B,
        responseHeaders: [],
      },
      {
        method_kind: 'onBeforeRequest',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_B,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: HOP_START_MS,
      },
      {
        method_kind: 'onHeadersReceived',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_B,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: HOP_START_MS + 5,
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        responseHeaders: [],
      },
      {
        method_kind: 'onCompleted',
        tabId: TAB,
        requestId: REQUEST_ID,
        url: URL_B,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: HOP_START_MS + 15,
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        fromCache: false,
      },
    ],
    harEntry: {
      startedDateTime: STARTED_AT_ISO,
      request: { method: 'GET', url: URL_A, headers: [], queryString: [] },
      response: {
        status: 302,
        statusText: 'Found',
        headers: [],
        content: { size: 0, mimeType: 'text/plain' },
      },
    },
  };
}

interface RunResult {
  /** Stream actually applied by the store (insert / update / delete only). */
  readonly applied: readonly RequestLifecycleUpdate[];
  /** Reducer rejections. `duplicate-started` is documented + expected on redirect. */
  readonly rejections: readonly { update: RequestLifecycleUpdate; reason: string }[];
}

function runScenario(scenario: Scenario, harPosition: number): RunResult {
  const webRequest = new InMemorySource<WebRequestEvent>();
  const har = new InMemorySource<HarEvent>();
  const applied: RequestLifecycleUpdate[] = [];
  const rejections: { update: RequestLifecycleUpdate; reason: string }[] = [];

  const store = new RequestLifecycleStore({
    onReject: (update, reason) => rejections.push({ update, reason }),
  });
  store.subscribe((update) => applied.push(update));
  const correlator = new HeuristicCorrelator({ webRequest, har });
  correlator.subscribe((update) => store.apply(update));
  correlator.attachTab(TAB);

  const harEvent: HarEvent = { kind: 'har-entry', tabId: TAB, entry: scenario.harEntry };
  const sequence = [...scenario.webRequestEvents] as (WebRequestEvent | HarEvent)[];
  const clampedPosition = Math.min(Math.max(harPosition, 0), sequence.length);
  sequence.splice(clampedPosition, 0, harEvent);

  for (const event of sequence) {
    if ('method_kind' in event) webRequest.emit(event);
    else har.emit(event);
  }

  correlator.dispose();
  return { applied, rejections };
}

function perKeyUpdates(updates: readonly RequestLifecycleUpdate[]): RequestLifecycleUpdate[] {
  return updates.filter((u) => {
    if (u.kind === 'started') return u.lifecycle.tabId === TAB && u.lifecycle.requestId === REQUEST_ID;
    return u.tabId === TAB && u.requestId === REQUEST_ID;
  });
}

describe('invariant 8 — totally-ordered output per (tabId, requestId)', () => {
  it('per-key applied stream is canonical for any HAR injection position (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'simple' | 'redirect'>('simple', 'redirect'),
        fc.nat({ max: 6 }),
        (scenarioName, harPosition) => {
          const scenario = scenarioName === 'simple' ? simpleScenario() : redirectScenario();
          const { applied, rejections } = runScenario(scenario, harPosition);
          const perKey = perKeyUpdates(applied);

          // Only documented rejection allowed is `duplicate-started`
          // (the correlator emits one `started` per `onBeforeRequest`;
          // the reducer filters the post-redirect duplicate).
          for (const r of rejections) {
            expect(r.reason, 'unexpected rejection reason').toBe('duplicate-started');
          }

          expect(perKey.length, 'store must apply at least one update per key').toBeGreaterThan(0);

          const startedCount = perKey.filter((u) => u.kind === 'started').length;
          expect(startedCount, 'exactly one `started` applied per key').toBe(1);
          expect(perKey[0]?.kind, 'first applied update is `started`').toBe('started');

          for (let i = 1; i < perKey.length; i++) {
            expect(perKey[i]?.kind, `applied update at index ${i} must not be a second \`started\``).not.toBe('started');
          }
        },
      ),
      { numRuns: 64 },
    );
  });

  it('control: in-order simple scenario applies started → phase → phase → har-attached', () => {
    const { applied, rejections } = runScenario(simpleScenario(), 99);
    expect(rejections).toEqual([]);
    const kinds = perKeyUpdates(applied).map((u) => u.kind);
    expect(kinds[0]).toBe('started');
    expect(kinds).toContain('phase');
    expect(kinds).toContain('har-attached');
    expect(kinds.indexOf('har-attached')).toBeGreaterThan(kinds.indexOf('started'));
  });

  it('forward race: HAR-entry arriving before its `onBeforeRequest` is applied after `started`', () => {
    const { applied, rejections } = runScenario(simpleScenario(), 0);
    expect(rejections).toEqual([]);
    const perKey = perKeyUpdates(applied);
    const startedIndex = perKey.findIndex((u) => u.kind === 'started');
    const harIndex = perKey.findIndex((u) => u.kind === 'har-attached');
    expect(startedIndex, '`started` must be applied').toBeGreaterThanOrEqual(0);
    expect(harIndex, '`har-attached` must be applied even when HAR arrived first').toBeGreaterThanOrEqual(0);
    expect(harIndex).toBeGreaterThan(startedIndex);
  });
});
