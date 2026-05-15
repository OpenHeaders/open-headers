/**
 * Stub {@link HostBridge} for the desktop renderer's first-cut mount.
 *
 * No engine host is wired yet — the main-process side that runs oracle +
 * rule-engine + answers the RPC channel registry lands with the Stage-2
 * orchestration lift. Until then this stub keeps the UI mountable:
 *
 *   - Every `oh.sync.snapshot*` answers `{ entries: [] }` so renderer
 *     mirrors instantiate against empty state.
 *   - `oh.sync.apply` answers `{ ok: true, outcomes: [] }` so optimistic
 *     write paths don't blow up — the write just doesn't land anywhere.
 *   - Awareness publishes/snapshots return empty presence.
 *   - The boot-time list/get/status RPCs the UI exercises during initial
 *     render get explicit empty shapes (workspaces empty, environments
 *     empty, rules empty …). Empty active-workspace short-circuits the
 *     per-workspace mirror eager-init so most RPCs are never hit.
 *   - `broadcast` is a no-op, `subscribe` returns a no-op disposer,
 *     `presence` returns a no-op disposer.
 *   - Anything outside this set rejects with a clear stub-bridge error
 *     so the real build surfaces what additional plumbing the engine
 *     host owes.
 *
 * The contract that lands later (IPC-backed adapter talking to the
 * main-process engine host) implements the same {@link HostBridge}
 * surface — nothing on the UI side changes when it swaps in.
 */

import type {
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
  HostBridge,
} from '@openheaders/core/bridge';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'StubBridge';

function emptySnapshot<K extends BridgeRpcType>(): BridgeRpcResponse<K> {
  return { entries: [] } as unknown as BridgeRpcResponse<K>;
}

function answer<K extends BridgeRpcType>(type: K): BridgeRpcResponse<K> | null {
  if (type.startsWith('oh.sync.snapshot')) return emptySnapshot<K>();

  switch (type) {
    case 'oh.sync.apply':
      return { ok: true, outcomes: [] } as unknown as BridgeRpcResponse<K>;
    case 'oh.awareness.publish':
      return { ok: true, presence: [] } as unknown as BridgeRpcResponse<K>;
    case 'oh.awareness.snapshot':
      return { workspaceId: null, presence: [] } as unknown as BridgeRpcResponse<K>;

    // Workspace / connection boot-time reads.
    case 'popupOpen':
      return {
        rules: [],
        connected: false,
        workspaces: [],
        activeWorkspaceId: '',
      } as unknown as BridgeRpcResponse<K>;
    case 'listWorkspaces':
      return { workspaces: [], activeWorkspaceId: '' } as unknown as BridgeRpcResponse<K>;
    case 'checkConnection':
      return { connected: false } as unknown as BridgeRpcResponse<K>;

    // Active-workspace list reads — empty arrays so empty-state UI renders.
    case 'getLocalRules':
      return { rules: [] } as unknown as BridgeRpcResponse<K>;
    case 'getLocalCollections':
    case 'getTemplateCollections':
    case 'getLocalRequestCollections':
      return { collections: [] } as unknown as BridgeRpcResponse<K>;
    case 'getLocalCollectionTrees':
    case 'getTemplateCollectionTrees':
    case 'getLocalRequestCollectionTrees':
      return { collectionTrees: [] } as unknown as BridgeRpcResponse<K>;
    case 'getLocalFolders':
    case 'getTemplateFolders':
    case 'getLocalRequestFolders':
      return { folders: [] } as unknown as BridgeRpcResponse<K>;
    case 'getLocalRequests':
      return { requests: [] } as unknown as BridgeRpcResponse<K>;
    case 'getTemplates':
      return { templates: [] } as unknown as BridgeRpcResponse<K>;
    case 'listLiveWorkflows':
      return { workflows: [] } as unknown as BridgeRpcResponse<K>;
    case 'listLiveVariables':
      return { variables: [] } as unknown as BridgeRpcResponse<K>;
    case 'listFiles':
      return { files: [] } as unknown as BridgeRpcResponse<K>;

    // Environments + variables — empty quartet.
    case 'listEnvironments':
      return {
        environments: [],
        activeEnvironmentId: null,
        defaultEnvironmentId: null,
        collectionEnvOverrides: {},
        manualEnvId: null,
      } as unknown as BridgeRpcResponse<K>;
    case 'getWorkspaceVariables':
      return {
        workspaceVariables: { schemaVersion: 5, variables: [] },
      } as unknown as BridgeRpcResponse<K>;
    case 'getVault':
      return { vault: { schemaVersion: 5, secrets: [] } } as unknown as BridgeRpcResponse<K>;

    // Observability / status / misc boot-time reads.
    case 'getObservabilityLog':
      return { entries: [] } as unknown as BridgeRpcResponse<K>;
    case 'listImportReports':
      return { reports: [] } as unknown as BridgeRpcResponse<K>;
    case 'getRequestScriptsReviewPending':
      return { uids: [] } as unknown as BridgeRpcResponse<K>;
    case 'getAllowedFetchHosts':
      return { hosts: [] } as unknown as BridgeRpcResponse<K>;
    case 'getStatusSnapshot':
      return { snapshot: {} } as unknown as BridgeRpcResponse<K>;
    case 'getWorkspaceTabOrdinal':
      return { ordinal: null, count: 0 } as unknown as BridgeRpcResponse<K>;
    case 'oauthGetRedirectUri':
      return { redirectUri: '' } as unknown as BridgeRpcResponse<K>;

    default:
      return null;
  }
}

export const stubBridge: HostBridge = {
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    void args;
    const stub = answer<K>(type);
    if (stub !== null) return Promise.resolve(stub);
    logger.warn(SCOPE, `unsupported RPC: ${type} (stub bridge in place — engine host not wired)`);
    return Promise.reject(new Error(`stub bridge: RPC '${type}' has no answer yet`));
  },
  broadcast<K extends BridgeBroadcastType>(
    _type: K,
    ..._args: BridgeBroadcastPayload<K> extends Record<string, never> ? [] : [payload: BridgeBroadcastPayload<K>]
  ): void {
    // Engine host hasn't published anything to re-broadcast.
  },
  subscribe<K extends BridgeBroadcastType>(
    _subscribedType: K,
    _handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    return () => {};
  },
  presence(_name: string): () => void {
    return () => {};
  },
};
