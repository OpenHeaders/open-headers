/**
 * Pure mappers for the response meta strip's depth popovers: raw
 * resource-timing entry → phase ladder, negotiated protocol → friendly
 * HTTP version label, and byte helpers for the size split.
 *
 * Honest-degradation contract: connection legs are gated by
 * `Timing-Allow-Origin` and read `0` when the server withholds them —
 * and the executor fetches from an extension origin, so every request
 * is cross-origin and detail appears ONLY when the server opts in.
 * A withheld ladder maps to `total-only`; nothing is fabricated.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';

export type ResponsePhaseKey = 'redirect' | 'stalled' | 'dns' | 'connect' | 'tls' | 'waiting' | 'download';

export interface ResponsePhase {
  key: ResponsePhaseKey;
  labelKey: MessageKey;
  /** Offset from the entry's start, ms — positions the ladder bar. */
  startMs: number;
  durationMs: number;
}

export type ResponseTimingView =
  | { kind: 'detailed'; totalMs: number; phases: ResponsePhase[] }
  | { kind: 'total-only'; totalMs: number };

const clamp = (ms: number): number => (ms > 0 ? ms : 0);

/**
 * Map a raw entry to the popover's ladder. Detail requires the
 * TAO-gated legs (`requestStart` / `responseStart` read `0` when the
 * check failed — `0` means "hidden", never "instant"). On a reused
 * connection the dns/connect legs collapse onto `fetchStart` as
 * zero-width rows, which render as honest `0 ms` steps.
 */
export function mapEntryToTimingView(entry: ResourceTimingEntry): ResponseTimingView {
  const totalMs = entry.duration > 0 ? entry.duration : clamp(entry.responseEnd - entry.startTime);
  if (entry.requestStart <= 0 || entry.responseStart <= 0) {
    return { kind: 'total-only', totalMs };
  }
  const rel = (t: number): number => clamp(t - entry.startTime);
  const phases: ResponsePhase[] = [];
  if (entry.redirectStart > 0) {
    phases.push({
      key: 'redirect',
      labelKey: 'workbench.editors.request.response.meta.phase.redirect',
      startMs: rel(entry.redirectStart),
      durationMs: clamp(entry.redirectEnd - entry.redirectStart),
    });
  }
  const stalledEnd = entry.domainLookupStart > 0 ? entry.domainLookupStart : entry.requestStart;
  phases.push({
    key: 'stalled',
    labelKey: 'workbench.editors.request.response.meta.phase.stalled',
    startMs: rel(entry.fetchStart),
    durationMs: clamp(stalledEnd - entry.fetchStart),
  });
  if (entry.domainLookupStart > 0) {
    phases.push({
      key: 'dns',
      labelKey: 'workbench.editors.request.response.meta.phase.dns',
      startMs: rel(entry.domainLookupStart),
      durationMs: clamp(entry.domainLookupEnd - entry.domainLookupStart),
    });
  }
  if (entry.connectStart > 0) {
    const tcpEnd = entry.secureConnectionStart > 0 ? entry.secureConnectionStart : entry.connectEnd;
    phases.push({
      key: 'connect',
      labelKey: 'workbench.editors.request.response.meta.phase.connect',
      startMs: rel(entry.connectStart),
      durationMs: clamp(tcpEnd - entry.connectStart),
    });
    if (entry.secureConnectionStart > 0) {
      phases.push({
        key: 'tls',
        labelKey: 'workbench.editors.request.response.meta.phase.tls',
        startMs: rel(entry.secureConnectionStart),
        durationMs: clamp(entry.connectEnd - entry.secureConnectionStart),
      });
    }
  }
  phases.push({
    key: 'waiting',
    labelKey: 'workbench.editors.request.response.meta.phase.waiting',
    startMs: rel(entry.requestStart),
    durationMs: clamp(entry.responseStart - entry.requestStart),
  });
  if (entry.responseEnd > 0) {
    phases.push({
      key: 'download',
      labelKey: 'workbench.editors.request.response.meta.phase.download',
      startMs: rel(entry.responseStart),
      durationMs: clamp(entry.responseEnd - entry.responseStart),
    });
  }
  return { kind: 'detailed', totalMs, phases };
}

