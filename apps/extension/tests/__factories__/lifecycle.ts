/**
 * Shared test factories for `RequestLifecycle` + `InspectorRowWithFires`.
 *
 * One canonical builder per shape so the ~20 panel-consumer tests don't
 * each invent slightly different inline factories. Each builder takes a
 * `Partial<T>` override so individual tests stay readable while sharing
 * the boilerplate.
 *
 * Layering:
 *   - `makeHar(url, over)`        — minimal valid `InspectorHarEntry`.
 *   - `makeLifecycle(over)`       — full lifecycle with `har` hop 0 populated
 *                                   from `makeHar(url)`; pass `har: ...`
 *                                   override for custom hop maps.
 *   - `makeRow(over)`             — `InspectorRowWithFires` over a lifecycle.
 *   - `makeFire(ruleUid, over)`   — `InspectorFire` defaults.
 *   - `makePage(over)`            — `Page` (page-stream primitive) defaults.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export interface HarOverrides {
  startedDateTime?: string;
  method?: string;
  status?: number;
  statusText?: string;
  responseHeaders?: ReadonlyArray<{ name: string; value: string }>;
  requestHeaders?: ReadonlyArray<{ name: string; value: string }>;
  mimeType?: string;
  contentSize?: number;
  bodySize?: number;
  time?: number;
  httpVersion?: string;
  serverIPAddress?: string;
  initiator?: { type?: string; url?: string };
  postDataText?: string;
  postDataMime?: string;
  timings?: NonNullable<InspectorHarEntry['timings']>;
}

export function makeHar(url: string, over: HarOverrides = {}): InspectorHarEntry {
  const har: InspectorHarEntry = {
    startedDateTime: over.startedDateTime ?? new Date(0).toISOString(),
    time: over.time ?? 0,
    request: {
      method: over.method ?? 'GET',
      url,
      httpVersion: over.httpVersion ?? 'HTTP/1.1',
      headers: [...(over.requestHeaders ?? [])],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...(over.postDataText
        ? { postData: { mimeType: over.postDataMime ?? 'text/plain', text: over.postDataText } }
        : {}),
    },
    response: {
      status: over.status ?? 200,
      statusText: over.statusText ?? 'OK',
      httpVersion: over.httpVersion ?? 'HTTP/1.1',
      headers: [...(over.responseHeaders ?? [])],
      cookies: [],
      content: { size: over.contentSize ?? 0, mimeType: over.mimeType ?? 'text/plain' },
      headersSize: -1,
      bodySize: over.bodySize ?? -1,
      redirectURL: '',
    },
    cache: {},
    timings: over.timings ?? { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    ...(over.serverIPAddress ? { serverIPAddress: over.serverIPAddress } : {}),
    ...(over.initiator ? { _initiator: over.initiator } : {}),
  } as InspectorHarEntry;
  return har;
}

export interface LifecycleOverrides {
  tabId?: number;
  requestId?: string;
  url?: string;
  method?: string;
  resourceType?: string;
  /** Navigation loader id — the page-binding key for supersession. */
  loaderId?: string;
  phase?: RequestLifecycle['phase'];
  startedAtMs?: number;
  hopStartedAtMs?: number;
  /** Current hop's network start (post-queue) — the host's `startTime`. */
  hopNetworkStartMs?: number;
  completedAtMs?: number;
  /** In-flight progress mirrors (browser `endTime` / `resourceSize` / `transferSize`). */
  lastActivityAtMs?: number;
  bytesReceivedSoFar?: number;
  bytesTransferredSoFar?: number;
  statusCode?: number;
  statusText?: string;
  fromCache?: boolean;
  error?: { code: string; reason: string };
  initiator?: string;
  redirectHopCount?: number;
  redirectHops?: RequestLifecycle['redirectHops'];
  har?: readonly (InspectorHarEntry | null)[];
  harBodyByHop?: readonly (InspectorHarBody | null)[];
  /** Message-stream plane (WS frames / SSE events). */
  messages?: RequestLifecycle['messages'];
  messagesDropped?: number;
  /** Wrapper-capture plane (per-frame ws rule captures). */
  messageCaptures?: RequestLifecycle['messageCaptures'];
  messageCapturesDropped?: number;
  /**
   * Convenience for tests that only need to tweak a few fields on hop 0
   * without rebuilding the whole `har` array. Ignored when `har` is also
   * supplied.
   */
  harOverrides?: HarOverrides;
}

