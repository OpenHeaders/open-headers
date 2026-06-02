/**
 * Replay-harness seed — synthesizes a realistic heavy-capture stream of
 * `RequestLifecycleUpdate`s for the Phase-2 profiling gate.
 *
 * Shaped after the `network-oh.json` HAR dump: a mix of resource types, a
 * document `main_frame` per navigation wave, scripts that initiate their
 * own subresources (so the initiator index has real edges), and a final
 * HAR entry + completion per request (so the projection's size/status
 * totals do real work). Each request expands to three updates —
 * `started` → `har-attached` → `phase:completed` — interleaved across the
 * capture the way a live tab streams them, not grouped per request.
 *
 * Deterministic: no clock, no RNG. Values derive from the request index,
 * so a given `requestCount` always yields the same stream — repeatable
 * baselines across runs.
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

const RESOURCE_TYPES = ['script', 'stylesheet', 'image', 'xmlhttprequest', 'font', 'fetch'] as const;

/** One request begins; it completes `completionLagUpdates` events later. */
const COMPLETION_LAG = 7;

/** Every Nth request is a top-level navigation (new wave of subresources). */
const NAV_INTERVAL = 60;

export interface SynthesizeCaptureOptions {
  /** Wall-clock ms between consecutive request starts. */
  readonly startSpacingMs?: number;
  /** Wall-clock ms each request spends in flight before completing. */
  readonly durationMs?: number;
}

function harEntry(url: string, index: number, startedAtMs: number, durationMs: number): InspectorHarEntry {
  const status = index % 17 === 0 ? 404 : 200;
  const initiatorUrl = `https://openheaders.io/app-${index % NAV_INTERVAL === 0 ? 'doc' : 'bundle'}.js`;
  return {
    startedDateTime: new Date(startedAtMs).toISOString(),
    time: durationMs,
    request: {
      method: 'GET',
      url,
      httpVersion: 'http/2.0',
      headers: [
        { name: ':authority', value: 'openheaders.io' },
        { name: 'accept-encoding', value: 'gzip, deflate, br' },
      ],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      httpVersion: 'http/2.0',
      headers: [{ name: 'content-type', value: 'text/plain' }],
      cookies: [],
      content: { size: 256 + (index % 32) * 64, mimeType: 'text/plain' },
      headersSize: -1,
      bodySize: 128 + (index % 16) * 32,
    },
    timings: { blocked: 1, dns: 2, connect: 3, send: 1, wait: durationMs, receive: 2 },
    _initiator: { type: 'script', url: initiatorUrl },
  } as InspectorHarEntry;
}

function startedLifecycle(index: number, startedAtMs: number): RequestLifecycle {
  const isNav = index % NAV_INTERVAL === 0;
  const url = isNav
    ? `https://openheaders.io/page-${index / NAV_INTERVAL}`
    : `https://openheaders.io/asset-${index}.${RESOURCE_TYPES[index % RESOURCE_TYPES.length]}`;
  return {
    tabId: 1,
    requestId: `r${index}`,
    url,
    method: 'GET',
    resourceType: isNav ? 'main_frame' : RESOURCE_TYPES[index % RESOURCE_TYPES.length],
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    har: [],
    harBodyByHop: [],
  };
}

/**
 * Build the interleaved update stream for `requestCount` requests. The
 * returned array is the exact sequence a panel would receive over the
 * wire during a heavy capture.
 */
export function synthesizeCapture(
  requestCount: number,
  options: SynthesizeCaptureOptions = {},
): RequestLifecycleUpdate[] {
  const startSpacingMs = options.startSpacingMs ?? 5;
  const durationMs = options.durationMs ?? 40;
  const updates: RequestLifecycleUpdate[] = [];
  // Pending completions keyed by the update-index at which they fire.
  const dueAt = new Map<number, number[]>();

  const flushDue = (atIndex: number): void => {
    const ready = dueAt.get(atIndex);
    if (!ready) return;
    dueAt.delete(atIndex);
    for (const reqIndex of ready) {
      const startedAtMs = reqIndex * startSpacingMs;
      updates.push({
        kind: 'har-attached',
        tabId: 1,
        requestId: `r${reqIndex}`,
        hopIndex: 0,
        har: harEntry(startedLifecycle(reqIndex, startedAtMs).url, reqIndex, startedAtMs, durationMs),
      });
      updates.push({
        kind: 'phase',
        tabId: 1,
        requestId: `r${reqIndex}`,
        patch: {
          phase: 'completed',
          statusCode: reqIndex % 17 === 0 ? 404 : 200,
          completedAtMs: startedAtMs + durationMs,
        },
      });
    }
  };

  for (let i = 0; i < requestCount; i++) {
    flushDue(updates.length);
    updates.push({ kind: 'started', lifecycle: startedLifecycle(i, i * startSpacingMs) });
    const completeAt = updates.length + COMPLETION_LAG;
    const bucket = dueAt.get(completeAt);
    if (bucket) bucket.push(i);
    else dueAt.set(completeAt, [i]);
  }
  // Drain any completions still pending after the last start.
  const remaining = [...dueAt.keys()].sort((a, b) => a - b);
  for (const key of remaining) flushDue(key);

  return updates;
}
