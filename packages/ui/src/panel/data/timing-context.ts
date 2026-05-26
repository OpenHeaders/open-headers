/**
 * Network-context strip for the Timing tab.
 *
 * Assembles a compact set of fields the user would otherwise have to
 * piece together across the Headers / Timing / status-bar views:
 * protocol, connection reuse, cache source, priority, request offset
 * from navigation start, and the server IP.
 *
 * Pure helper — takes the lifecycle, a precomputed connection-reuse
 * result, and an optional baseline timestamp; returns plain data the
 * view renders into the strip.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { ConnectionReuseInfo } from './connection-reuse';
import { formatHttpVersion } from './http-version';
import { currentHarEntry } from './inspector-row-projection';
import { classifyRequestState, type RequestState } from './request-state';

export type CacheLabel = 'miss' | 'memory cache' | 'disk cache' | 'service worker';

export interface TimingContext {
  httpVersion: string | null;
  connectionReuse: ConnectionReuseInfo;
  cache: CacheLabel | null;
  priority: string | null;
  /** ms since the session baseline (typically the first observed entry). */
  startedAtMs: number | null;
  serverIp: string | null;
}

function cacheLabel(state: RequestState): CacheLabel | null {
  if (state.kind !== 'cached') return 'miss';
  switch (state.source) {
    case 'memory':
      return 'memory cache';
    case 'disk':
      return 'disk cache';
    case 'service-worker':
      return 'service worker';
  }
}

export function computeTimingContext(
  lifecycle: RequestLifecycle,
  connectionReuse: ConnectionReuseInfo,
  baselineMs: number | null,
): TimingContext {
  const state = classifyRequestState(lifecycle);
  const har = currentHarEntry(lifecycle);
  const httpRaw = har?.response?.httpVersion ?? null;
  const httpVersion = httpRaw ? formatHttpVersion(httpRaw) || null : null;
  const startedAtMs = baselineMs != null ? lifecycle.startedAtMs - baselineMs : null;
  return {
    httpVersion,
    connectionReuse,
    cache: cacheLabel(state),
    priority: har?._priority ?? null,
    startedAtMs: startedAtMs != null && startedAtMs >= 0 ? startedAtMs : null,
    serverIp: har?.serverIPAddress ?? null,
  };
}
