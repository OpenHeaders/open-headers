/**
 * Sync service — per-entity snapshot exports consumed by the
 * `oh.sync.snapshotX` RPC handlers.
 */

import type {
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncLayoutStatePostState,
  SyncLiveFallbackPriorityPostState,
  SyncLiveValuePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncResponseExamplePostState,
  SyncRulePostState,
  SyncScriptPackagePostState,
  SyncSpecPostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import {
  COLLECTION_REGISTRATION,
  ENVIRONMENT_REGISTRATION,
  FILES_REGISTRATION,
  FOLDER_REGISTRATION,
  flatSnapshot,
  LAYOUT_STATE_REGISTRATION,
  LIVE_FALLBACK_PRIORITY_REGISTRATION,
  LIVE_VALUE_REGISTRATION,
  LIVE_VARIABLE_REGISTRATION,
  LIVE_WORKFLOW_REGISTRATION,
  OAUTH_BUNDLE_REGISTRATION,
  PAUSE_MARKERS_REGISTRATION,
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
  RESPONSE_EXAMPLE_REGISTRATION,
  RULE_REGISTRATION,
  SCRIPT_PACKAGE_REGISTRATION,
  SPEC_REGISTRATION,
  singletonSnapshot,
  TEMPLATE_COLLECTION_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  TEMPLATE_REGISTRATION,
  VAULT_REGISTRATION,
  WORKSPACE_VARIABLES_REGISTRATION,
} from '../entity-registry';
import type { EntityOracle } from '../oracle';
import { currentActive, services } from './state';

// ── Snapshot exports — consumed by `oh.sync.snapshotX` RPC handlers ──
//
// Each export returns the materialized post-state for the entity it
// names; renderer mirrors call these on mount before subscribing to
// the live broadcast. Per-workspace mirrors pass an explicit
// `workspaceId`; legacy callers omit it and fall back to the runtime-
// Active workspace. Returns `[]` when no oracle is materialized for
// the requested workspace — the renderer falls back to broadcast-only
// seeding (and the next `setRuntimeActive` flips the picture once the
// service hydrates).
//
// Per-workspace dispatch is the renderer-mirror-plane symmetry to
// commit 1's per-workspace SW data plane: each `services.get(id)?.oracle`
// projects exactly the workspace the renderer asked for, so cross-
// workspace contamination is structurally impossible at the snapshot
// layer (M-2 supports the broadcast layer; this enforces the cold-mount
// snapshot layer the same way).

function oracleForWorkspace(workspaceId: string | undefined): EntityOracle | null {
  const id = workspaceId ?? currentActive;
  if (id === null) return null;
  return services.get(id)?.oracle ?? null;
}

export function snapshotRulePostStates(workspaceId?: string): SyncRulePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, RULE_REGISTRATION) : [];
}

export function snapshotEnvironmentPostStates(workspaceId?: string): SyncEnvironmentPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, ENVIRONMENT_REGISTRATION) : [];
}

export function snapshotCollectionPostStates(workspaceId?: string): SyncCollectionPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, COLLECTION_REGISTRATION) : [];
}

export function snapshotWorkspaceVariablesPostStates(workspaceId?: string): SyncWorkspaceVariablesPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, WORKSPACE_VARIABLES_REGISTRATION) : [];
}

export function snapshotVaultPostStates(workspaceId?: string): SyncVaultPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, VAULT_REGISTRATION) : [];
}

export function snapshotFolderPostStates(workspaceId?: string): SyncFolderPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, FOLDER_REGISTRATION) : [];
}

export function snapshotRequestPostStates(workspaceId?: string): SyncRequestPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, REQUEST_REGISTRATION) : [];
}

export function snapshotRequestCollectionPostStates(workspaceId?: string): SyncRequestCollectionPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, REQUEST_COLLECTION_REGISTRATION) : [];
}

export function snapshotRequestFolderPostStates(workspaceId?: string): SyncRequestFolderPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, REQUEST_FOLDER_REGISTRATION) : [];
}

export function snapshotTemplatePostStates(workspaceId?: string): SyncTemplatePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, TEMPLATE_REGISTRATION) : [];
}

export function snapshotTemplateCollectionPostStates(workspaceId?: string): SyncTemplateCollectionPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, TEMPLATE_COLLECTION_REGISTRATION) : [];
}

export function snapshotTemplateFolderPostStates(workspaceId?: string): SyncTemplateFolderPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, TEMPLATE_FOLDER_REGISTRATION) : [];
}

export function snapshotLiveVariablePostStates(workspaceId?: string): SyncLiveVariablePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, LIVE_VARIABLE_REGISTRATION) : [];
}

export function snapshotScriptPackagePostStates(workspaceId?: string): SyncScriptPackagePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, SCRIPT_PACKAGE_REGISTRATION) : [];
}

export function snapshotResponseExamplePostStates(workspaceId?: string): SyncResponseExamplePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, RESPONSE_EXAMPLE_REGISTRATION) : [];
}

export function snapshotSpecPostStates(workspaceId?: string): SyncSpecPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, SPEC_REGISTRATION) : [];
}

export function snapshotLiveWorkflowPostStates(workspaceId?: string): SyncLiveWorkflowPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? flatSnapshot(o, LIVE_WORKFLOW_REGISTRATION) : [];
}

export function snapshotLiveValuePostStates(workspaceId?: string): SyncLiveValuePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, LIVE_VALUE_REGISTRATION) : [];
}

export function snapshotLiveFallbackPriorityPostStates(workspaceId?: string): SyncLiveFallbackPriorityPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, LIVE_FALLBACK_PRIORITY_REGISTRATION) : [];
}

export function snapshotOAuthBundlePostStates(workspaceId?: string): SyncOAuthBundlePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, OAUTH_BUNDLE_REGISTRATION) : [];
}

export function snapshotPauseMarkersPostStates(workspaceId?: string): SyncPauseMarkersPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, PAUSE_MARKERS_REGISTRATION) : [];
}

export function snapshotLayoutStatePostStates(workspaceId?: string): SyncLayoutStatePostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, LAYOUT_STATE_REGISTRATION) : [];
}

export function snapshotFilesPostStates(workspaceId?: string): SyncFilesPostState[] {
  const o = oracleForWorkspace(workspaceId);
  return o ? singletonSnapshot(o, FILES_REGISTRATION) : [];
}
