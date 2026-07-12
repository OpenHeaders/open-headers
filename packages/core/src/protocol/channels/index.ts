/**
 * Typed channel registry — the contract for every message that crosses
 * the host bridge (background/popup/workspace boundary in the browser
 * extension; renderer/main in Electron; client/daemon in the web app).
 *
 * Two shapes:
 *   - `BridgeRpcContract` — typed request/response RPC. Consumer calls
 *     `hostBridge.call('type', payload)` and receives a typed response.
 *     Every entry corresponds to exactly one handler on the host.
 *   - `BridgeBroadcastContract` — fire-and-forget pushes from the host
 *     reactor to all open UI surfaces. Consumers subscribe via
 *     `hostBridge.subscribe('type', handler)`.
 *
 * Lives in `@openheaders/core` (not the extension) because it is the
 * host-agnostic contract: the UI bundle and every host adapter type
 * against the same registry. See `@openheaders/core/bridge` for the
 * `HostBridge` interface that carries these channels.
 *
 * The RPC contract is assembled here from one domain-scoped sub-
 * interface per sibling module — each module owns its slice of the
 * registry plus the structural types only it needs. Adding a new
 * message:
 *   1. Add the entry to the right domain module (or a new one).
 *   2. Handle it on the host (extension: background/modules/
 *      message-handler.ts; or broadcast it from the reactor).
 *   3. Call it with `hostBridge.call(...)` / `hostBridge.broadcast(...)`.
 */

import type { ActivityRpc } from './activity';
import type { AwarenessRpc } from './awareness';
import type { BridgeBroadcastContract } from './broadcast';
import type { DaemonRpc } from './daemon';
import type { DevToolsRpc } from './devtools';
import type { EnvironmentRpc } from './environments';
import type { FileRpc } from './files';
import type { LiveRpc } from './live';
import type { NavigationRpc } from './navigation';
import type { OAuthRpc } from './oauth';
import type { ObservabilityRpc } from './observability';
import type { RequestRpc } from './requests';
import type { RuleRpc } from './rules';
import type { SyncEngineRpc } from './sync-engine';
import type { TemplateRpc } from './templates';
import type { UpdatesRpc } from './updates';
import type { WorkspaceRpc } from './workspace';

export type { BridgeBroadcastContract, StorageInvalidationKind } from './broadcast';
export type { FolderDescriptor, WorkspaceSnapshot } from './common';
export type {
  CacheEntryDocumentWire,
  CacheEntryHeaderWire,
  CacheEntryWire,
  CacheStorageCacheWire,
  DomStorageAreaWire,
  DomStorageEntryWire,
  DomStorageRenameFailureWire,
  IdbDatabaseWire,
  IdbObjectStoreWire,
  IdbRecordDocumentWire,
  IdbRecordPreviewEntryWire,
  IdbRecordPreviewNodeWire,
  IdbRecordWire,
  IdbRecordWriteFailureWire,
  JarCookieEditWire,
  JarCookieKeyWire,
  JarCookieWire,
  SiteDataTypeWire,
  SiteJarCookieWire,
  StorageQuotaBreakdownWire,
  StorageQuotaWire,
  StorageScopeWire,
} from './devtools';
export type { EnvironmentsSnapshot } from './environments';
export type { LiveWorkflowRunSnapshot } from './live';
export type { AppUpdatePhase, AppUpdateSeverity, AppUpdateState } from './updates';

/**
 * RPC contract: map of message-type → { req, res }.
 *
 * `req` is the payload (WITHOUT the `type` field). `res` is the value
 * the caller receives after the SW handler replies. Use
 * `Record<string, never>` for argument-less RPCs.
 *
 * Composed by extension from the per-domain sub-interfaces — every key
 * across them lands in this single flat registry.
 */
export interface BridgeRpcContract
  extends WorkspaceRpc,
    NavigationRpc,
    RuleRpc,
    TemplateRpc,
    EnvironmentRpc,
    RequestRpc,
    FileRpc,
    OAuthRpc,
    LiveRpc,
    ObservabilityRpc,
    ActivityRpc,
    SyncEngineRpc,
    AwarenessRpc,
    DevToolsRpc,
    DaemonRpc,
    UpdatesRpc {}

/**
 * Tab-directed contract: map of message-type → { req, res } for messages
 * sent from the background or popup DIRECTLY to a content script via
 * `tabs.sendMessage`. Handled by a `receive(type, handler)` subscription
 * inside the content script. Chrome routes these based on destination
 * (tab id), not the background's runtime.onMessage router — so tab types
 * live in a separate namespace to keep the RPC contract narrow.
 */
export type BridgeTabContract = Record<string, never>;

export type BridgeRpcType = keyof BridgeRpcContract;
export type BridgeRpcRequest<K extends BridgeRpcType> = BridgeRpcContract[K]['req'];
export type BridgeRpcResponse<K extends BridgeRpcType> = BridgeRpcContract[K]['res'];

export type BridgeTabType = keyof BridgeTabContract;
export type BridgeTabRequest<K extends BridgeTabType> = BridgeTabContract[K]['req'];
export type BridgeTabResponse<K extends BridgeTabType> = BridgeTabContract[K]['res'];

export type BridgeBroadcastType = keyof BridgeBroadcastContract;
export type BridgeBroadcastPayload<K extends BridgeBroadcastType> = BridgeBroadcastContract[K];

/** Union of every typed message name the bridge can carry. */
export type BridgeMessageType = BridgeRpcType | BridgeTabType;

/**
 * Error thrown by `bridge.call` / `bridge.tabCall` when the underlying
 * chrome messaging API surfaces a `lastError` (e.g. SW crashed, no
 * handler registered, context invalidated, receiving end does not
 * exist). Carries the original message type so callers can react
 * differently by message without string-matching.
 */
export class BridgeError extends Error {
  readonly type: BridgeMessageType;

  constructor(type: BridgeMessageType, reason: string) {
    super(`bridge(${type}) failed: ${reason}`);
    this.name = 'BridgeError';
    this.type = type;
  }
}
