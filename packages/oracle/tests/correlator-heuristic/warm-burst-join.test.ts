/**
 * Warm-burst same-URL join integrity (end-to-end through the correlator).
 *
 * Overlapping same-URL requests fired in one task tick are timestamp-
 * indistinguishable at HAR arrival (whole-ms `startedDateTime`, sub-ms
 * record spacing) while their entries arrive in COMPLETION order —
 * probe-proven full pairing reversal. The fix: `onCompleted` /
 * `onErrorOccurred` stamp the wire-measured duration onto the FIFO
 * record, and `popMatching` ranks the timestamp tie set by duration
 * distance against the entry's own `time`.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';

/** In-memory webRequest source for tests. */
class TestWebRequestSource implements WebRequestEventSource {
  private readonly listeners = new Set<(event: WebRequestEvent) => void>();

  subscribe(listener: (event: WebRequestEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: WebRequestEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

/** In-memory HAR source for tests. */
class TestHarSource implements HarEventSource {
  private readonly listeners = new Set<(event: HarEvent) => void>();

  subscribe(listener: (event: HarEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: HarEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

const TAB = 7;
const URL = 'https://api.openheaders.io/burst';
const BURST_AT_MS = 1_700_000_000_000;

function beforeRequest(requestId: string, t: number): WebRequestEvent {
  return {
    method_kind: 'onBeforeRequest',
    tabId: TAB,
    requestId,
    url: URL,
    method: 'POST',
    timeStamp: t,
    type: 'xmlhttprequest',
  };
}

function completed(requestId: string, t: number): WebRequestEvent {
  return {
    method_kind: 'onCompleted',
    tabId: TAB,
    requestId,
    url: URL,
    method: 'POST',
    timeStamp: t,
    type: 'xmlhttprequest',
    statusCode: 200,
  };
}

/** A wire entry whose whole-ms start collapses onto the burst tick. */
function burstEntry(seq: string, timeMs: number): InspectorHarEntry {
  return {
    startedDateTime: new Date(BURST_AT_MS).toISOString(),
    time: timeMs,
    request: {
      method: 'POST',
      url: URL,
      headers: [{ name: 'X-OH-Seq', value: seq }],
      queryString: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 100, mimeType: 'application/json' },
      _transferSize: 100,
    },
  };
}

function setup() {
  const webRequest = new TestWebRequestSource();
  const har = new TestHarSource();
  const correlator = new HeuristicCorrelator({ webRequest, har });
  correlator.attachTab(TAB);
  const updates: RequestLifecycleUpdate[] = [];
  correlator.subscribe((u) => updates.push(u));
  return { webRequest, har, updates };
}

function attachedSeqByRequestId(updates: RequestLifecycleUpdate[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of updates) {
    if (u.kind !== 'har-attached') continue;
    const seq = u.har.request?.headers.find((h) => h.name === 'X-OH-Seq')?.value;
    if (seq) out.set(u.requestId, seq);
  }
  return out;
}

describe('HeuristicCorrelator — warm-burst same-URL join', () => {
  it('same-tick burst with reversed completion pairs every entry with its own request', () => {
    const { webRequest, har, updates } = setup();
    // Four POSTs to one URL in a single task tick; durations inverted.
    webRequest.emit(beforeRequest('101', BURST_AT_MS + 0.1));
    webRequest.emit(beforeRequest('102', BURST_AT_MS + 0.4));
    webRequest.emit(beforeRequest('103', BURST_AT_MS + 0.7));
    webRequest.emit(beforeRequest('104', BURST_AT_MS + 1.0));
    // Completion order is the reverse of fire order; each devtools entry
    // arrives right after its own terminal event.
    webRequest.emit(completed('104', BURST_AT_MS + 1.0 + 500));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: burstEntry('s4', 500) });
    webRequest.emit(completed('103', BURST_AT_MS + 0.7 + 1_000));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: burstEntry('s3', 1_000) });
    webRequest.emit(completed('102', BURST_AT_MS + 0.4 + 1_500));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: burstEntry('s2', 1_500) });
    webRequest.emit(completed('101', BURST_AT_MS + 0.1 + 2_000));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: burstEntry('s1', 2_000) });

    expect(attachedSeqByRequestId(updates)).toEqual(
      new Map([
        ['104', 's4'],
        ['103', 's3'],
        ['102', 's2'],
        ['101', 's1'],
      ]),
    );
  });

  it('an entry for a finished request never pairs with a still-in-flight tie candidate', () => {
    const { webRequest, har, updates } = setup();
    webRequest.emit(beforeRequest('201', BURST_AT_MS + 0.2));
    webRequest.emit(beforeRequest('202', BURST_AT_MS + 0.5));
    // Only the second request has finished; the first is still running
    // when the finished entry arrives.
    webRequest.emit(completed('202', BURST_AT_MS + 0.5 + 300));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: burstEntry('fast', 300) });

    expect(attachedSeqByRequestId(updates)).toEqual(new Map([['202', 'fast']]));
  });
});