export function makeLifecycle(over: LifecycleOverrides = {}): RequestLifecycle {
  const url = over.url ?? 'https://openheaders.io/';
  const requestId = over.requestId ?? nextId('req');
  const startedAtMs = over.startedAtMs ?? 1000;
  const phase = over.phase ?? (over.completedAtMs != null ? 'completed' : over.error ? 'failed' : 'pending');
  // Default the HAR start to the lifecycle start so the two agree, as a real
  // capture does — the waterfall reads the HAR `startedDateTime` as its anchor.
  const har = over.har ?? [
    makeHar(url, { method: over.method, startedDateTime: new Date(startedAtMs).toISOString(), ...over.harOverrides }),
  ];
  return {
    tabId: over.tabId ?? 1,
    requestId,
    url,
    method: over.method ?? 'GET',
    resourceType: over.resourceType ?? 'xmlhttprequest',
    ...(over.initiator ? { initiator: over.initiator } : {}),
    ...(over.loaderId ? { loaderId: over.loaderId } : {}),
    phase,
    redirectHopCount: over.redirectHopCount ?? 0,
    redirectHops: over.redirectHops ?? [],
    startedAtMs,
    hopStartedAtMs: over.hopStartedAtMs ?? startedAtMs,
    ...(over.hopNetworkStartMs != null ? { hopNetworkStartMs: over.hopNetworkStartMs } : {}),
    ...(over.completedAtMs != null ? { completedAtMs: over.completedAtMs } : {}),
    ...(over.lastActivityAtMs != null ? { lastActivityAtMs: over.lastActivityAtMs } : {}),
    ...(over.bytesReceivedSoFar != null ? { bytesReceivedSoFar: over.bytesReceivedSoFar } : {}),
    ...(over.bytesTransferredSoFar != null ? { bytesTransferredSoFar: over.bytesTransferredSoFar } : {}),
    ...(over.statusCode != null ? { statusCode: over.statusCode } : {}),
    ...(over.statusText != null ? { statusText: over.statusText } : {}),
    ...(over.fromCache != null ? { fromCache: over.fromCache } : {}),
    ...(over.error ? { error: over.error } : {}),
    ...(over.messages ? { messages: over.messages } : {}),
    ...(over.messagesDropped != null ? { messagesDropped: over.messagesDropped } : {}),
    ...(over.messageCaptures ? { messageCaptures: over.messageCaptures } : {}),
    ...(over.messageCapturesDropped != null ? { messageCapturesDropped: over.messageCapturesDropped } : {}),
    har,
    harBodyByHop: over.harBodyByHop ?? [],
  };
}

export interface RowOverrides extends LifecycleOverrides {
  displayId?: number;
  consolidatedRetryOf?: readonly string[];
  fires?: readonly InspectorFire[];
}

export function makeRow(over: RowOverrides = {}): InspectorRowWithFires {
  const { displayId, consolidatedRetryOf, fires, ...lifecycleOver } = over;
  const lifecycle = makeLifecycle(lifecycleOver);
  const baseRow: InspectorRow = {
    lifecycle,
    displayId: displayId ?? 1,
    consolidatedRetryOf: consolidatedRetryOf ?? [],
  };
  return { ...baseRow, fires: fires ?? [] };
}

export interface FireOverrides {
  t?: number;
  pattern?: string;
  authoritative?: boolean;
  requestId?: string;
  evidence?: InspectorFire['evidence'];
}

export function makeFire(ruleUid: string, over: FireOverrides = {}): InspectorFire {
  return {
    ruleUid,
    t: over.t ?? 1000,
    pattern: over.pattern ?? '*',
    authoritative: over.authoritative ?? true,
    evidence: over.evidence ?? 'confirmed',
    ...(over.requestId ? { requestId: over.requestId } : {}),
  };
}

export interface PageOverrides {
  id?: string;
  url?: string | null;
  startedAtMs?: number;
  dclMs?: number;
  loadMs?: number;
}

export function makePage(over: PageOverrides = {}): Page {
  return {
    id: over.id ?? nextId('page'),
    url: over.url === undefined ? 'https://openheaders.io/' : over.url,
    startedAtMs: over.startedAtMs ?? 0,
    ...(over.dclMs != null ? { dclMs: over.dclMs } : {}),
    ...(over.loadMs != null ? { loadMs: over.loadMs } : {}),
  };
}
