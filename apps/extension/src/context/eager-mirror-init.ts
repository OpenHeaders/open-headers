/**
 * Eager initialization of every renderer-side entity mirror.
 *
 * The renderer mirror layer is the symmetric counterpart to the SW's
 * per-workspace cache layer. The SW boots its caches via
 * `attachCaches(WORKSPACE_REGISTRY)` (entity-registry.ts) — every cache
 * subscribes to the oracle's broadcast bus BEFORE any mutation can
 * fire. The renderer side has historically relied on lazy-init: each
 * mirror is a module-level singleton that doesn't subscribe to
 * `syncBroadcast` (or fetch its bootstrap snapshot) until the first
 * `getActiveXxxSyncMirror()` call resolves it.
 *
 * Lazy-singleton-on-first-write breaks two contracts:
 *
 *   1. **Subscription lifetime.** A write that fires before the
 *      singleton is created drops the post-commit broadcast (no
 *      listener attached). The snapshot RPC can recover state from
 *      storage but won't deliver broadcasts the surface never heard.
 *
 *   2. **First-write timing.** The snapshot RPC is async. A synchronous
 *      `mirror.get(uid)` immediately after singleton creation returns
 *      null until the snapshot resolves. Write clients that gate on
 *      `getXMirror(uid)` for "entity exists" checks falsely report
 *      `not-found`.
 *
 * Calling {@link eagerInitRendererMirrors} once at every renderer
 * surface entry point forces every singleton to instantiate at boot,
 * opens each broadcast subscription, and kicks off every snapshot
 * fetch in parallel. By the time the user's first gesture lands,
 * every mirror has subscribed and its snapshot has completed.
 *
 * Cost (one-time per surface):
 *   - 19 `chrome.runtime.onMessage` listeners (each filters on the
 *     bridge-level message type and short-circuits on mismatches).
 *   - 19 snapshot RPCs (parallel; ~50-100ms total cold-start latency
 *     since the SW handles them off the same broadcast bus).
 *
 * Idempotent — every `getActiveXxxSyncMirror` returns the existing
 * singleton on subsequent calls. Safe to invoke multiple times within
 * a surface's lifetime (e.g. once at module load + once at React tree
 * mount) without doubling up subscriptions.
 *
 * Read-only surfaces (e.g. sidepanel today) don't need this — they
 * never call write-clients and never hit the lazy-init race.
 */

import { getActiveAwarenessMirror } from './awareness-mirror';
import { getActiveCollectionSyncMirror } from './collection-sync-mirror';
import { getActiveEnvSyncMirror } from './env-sync-mirror';
import { getActiveExtensionWorkspaceSyncMirror } from './extension-workspace-sync-mirror';
import { getActiveFilesSyncMirror } from './files-sync-mirror';
import { getActiveFolderSyncMirror } from './folder-sync-mirror';
import { getActiveLayoutStateSyncMirror } from './layout-state-sync-mirror';
import { getActiveLiveVariableSyncMirror } from './live-variable-sync-mirror';
import { getActiveLiveWorkflowSyncMirror } from './live-workflow-sync-mirror';
import { getActivePauseMarkersSyncMirror } from './pause-markers-sync-mirror';
import { getActiveRequestCollectionSyncMirror } from './request-collection-sync-mirror';
import { getActiveRequestFolderSyncMirror } from './request-folder-sync-mirror';
import { getActiveRequestSyncMirror } from './request-sync-mirror';
import { getActiveRuleSyncMirror } from './rule-sync-mirror';
import { getActiveTemplateCollectionSyncMirror } from './template-collection-sync-mirror';
import { getActiveTemplateFolderSyncMirror } from './template-folder-sync-mirror';
import { getActiveTemplateSyncMirror } from './template-sync-mirror';
import { getActiveVaultSyncMirror } from './vault-sync-mirror';
import { getActiveWorkspaceVariablesSyncMirror } from './workspace-variables-sync-mirror';

export function eagerInitRendererMirrors(): void {
  // Order is irrelevant — every getter is independent. Listed
  // alphabetically so a missing entry is obvious in code review.
  getActiveAwarenessMirror();
  getActiveCollectionSyncMirror();
  getActiveEnvSyncMirror();
  getActiveExtensionWorkspaceSyncMirror();
  getActiveFilesSyncMirror();
  getActiveFolderSyncMirror();
  getActiveLayoutStateSyncMirror();
  getActiveLiveVariableSyncMirror();
  getActiveLiveWorkflowSyncMirror();
  getActivePauseMarkersSyncMirror();
  getActiveRequestCollectionSyncMirror();
  getActiveRequestFolderSyncMirror();
  getActiveRequestSyncMirror();
  getActiveRuleSyncMirror();
  getActiveTemplateCollectionSyncMirror();
  getActiveTemplateFolderSyncMirror();
  getActiveTemplateSyncMirror();
  getActiveVaultSyncMirror();
  getActiveWorkspaceVariablesSyncMirror();
}
