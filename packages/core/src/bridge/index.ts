export type {
  BridgeBroadcastContract,
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeMessageType,
  BridgeRpcContract,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
  BridgeTabContract,
  BridgeTabRequest,
  BridgeTabResponse,
  BridgeTabType,
  CacheEntryResponsePreviewWire,
  CacheEntryWire,
  CacheStorageCacheWire,
  DomStorageAreaWire,
  DomStorageEntryWire,
  EnvironmentsSnapshot,
  FolderDescriptor,
  IdbDatabaseWire,
  IdbObjectStoreWire,
  IdbRecordDocumentWire,
  IdbRecordWire,
  JarCookieEditWire,
  JarCookieKeyWire,
  JarCookieWire,
  ListedTestRun,
  LiveWorkflowRunSnapshot,
  SiteDataTypeWire,
  SiteJarCookieWire,
  StartTestRunResult,
  StorageInvalidationKind,
  StorageQuotaBreakdownWire,
  StorageQuotaWire,
  StorageScopeWire,
  WorkspaceSnapshot,
} from '../protocol/channels';

// The typed channel registry the `HostBridge` contract is generic over.
// Physically lives in `../protocol/channels.ts` (alongside the other
// wire-shape `*-bridge.ts` files); surfaced here so `@openheaders/core/
// bridge` is the single entry point for everything bridge-related.
export { BridgeError } from '../protocol/channels';
export {
  getHostBridge,
  type HostBridge,
  hostBridge,
  requireHostBridge,
  setHostBridge,
} from './host-bridge';
