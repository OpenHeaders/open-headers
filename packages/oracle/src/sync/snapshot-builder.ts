/**
 * Producer side of the C5 snapshot bootstrap.
 *
 * Builds a {@link WorkspaceSnapshot} blob by composing the per-entity
 * `snapshot*PostStates` helpers in {@link ./service}. The producer is
 * a pure read of the workspace's currently materialized state; the
 * state vector at capture time is folded from the same workspace's
 * mutation log so the receiver can resume the delta stream from a
 * coherent watermark.
 *
 * Two entry points mirror the state-vector reader pattern:
 *
 * - {@link buildSnapshotForWorkspace} — acquires the per-workspace
 *   service, awaits hydration, captures + folds, releases.
 * - {@link buildSnapshotFromOracle} — lower-level; takes the state
 *   vector + workspaceId explicitly. Useful for tests + for callers
 *   that already hold a service handle.
 *
 * **Sensitivity.** The blob carries `vault` + `oauthBundles` post-
 * states for the same reason snapshots are useful at all — so a
 * local-loopback restore can rehydrate the secret stores without
 * round-tripping plaintext through a transport. Any cross-host
 * sender MUST run the blob through {@link redactSensitiveSnapshotKeys}
 * before writing to the socket (§12.3). The producer doesn't enforce
 * that here because it doesn't know the transport's trust posture.
 */
import {
  SNAPSHOT_SCHEMA_VERSION,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';

import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotFilesPostStates,
  snapshotFolderPostStates,
  snapshotLayoutStatePostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotOAuthBundlePostStates,
  snapshotPauseMarkersPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplateFolderPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from './service';
import { computeStateVectorFromLog } from './state-vector-reader';

export async function buildSnapshotForWorkspace(workspaceId: string): Promise<WorkspaceSnapshot> {
  const svc = getOrCreateWorkspaceService(workspaceId);
  try {
    await svc.hydrated;
    const takenAtHlc = await computeStateVectorFromLog(svc.log);
    return buildSnapshotFromOracle(workspaceId, takenAtHlc);
  } finally {
    releaseWorkspaceService(workspaceId);
  }
}

/**
 * Capture the currently-materialized post-state of every per-workspace
 * entity into a snapshot blob. Caller supplies the watermark HLC
 * vector. No I/O — the caches are in-memory.
 *
 * The capture is a single synchronous pass; the per-entity helpers
 * each iterate their cache once, so total work is O(N) in live entity
 * count. Holding the service open for the duration of the call is
 * the caller's responsibility (the acquire/release wrapper in
 * {@link buildSnapshotForWorkspace} handles it for the common path).
 */
export function buildSnapshotFromOracle(
  workspaceId: string,
  takenAtHlc: WorkspaceSnapshot['takenAtHlc'],
): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId,
    takenAtHlc,
    rules: snapshotRulePostStates(workspaceId),
    environments: snapshotEnvironmentPostStates(workspaceId),
    collections: snapshotCollectionPostStates(workspaceId),
    workspaceVariables: snapshotWorkspaceVariablesPostStates(workspaceId),
    vault: snapshotVaultPostStates(workspaceId),
    folders: snapshotFolderPostStates(workspaceId),
    requests: snapshotRequestPostStates(workspaceId),
    requestCollections: snapshotRequestCollectionPostStates(workspaceId),
    requestFolders: snapshotRequestFolderPostStates(workspaceId),
    templates: snapshotTemplatePostStates(workspaceId),
    templateCollections: snapshotTemplateCollectionPostStates(workspaceId),
    templateFolders: snapshotTemplateFolderPostStates(workspaceId),
    liveVariables: snapshotLiveVariablePostStates(workspaceId),
    liveWorkflows: snapshotLiveWorkflowPostStates(workspaceId),
    oauthBundles: snapshotOAuthBundlePostStates(workspaceId),
    pauseMarkers: snapshotPauseMarkersPostStates(workspaceId),
    layoutState: snapshotLayoutStatePostStates(workspaceId),
    files: snapshotFilesPostStates(workspaceId),
  };
}
