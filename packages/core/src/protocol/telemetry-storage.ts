/**
 * Browser storage-plane relay wire types — the observability plane's
 * storage channels on the extension ↔ daemon WebSocket
 * (the observability plan Phase 3).
 *
 * The storage plane is pull-shaped: the shared Storage tool window reads
 * through paged RPCs and lazy document fetches, and writes are the same
 * RPC vocabulary (the desktop-as-remote-control actuator model — the
 * extension executes, PLAN §7). So the wire is an RPC RELAY of the
 * existing DevTools-bridge storage verbs, not a snapshot stream:
 *
 *   - host → extension: {@link TelemetryStorageCallMessage} carries ONE
 *     bridge call ({@link TelemetryStorageMethod} — the application-
 *     storage inspector + cookie-jar subset of `DevToolsRpc`), correlated
 *     by `callId`; the extension answers on the standard
 *     `<type>:response` reply channel with
 *     {@link TelemetryStorageCallResponseMessage}. Calls run
 *     concurrently — FIFO correlation (the inventory read's shape) is
 *     not enough here, hence the explicit id.
 *   - host → extension: {@link TelemetryStorageConsumerMessage} opens a
 *     storage watch for one `(tab, consumer)` —
 *     {@link TelemetryStorageDetachMessage} ends it (per-consumer
 *     streams are the telemetry plane's law). The watch's only stream is
 *     {@link TelemetryStorageInvalidationMessage}: the CDP tier's
 *     "went stale, refetch" note, carrying no data — the consumer
 *     refetches through the call verbs, exactly like the in-browser
 *     panel.
 *
 * Same privacy posture as the lifecycle channels: the extension honors
 * storage frames from SAME-DEVICE (loopback) wires only.
 */

import type { StorageInvalidationKind } from './channels/broadcast';
import type { DevToolsRpc } from './channels/devtools';

export const TELEMETRY_STORAGE_CALL_TYPE = 'oh.telemetry.storage.call' as const;
export const TELEMETRY_STORAGE_CONSUMER_TYPE = 'oh.telemetry.storage.consumer' as const;
export const TELEMETRY_STORAGE_DETACH_TYPE = 'oh.telemetry.storage.detach' as const;
export const TELEMETRY_STORAGE_INVALIDATION_TYPE = 'oh.telemetry.storage.invalidation' as const;

/**
 * The `DevToolsRpc` subset the storage relay carries: every application-
 * storage inspector verb plus the cookie-jar verbs the Storage tool
 * window's Cookies section rides. Console/eval and source-map verbs are
 * deliberately absent — arbitrary eval from the desktop is scriptable-
 * plane territory (PLAN §9), and this list is the enforcement point.
 */
export const TELEMETRY_STORAGE_METHODS = [
  'fetchCookieJarForUrl',
  'setCookieForUrl',
  'removeCookieForUrl',
  'fetchCookieJarForSite',
  'clearCookiesForSite',
  'listStorageScopes',
  'getDomStorageEntries',
  'getDomStorageValue',
  'setDomStorageItem',
  'renameDomStorageItem',
  'removeDomStorageItem',
  'clearDomStorage',
  'listIndexedDbDatabases',
  'getIndexedDbRecords',
  'getIndexedDbRecordDocument',
  'putIndexedDbRecord',
  'deleteIndexedDbRecord',
  'clearIndexedDbStore',
  'deleteIndexedDbDatabase',
  'listCacheStorageCaches',
  'getCacheStorageEntries',
  'getCacheStorageEntryDocument',
  'deleteCacheStorageCache',
  'deleteCacheStorageEntry',
  'getStorageQuota',
  'clearSiteData',
  'setStorageQuotaOverride',
] as const satisfies ReadonlyArray<keyof DevToolsRpc>;

export type TelemetryStorageMethod = (typeof TELEMETRY_STORAGE_METHODS)[number];

export function isTelemetryStorageMethod(value: unknown): value is TelemetryStorageMethod {
  return typeof value === 'string' && (TELEMETRY_STORAGE_METHODS as ReadonlyArray<string>).includes(value);
}

