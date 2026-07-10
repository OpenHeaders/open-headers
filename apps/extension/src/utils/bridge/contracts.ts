/**
 * Compatibility re-export — the typed channel registry now lives in
 * `@openheaders/core` (`protocol/channels.ts`) and is surfaced through
 * `@openheaders/core/bridge`, next to the `HostBridge` contract it pairs
 * with, so the host-agnostic UI bundle and every host adapter type
 * against the same contract.
 *
 * This shim keeps the historical `@/utils/bridge/contracts` import path
 * working until the E.3 codemod sweep repoints consumers at core
 * directly. New code should import from `@openheaders/core/bridge`.
 */

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
  EnvironmentsSnapshot,
  FolderDescriptor,
  LiveWorkflowRunSnapshot,
  WorkspaceSnapshot,
} from '@openheaders/core/bridge';
export { BridgeError } from '@openheaders/core/bridge';