/**
 * Map the node runtime's manual phase marks (`snapshot.phaseTimings`)
 * onto the same ladder shape the resource-timing entry feeds — one
 * popover view for both runtimes. The marks are sequential by
 * construction (redirect hops → socket legs → final-hop wait →
 * download), so the ladder positions are running offsets; the total is
 * the marks' own span, which is the network time (the snapshot's
 * `durationMs` also counts materialization overhead). The DNS /
 * connect / TLS legs appear only when the send dialed an instrumented
 * connection; a send without them keeps its honesty note (they sit
 * inside Waiting there).
 */
export function mapPhaseTimingsToView(
  timings: NonNullable<ExecutedRequestSnapshot['phaseTimings']>,
): ResponseTimingView {
  const phases: ResponsePhase[] = [];
  let cursor = 0;
  const push = (key: ResponsePhaseKey, labelKey: MessageKey, durationMs: number | undefined) => {
    if (durationMs === undefined) return;
    phases.push({ key, labelKey, startMs: cursor, durationMs: clamp(durationMs) });
    cursor += clamp(durationMs);
  };
  push('redirect', 'workbench.editors.request.response.meta.phase.redirect', timings.redirectMs);
  push('dns', 'workbench.editors.request.response.meta.phase.dns', timings.dnsMs);
  push('connect', 'workbench.editors.request.response.meta.phase.connect', timings.connectMs);
  push('tls', 'workbench.editors.request.response.meta.phase.tls', timings.tlsMs);
  push('waiting', 'workbench.editors.request.response.meta.phase.waiting', timings.waitingMs);
  push('download', 'workbench.editors.request.response.meta.phase.download', timings.downloadMs);
  return { kind: 'detailed', totalMs: cursor, phases };
}

/** Whether the node marks carry the instrumented socket legs — drives
 *  the ladder's honesty note (absent legs sit inside Waiting). Any leg
 *  counts: a QUIC send has no TCP-connect leg at all (the whole
 *  handshake lands in the TLS seat), and a resolve-to-address pin
 *  resolves nothing — `connectMs` alone would misread both as
 *  uninstrumented. */
export function phaseTimingsHaveSocketLegs(timings: NonNullable<ExecutedRequestSnapshot['phaseTimings']>): boolean {
  return timings.dnsMs !== undefined || timings.connectMs !== undefined || timings.tlsMs !== undefined;
}

/** Friendly label for a negotiated ALPN protocol id; `null` when the
 *  platform withheld it (TAO-gated cross-origin). */
export function httpVersionLabel(nextHopProtocol: string): string | null {
  switch (nextHopProtocol) {
    case '':
      return null;
    case 'http/0.9':
      return 'HTTP/0.9';
    case 'http/1.0':
      return 'HTTP/1.0';
    case 'http/1.1':
      return 'HTTP/1.1';
    case 'h2':
    case 'h2c':
      return 'HTTP/2';
    case 'h3':
      return 'HTTP/3';
    default:
      return nextHopProtocol;
  }
}

/** Wall-clock duration rolled up to readable units — the meta strip's
 *  time fact for both phases (a streamed send can run for hours; raw
 *  ms stops reading past a minute). Popovers keep exact figures. */
export function formatDurationRolled(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 1000) return `${Math.round(clamped)} ms`;
  const totalSeconds = clamped / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - totalMinutes * 60;
  if (totalMinutes < 60) return `${totalMinutes} m ${seconds.toFixed(1)} s`;
  return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} m ${Math.round(seconds)} s`;
}

/** Phase-scale duration formatting — sub-ms values stay visible
 *  instead of collapsing to a fake 0. */
export function formatPhaseMs(ms: number): string {
  if (ms <= 0) return '0 ms';
  if (ms < 1) return '<1 ms';
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

/** Serialized `key: value\r\n` bytes of a header list — the size
 *  popover's "headers as visible" figure. HTTP/2+ compresses header
 *  frames on the wire, so this is the uncompressed representation. */
export function serializedHeaderListBytes(headers: ReadonlyArray<{ key: string; value: string }>): number {
  const encoder = new TextEncoder();
  let total = 0;
  for (const { key, value } of headers) {
    total += encoder.encode(`${key}: ${value}\r\n`).byteLength;
  }
  return total;
}