/**
 * Host → extension: one relayed storage bridge call. `params` is the
 * verb's own `DevToolsRpc` request shape — tab/frame scoping rides
 * inside it, exactly as on the in-browser bridge.
 */
export interface TelemetryStorageCallMessage<K extends TelemetryStorageMethod = TelemetryStorageMethod> {
  type: typeof TELEMETRY_STORAGE_CALL_TYPE;
  callId: string;
  method: K;
  params: DevToolsRpc[K]['req'];
}

/**
 * Extension → host: the call's reply on `oh.telemetry.storage.call:response`.
 * `payload` is the verb's own `DevToolsRpc` response shape. A call the
 * consent gate blocks (`backend.allowDesktopWatch` off) answers with
 * `refused: 'consent-off'` and a `null` payload — the relay settles the
 * caller `ok: false`, the same honest unreadable state a vanished peer
 * produces, instead of leaving the call to time out.
 */
export interface TelemetryStorageCallResponseMessage<K extends TelemetryStorageMethod = TelemetryStorageMethod> {
  type: `${typeof TELEMETRY_STORAGE_CALL_TYPE}:response`;
  callId: string;
  payload: DevToolsRpc[K]['res'] | null;
  refused?: 'consent-off';
}

/** Host → extension: one workbench consumer starts watching a tab's
 *  storage plane (`consumerId` minted by the host's relay). */
export interface TelemetryStorageConsumerMessage {
  type: typeof TELEMETRY_STORAGE_CONSUMER_TYPE;
  tabId: number;
  consumerId: string;
}

/** Host → extension: the consumer's storage watch ended. */
export interface TelemetryStorageDetachMessage {
  type: typeof TELEMETRY_STORAGE_DETACH_TYPE;
  tabId: number;
  consumerId: string;
}

/**
 * Extension → host: a tracked storage kind of the tab went stale
 * (CDP-armed tabs only), addressed to one consumer's watch. Carries no
 * data — the consumer refetches through the read verbs.
 */
export interface TelemetryStorageInvalidationMessage {
  type: typeof TELEMETRY_STORAGE_INVALIDATION_TYPE;
  tabId: number;
  consumerId: string;
  kind: StorageInvalidationKind;
}

export type TelemetryStorageWireMessage =
  | TelemetryStorageCallMessage
  | TelemetryStorageCallResponseMessage
  | TelemetryStorageConsumerMessage
  | TelemetryStorageDetachMessage
  | TelemetryStorageInvalidationMessage;

/** Channel-name prefix for the per-tab storage watch pipe. */
export const STORAGE_PORT_PREFIX = 'oh-storage:';

/**
 * A storage watch addressed THROUGH a host to a remote extension —
 * `oh-storage:<tabId>@<nodeId>`, the storage sibling of the qualified
 * lifecycle port. Browser-tab ids collide across browsers, so the peer
 * qualifier is part of the watch identity — never inferred.
 */
export interface QualifiedStoragePortTarget {
  readonly tabId: number;
  readonly nodeId: string;
}

export function qualifiedStoragePortName(tabId: number, nodeId: string): string {
  return `${STORAGE_PORT_PREFIX}${tabId}@${nodeId}`;
}

/** Parse `oh-storage:<tabId>@<nodeId>`. Returns `null` for any other shape. */
export function parseQualifiedStoragePortName(name: string): QualifiedStoragePortTarget | null {
  if (!name.startsWith(STORAGE_PORT_PREFIX)) return null;
  const suffix = name.slice(STORAGE_PORT_PREFIX.length);
  const at = suffix.indexOf('@');
  if (at <= 0) return null;
  const tabPart = suffix.slice(0, at);
  const nodeId = suffix.slice(at + 1);
  if (!/^-?\d+$/.test(tabPart) || nodeId.length === 0) return null;
  const tabId = Number.parseInt(tabPart, 10);
  if (!Number.isFinite(tabId)) return null;
  return { tabId, nodeId };
}
