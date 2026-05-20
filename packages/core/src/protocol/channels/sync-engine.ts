/**
 * Sync-engine bridge RPCs (Phase A) — the all-or-nothing mutation-batch
 * apply plus the per-entity post-state snapshot calls a freshly-mounted
 * renderer surface uses to bootstrap its mirror.
 */

import type {
  SyncApplyRequest,
  SyncApplyResponse,
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncExtensionWorkspacePostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncLayoutStatePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '../sync-bridge';

export interface SyncEngineRpc {
  /**
   * Apply a `MutationBatch` against the local oracle all-or-nothing
   * under the per-entity Web Lock. Mirrors `SyncApplyRequest` from
   * `@openheaders/core/protocol` — the `type` field is added by the
   * bridge layer, so the `req` shape is the request minus `type`. The
   * response is the oracle's structured ack (success → per-envelope
   * outcomes; failure → the offending mutationId + reason).
   */
  'oh.sync.apply': {
    req: Omit<SyncApplyRequest, 'type'>;
    res: SyncApplyResponse;
  };
  /**
   * Snapshot the active workspace's full Rule oracle state for a
   * freshly-mounted renderer surface — `(rule, setItemIds)` per uid,
   * matching the broadcast `rulePostState` payload. The renderer-side
   * mirror calls this on construction so subsequent writes can
   * synchronously enumerate live itemIds without round-tripping per
   * envelope (§19.4). Subsequent broadcasts overwrite per-uid; the
   * snapshot is only authoritative for ids the SW hasn't broadcast
   * since the surface mounted.
   */
  'oh.sync.snapshotRules': {
    req: { workspaceId?: string };
    res: { entries: SyncRulePostState[] };
  };
  /**
   * Snapshot the active workspace's full Environment oracle state.
   * Same semantics as `oh.sync.snapshotRules` for the Environment
   * entity — `(environment, varUids)` per envId, matching the
   * broadcast `environmentPostState` payload. Renderer-side env
   * mirrors call this on construction.
   */
  'oh.sync.snapshotEnvironments': {
    req: { workspaceId?: string };
    res: { entries: SyncEnvironmentPostState[] };
  };
  /**
   * Snapshot the active workspace's full Collection oracle state.
   * Same semantics as `oh.sync.snapshotEnvironments` —
   * `(collection, varUids)` per uid, matching the broadcast
   * `collectionPostState` payload.
   */
  'oh.sync.snapshotCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton workspace-variables
   * oracle state. Same semantics as the other snapshot RPCs;
   * `entries` carries 0 or 1 element (singleton — present once seeded,
   * absent on a cold oracle prior to the first seed).
   */
  'oh.sync.snapshotWorkspaceVariables': {
    req: { workspaceId?: string };
    res: { entries: SyncWorkspaceVariablesPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton vault oracle state.
   * Same semantics as `oh.sync.snapshotWorkspaceVariables` — singleton
   * `entries` carries 0 or 1 element. Local-only by §12.3; the
   * payload never crosses any sync transport.
   */
  'oh.sync.snapshotVault': {
    req: { workspaceId?: string };
    res: { entries: SyncVaultPostState[] };
  };
  /**
   * Snapshot the active workspace's full Folder oracle state. Same
   * semantics as `oh.sync.snapshotCollections` — `(folder)` per uid,
   * matching the broadcast `folderPostState` payload. Folders whose
   * parent linkage isn't currently resolvable are skipped; they
   * republish on the next folder/parent broadcast that resolves the
   * chain.
   */
  'oh.sync.snapshotFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Request oracle state. Same
   * semantics as `oh.sync.snapshotRules` — `(request, setItemIds)` per
   * uid, matching the broadcast `requestPostState` payload.
   */
  'oh.sync.snapshotRequests': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestPostState[] };
  };
  /**
   * Snapshot the active workspace's full request-collection oracle
   * state. Mirror of `oh.sync.snapshotCollections` for the
   * request-collection entity type. Each entry carries the materialized
   * `{ collection, varUids, setOrderKeys }` triple.
   */
  'oh.sync.snapshotRequestCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's full request-folder oracle state.
   * Mirror of `oh.sync.snapshotFolders` for the request-folder entity
   * type. Folders whose parent linkage isn't currently resolvable are
   * skipped; they republish on the next folder/parent broadcast that
   * resolves the chain.
   */
  'oh.sync.snapshotRequestFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Template oracle state. Same
   * semantics as `oh.sync.snapshotRequests` — `(template, setItemIds)`
   * per uid, matching the broadcast `templatePostState` payload.
   */
  'oh.sync.snapshotTemplates': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplatePostState[] };
  };
  /**
   * Snapshot the active workspace's full template-collection oracle
   * state. Mirror of `oh.sync.snapshotRequestCollections` for the
   * template-collection entity type. Each entry carries the materialized
   * `{ collection, varUids, setOrderKeys }` triple.
   */
  'oh.sync.snapshotTemplateCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplateCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's full template-folder oracle state.
   * Mirror of `oh.sync.snapshotRequestFolders` for the template-folder
   * entity type. Folders whose parent linkage isn't currently
   * resolvable are skipped.
   */
  'oh.sync.snapshotTemplateFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplateFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Live-Variable oracle state.
   * Each entry carries `{ liveVariable }` — LV is fully flat-scalar so
   * no itemId map rides along.
   */
  'oh.sync.snapshotLiveVariables': {
    req: { workspaceId?: string };
    res: { entries: SyncLiveVariablePostState[] };
  };
  /**
   * Snapshot the active workspace's full Live-Workflow oracle state.
   * Each entry carries `{ workflow }` — `steps` is a whole-array scalar
   * so no itemId map rides along.
   */
  'oh.sync.snapshotLiveWorkflows': {
    req: { workspaceId?: string };
    res: { entries: SyncLiveWorkflowPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton oauth-bundle oracle
   * state. Same semantics as `oh.sync.snapshotVault` — singleton
   * `entries` carries 0 or 1 element. Local-only by §12.3; the
   * payload (token + secret material) never crosses any sync transport.
   */
  'oh.sync.snapshotOAuthBundle': {
    req: { workspaceId?: string };
    res: { entries: SyncOAuthBundlePostState[] };
  };
  /**
   * Snapshot the active workspace's singleton pause-markers oracle
   * state. Same semantics as `oh.sync.snapshotVault` — singleton
   * `entries` carries 0 or 1 element. User-visible UX state, not
   * secrets.
   */
  'oh.sync.snapshotPauseMarkers': {
    req: { workspaceId?: string };
    res: { entries: SyncPauseMarkersPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton layout-state oracle
   * state. Same semantics as `oh.sync.snapshotPauseMarkers` — singleton
   * `entries` carries 0 or 1 element. Pure UX state, not secrets.
   */
  'oh.sync.snapshotLayoutState': {
    req: { workspaceId?: string };
    res: { entries: SyncLayoutStatePostState[] };
  };
  /**
   * Snapshot the active workspace's singleton files oracle state. Same
   * semantics as `oh.sync.snapshotPauseMarkers` — singleton `entries`
   * carries 0 or 1 element. The catalog only governs `(fileId, hash,
   * filename, mimeType, size)` shells; the actual blob bytes live in
   * the platform `BlobStore` IDB and are read lazily on demand.
   */
  'oh.sync.snapshotFiles': {
    req: { workspaceId?: string };
    res: { entries: SyncFilesPostState[] };
  };
  /**
   * Snapshot the global-scope extensionWorkspace oracle's singleton
   * record. Same semantics as `oh.sync.snapshotFiles` — singleton
   * `entries` carries 0 or 1 element. Published by the global oracle
   * (lives above the per-workspace oracle so workspace switches don't
   * tear it down). Renderer mirrors call this on mount before the
   * first broadcast lands.
   */
  'oh.sync.snapshotExtensionWorkspaces': {
    req: Record<string, never>;
    res: { entries: SyncExtensionWorkspacePostState[] };
  };
}
