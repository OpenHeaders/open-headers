/**
 * Fetch-side telemetry for the executor: correlates a fetch with the
 * `PerformanceResourceTiming` entry the worker's own timeline records
 * for it, and computes the request bytes the executor serialized.
 *
 * Correlation model: an observer is opened immediately before the
 * fetch (window-scoped, not `buffered`, so the ring-buffer cap and
 * unrelated earlier fetches never matter) and settled after the body
 * read completes. A redirect-followed fetch records ONE entry named by
 * the SUBMITTED URL, with the redirect legs covering the chain; the
 * final-URL match is a defensive fallback for engines that name by
 * final URL. Within the window, the last matching entry wins (a
 * concurrent same-URL fetch from another subsystem would have started
 * earlier or finished later than ours). Everything degrades to
 * `undefined` — no timing is ever fabricated.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).byteLength;

/** Entries that started marginally before our `performance.now()` mark
 *  (clock granularity) still belong to this fetch. */
const ENTRY_START_EPSILON_MS = 1;

/** Resource-timing fields newer than the bundled TS lib's declaration —
 *  present at runtime in current Chromium, absent from `lib.dom` 5.9. */
interface ModernResourceTiming extends PerformanceResourceTiming {
  readonly deliveryType?: string;
  readonly firstInterimResponseStart?: number;
  readonly finalResponseHeadersStart?: number;
}

/** Faithful JSON-safe projection of one `PerformanceResourceTiming` —
 *  same shape the devtools sampler ships. */
export function toResourceTimingEntry(entry: PerformanceResourceTiming): ResourceTimingEntry {
  const raw = entry as ModernResourceTiming;
  return {
    name: raw.name,
    initiatorType: raw.initiatorType ?? '',
    nextHopProtocol: raw.nextHopProtocol ?? '',
    startTime: raw.startTime ?? 0,
    duration: raw.duration ?? 0,
    workerStart: raw.workerStart ?? 0,
    redirectStart: raw.redirectStart ?? 0,
    redirectEnd: raw.redirectEnd ?? 0,
    fetchStart: raw.fetchStart ?? 0,
    domainLookupStart: raw.domainLookupStart ?? 0,
    domainLookupEnd: raw.domainLookupEnd ?? 0,
    connectStart: raw.connectStart ?? 0,
    connectEnd: raw.connectEnd ?? 0,
    secureConnectionStart: raw.secureConnectionStart ?? 0,
    requestStart: raw.requestStart ?? 0,
    responseStart: raw.responseStart ?? 0,
    firstInterimResponseStart: raw.firstInterimResponseStart ?? 0,
    finalResponseHeadersStart: raw.finalResponseHeadersStart ?? 0,
    responseEnd: raw.responseEnd ?? 0,
    transferSize: raw.transferSize ?? 0,
    encodedBodySize: raw.encodedBodySize ?? 0,
    decodedBodySize: raw.decodedBodySize ?? 0,
    deliveryType: raw.deliveryType ?? '',
    responseStatus: typeof raw.responseStatus === 'number' ? raw.responseStatus : 0,
  };
}

export interface EntryMatch {
  /** The URL handed to `fetch()` — redirect chains record under it. */
  submittedUrl: string;
  /** `response.url` after redirects — fallback match. */
  finalUrl: string;
  /** `performance.now()` mark taken just before the fetch. */
  startedAt: number;
}

/** Pick the entry belonging to this fetch out of the observed window:
 *  started at/after our mark, named by the submitted (or final) URL,
 *  last match wins. */
export function pickResourceEntry(
  entries: readonly ResourceTimingEntry[],
  match: EntryMatch,
): ResourceTimingEntry | undefined {
  let found: ResourceTimingEntry | undefined;
  for (const entry of entries) {
    if (entry.startTime < match.startedAt - ENTRY_START_EPSILON_MS) continue;
    if (entry.name === match.submittedUrl || entry.name === match.finalUrl) found = entry;
  }
  return found;
}

export interface TimingCapture {
  /** Resolve the entry for this fetch. Disconnects the observer. */
  settle(match: Omit<EntryMatch, 'startedAt'>): Promise<ResourceTimingEntry | undefined>;
  /** Abandon the capture (error path). */
  cancel(): void;
}

export function startTimingCapture(startedAt: number): TimingCapture {
  const collected: ResourceTimingEntry[] = [];
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') collected.push(toResourceTimingEntry(entry as PerformanceResourceTiming));
      }
    });
    observer.observe({ type: 'resource' });
  } catch {
    // PerformanceObserver missing or 'resource' unsupported in this
    // context — the snapshot simply carries no timing.
    observer = null;
  }

  const drain = (): void => {
    if (!observer) return;
    for (const entry of observer.takeRecords()) {
      if (entry.entryType === 'resource') collected.push(toResourceTimingEntry(entry as PerformanceResourceTiming));
    }
  };
  const cancel = (): void => {
    observer?.disconnect();
    observer = null;
  };

  return {
    async settle(match) {
      if (!observer) return undefined;
      // The entry queues when the body finishes downloading — which our
      // completed body read implies — but delivery to the observer
      // callback is a separate task. Drain synchronously first; if the
      // entry hasn't queued yet, yield one macrotask and look again.
      drain();
      let entry = pickResourceEntry(collected, { ...match, startedAt });
      if (!entry) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        drain();
        entry = pickResourceEntry(collected, { ...match, startedAt });
      }
      cancel();
      return entry;
    },
    cancel,
  };
}

/** Serialized `key: value\r\n` bytes of the headers the executor set.
 *  The browser adds its own (Host, User-Agent, Accept-*, …) on top,
 *  and HTTP/2+ compresses header frames — this is a lower bound. */
export function serializedHeaderBytes(headers: Headers): number {
  let total = 0;
  headers.forEach((value, key) => {
    total += utf8Bytes(`${key}: ${value}\r\n`);
  });
  return total;
}

/** Chrome's generated boundary is `----WebKitFormBoundary` + 16 random
 *  chars = 38; other engines differ slightly, hence "approximate". */
const MULTIPART_BOUNDARY_LENGTH = 38;

export interface MultipartFieldSize {
  name: string;
  /** Present for file fields only. */
  filename?: string;
  /** Present for file fields only — text fields carry no part Content-Type. */
  mimeType?: string;
  payloadBytes: number;
}

/**
 * Multipart wire size from the fields actually appended, framed the way
 * browsers emit it:
 *
 *   --<boundary>\r\n
 *   Content-Disposition: form-data; name="<name>"[; filename="<f>"]\r\n
 *   [Content-Type: <mime>\r\n]
 *   \r\n
 *   <payload>\r\n
 *   …
 *   --<boundary>--\r\n
 *
 * The boundary length is engine-generated at fetch time, so the result
 * is an estimate (flagged `bodyApproximate` on the snapshot).
 */
export function estimateMultipartBytes(fields: readonly MultipartFieldSize[]): number {
  let total = 0;
  for (const field of fields) {
    total += 2 + MULTIPART_BOUNDARY_LENGTH + 2;
    total += utf8Bytes(`Content-Disposition: form-data; name="${field.name}"`);
    if (field.filename !== undefined) total += utf8Bytes(`; filename="${field.filename}"`);
    total += 2;
    if (field.mimeType !== undefined) total += utf8Bytes(`Content-Type: ${field.mimeType}`) + 2;
    total += 2 + field.payloadBytes + 2;
  }
  total += 2 + MULTIPART_BOUNDARY_LENGTH + 4;
  return total;
}

export function stringBodyBytes(body: string): number {
  return utf8Bytes(body);
}
