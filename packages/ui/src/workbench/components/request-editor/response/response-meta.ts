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

export type ResponsePhaseKey = 'redirect' | 'stalled' | 'dns' | 'connect' | 'tls' | 'waiting' | 'download';

export interface ResponsePhase {
  key: ResponsePhaseKey;
  label: string;
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
      label: 'Redirects',
      startMs: rel(entry.redirectStart),
      durationMs: clamp(entry.redirectEnd - entry.redirectStart),
    });
  }
  const stalledEnd = entry.domainLookupStart > 0 ? entry.domainLookupStart : entry.requestStart;
  phases.push({
    key: 'stalled',
    label: 'Stalled',
    startMs: rel(entry.fetchStart),
    durationMs: clamp(stalledEnd - entry.fetchStart),
  });
  if (entry.domainLookupStart > 0) {
    phases.push({
      key: 'dns',
      label: 'DNS lookup',
      startMs: rel(entry.domainLookupStart),
      durationMs: clamp(entry.domainLookupEnd - entry.domainLookupStart),
    });
  }
  if (entry.connectStart > 0) {
    const tcpEnd = entry.secureConnectionStart > 0 ? entry.secureConnectionStart : entry.connectEnd;
    phases.push({
      key: 'connect',
      label: 'TCP connect',
      startMs: rel(entry.connectStart),
      durationMs: clamp(tcpEnd - entry.connectStart),
    });
    if (entry.secureConnectionStart > 0) {
      phases.push({
        key: 'tls',
        label: 'TLS handshake',
        startMs: rel(entry.secureConnectionStart),
        durationMs: clamp(entry.connectEnd - entry.secureConnectionStart),
      });
    }
  }
  phases.push({
    key: 'waiting',
    label: 'Waiting (TTFB)',
    startMs: rel(entry.requestStart),
    durationMs: clamp(entry.responseStart - entry.requestStart),
  });
  if (entry.responseEnd > 0) {
    phases.push({
      key: 'download',
      label: 'Content download',
      startMs: rel(entry.responseStart),
      durationMs: clamp(entry.responseEnd - entry.responseStart),
    });
  }
  return { kind: 'detailed', totalMs, phases };
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
