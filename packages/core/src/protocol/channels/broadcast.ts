/**
 * Broadcast contract — fire-and-forget pushes from the host reactor to
 * every open UI surface. Consumers subscribe via
 * `bridge.subscribe(type, handler)`; "no listeners" is not an error.
 */

import type { FileRef } from '../../files';
import type { ActivityEntry, MutationEnvelope, MutatorOutcome } from '../../sync';
import type {
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  StatusSnapshot,
  Template,
  TestRunOwnerType,
} from '../../types';
import type { WorkspaceIntent } from '../../workspace-intent';
import type { AwarenessState } from '../awareness-bridge';
import type {
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncExtensionWorkspacePostState,
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
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '../sync-bridge';
import type { WorkspaceSnapshot } from './common';
import type { EnvironmentsSnapshot } from './environments';

/**
 * Broadcast contract: map of message-type → payload shape (without `type`).
 *
 * Consumers subscribe via `bridge.subscribe(type, handler)`. The SW broadcasts
 * via `bridge.broadcast(type, payload)` — fire-and-forget; "no listeners"
 * is not an error.
 */
export interface BridgeBroadcastContract {
  rulesUpdated: { rules: Rule[]; timestamp?: number };
  templatesUpdated: { templates: Template[] };
  requestsUpdated: { requests: Request[] };
  testRunFinished: { ownerType: TestRunOwnerType; ownerId: string; runId: string };
  testRunDeleted: { runId: string };
  testRunsClearedForOwner: { ownerType: TestRunOwnerType; ownerId: string };
  connectionStatus: { connected: boolean };
  trackedUrlsUpdated: { tabId?: number };
  /**
   * Fires on any workspace list mutation (create/rename/delete/reorder)
   * AND on active-workspace switch. UI surfaces re-read rules, templates,
   * environments, and pause markers on this event — one atomic refetch
   * instead of four separate broadcasts.
   */
  workspaceChanged: WorkspaceSnapshot;
  /**
   * Fires on any environment / workspace-variables / vault / active-env
   * mutation in the active workspace. Carries the full 4-scope snapshot
   * so `useEnvironments` stays in lockstep without per-field broadcasts.
   */
  environmentsChanged: EnvironmentsSnapshot;
  /**
   * Fires whenever the observability log records or clears entries.
   * Payload carries the current size only — full entry reads happen
   * via the `getObservabilityLog` RPC so we don't push the buffer
   * on every record.
   */
  observabilityLogUpdated: { size: number };
  /**
   * Fires on every Status snapshot change — a subsystem reported a new
   * state, or the snapshot was cleared. Payload is the full snapshot so
   * listeners don't have to re-query after each event.
   */
  statusUpdated: StatusSnapshot;

  /**
   * Phase C F5 — live tail for the Activity Feed panel. Fires per
   * classified entry the receiver-side installer produces (one or
   * more per inbound envelope, depending on highlight kinds). The
   * payload is the same {@link ActivityEntry} the `oh.sync.listActivity`
   * RPC returns, so the panel can prepend without re-fetching.
   * Listeners filter on `entry.workspaceId` against the surface's
   * active workspace.
   */
  activityEntry: ActivityEntry;

  /**
   * Phase C F6.b — live tail for the per-entity mute list. Fires
   * whenever the host's mute cache observes a mute / unmute (RPC or
   * otherwise). Renderer surfaces filter on `workspaceId`; the panel
   * uses the change to flip its local "muted" badge without re-fetching.
   */
  activityMuteChanged: {
    workspaceId: string;
    entityType: string;
    entityId: string;
    /** True for mute, false for unmute. */
    muted: boolean;
    /** Wall-clock millis the change happened. */
    at: number;
  };

  /**
   * Workspace Intent — warm-path delivery from the SW navigator to an
   * already-open workspace tab. Declared on the broadcast contract
   * because `bridge.subscribe` is the renderer's shared subscription
   * primitive; the SW dispatcher actually routes via `tabs.sendMessage`
   * to a specific tab, but the listener shape is identical (both land
   * in `chrome.runtime.onMessage`).
   *
   * Intent is schema-validated at the navigator + again at the
   * renderer's router so malformed payloads can never propagate
   * past the boundary. See Phase 9.
   */
  'workspace-intent': { intent: WorkspaceIntent };

  /**
   * Fired by the SW's `workspace-tab-registry` whenever a workspace
   * tab is assigned, freed, or swapped (tab-discard restore). Every
   * open workspace surface uses this to recompose `document.title`
   * via the `useWorkspaceTabTitle` hook.
   *
   * `ordinals` is a plain object keyed by numeric tab id so the wire
   * shape is JSON-safe; renderers look up their own ordinal by the
   * tab-id they learned from `getWorkspaceTabOrdinal` at mount.
   */
  workspaceTabsChanged: { ordinals: Record<number, number>; count: number };

  /**
   * Fires on every active-workspace file-blob mutation (put / delete /
   * bulk purge). Carries the current `FileRef[]` snapshot so
   * consumers never render stale lists after a sibling tab uploads,
   * and so the multipart body editor's file picker stays live.
   *
   * Bytes are NOT included — hooks fetch them on demand via `getFile`.
   */
  filesChanged: { files: FileRef[] };

  /**
   * Fires on every Live Workflow definition mutation. Carries the full
   * workflow list so consumers (sidebar, editor, rule-editor picker)
   * stay in sync without per-workflow subscriptions.
   */
  liveWorkflowsChanged: { workflows: LiveWorkflow[] };

  /**
   * Fires on every Live Variable definition mutation. Carries the full
   * LV list so the sidebar + variable picker + resolver update
   * together.
   */
  liveVariablesChanged: { variables: LiveVariable[] };

  /**
   * Fires on every live-cache mutation (successful refresh, recorded
   * error, clear, purge). `workflowUid === null` signals a bulk
   * mutation (workspace purge). Consumers that care about a specific
   * workflow's countdown filter on the uid; broader consumers (Status
   * pill, observability) refetch on every event.
   */
  liveCacheChanged: { workflowUid: string | null };

  /**
   * Sync-engine broadcast — every committed mutation envelope and its
   * mutator outcome, re-published from the local oracle's broadcast
   * bus (Phase A). Surfaces dedup by `envelope.mutationId` and replay
   * on top of their optimistic state. The wire shape mirrors
   * `SyncBroadcastEvent` from `@openheaders/core/protocol` but stays a
   * `bridge` broadcast type so it travels alongside the other UI
   * change channels with no extra plumbing.
   */
  syncBroadcast: {
    envelope: MutationEnvelope;
    outcome: MutatorOutcome;
    batchId?: string;
    /**
     * Post-commit projection for Rule envelopes (Fw7). Renderer-side
     * rule mirrors fold this into their local view to track itemIds
     * for set-modeled paths without an oracle round-trip.
     */
    rulePostState?: SyncRulePostState;
    /**
     * Post-commit projection for Environment envelopes (Phase B).
     * Renderer-side environment mirrors fold this in lockstep with the
     * SW oracle.
     */
    environmentPostState?: SyncEnvironmentPostState;
    /**
     * Post-commit projection for Collection envelopes (Phase B).
     * Renderer-side collection mirrors fold this in lockstep with the
     * SW oracle.
     */
    collectionPostState?: SyncCollectionPostState;
    /**
     * Post-commit projection for workspace-variables envelopes (Phase B).
     * Renderer-side workspace-variables mirror folds this in lockstep
     * with the SW oracle.
     */
    workspaceVariablesPostState?: SyncWorkspaceVariablesPostState;
    /**
     * Post-commit projection for vault envelopes (Phase B). Singleton
     * entity. Local-only by §12.3 — never crosses any sync transport.
     */
    vaultPostState?: SyncVaultPostState;
    /**
     * Post-commit projection for Folder envelopes (Phase B). Renderer
     * mirrors fold this so sidebar tree consumers see post-commit
     * shape (full reconstructed path) without round-tripping the SW.
     */
    folderPostState?: SyncFolderPostState;
    /**
     * Post-commit projection for Request envelopes (Phase B). Renderer
     * mirrors fold this so request editor surfaces see post-commit
     * shape + live itemIds for set-modeled paths without round-tripping.
     */
    requestPostState?: SyncRequestPostState;
    /**
     * Post-commit projection for request-collection envelopes (Phase B).
     * Mirrors fold this so the request sidebar sees post-commit shape
     * without a round-trip.
     */
    requestCollectionPostState?: SyncRequestCollectionPostState;
    /**
     * Post-commit projection for request-folder envelopes (Phase B).
     * Same shape semantics as `folderPostState` — full reconstructed
     * path included.
     */
    requestFolderPostState?: SyncRequestFolderPostState;
    /**
     * Post-commit projection for Template envelopes (Phase B). Renderer
     * mirrors fold this so template editor surfaces see post-commit
     * shape + live itemIds for the set-modeled `conditions` path
     * without round-tripping.
     */
    templatePostState?: SyncTemplatePostState;
    /**
     * Post-commit projection for template-collection envelopes (Phase B).
     */
    templateCollectionPostState?: SyncTemplateCollectionPostState;
    /**
     * Post-commit projection for template-folder envelopes (Phase B).
     * Same shape semantics as `requestFolderPostState` — full
     * reconstructed path included.
     */
    templateFolderPostState?: SyncTemplateFolderPostState;
    /**
     * Post-commit projection for Live-Variable envelopes (Phase B).
     * Flat-scalar entity — no itemId map.
     */
    liveVariablePostState?: SyncLiveVariablePostState;
    /**
     * Post-commit projection for Live-Workflow envelopes (Phase B).
     * `steps` rides as a whole-array scalar — no itemId map.
     */
    liveWorkflowPostState?: SyncLiveWorkflowPostState;
    /**
     * Post-commit projection for live-value envelopes (WS-C C6).
     * Singleton entity. Sensitive — stripped from snapshots crossing a
     * trust zone, but converges across same-machine surfaces.
     */
    liveValuePostState?: SyncLiveValuePostState;
    /**
     * Post-commit projection for live-fallback-priority envelopes (WS-C
     * C14). Singleton entity. Not sensitive — members carry only
     * `Principal.id`s, so it rides the normal trust-zone-wide forwarder.
     */
    liveFallbackPriorityPostState?: SyncLiveFallbackPriorityPostState;
    /**
     * Post-commit projection for oauth-bundle envelopes (Phase B).
     * Singleton entity. Local-only by §12.3 — never crosses any sync
     * transport.
     */
    oauthBundlePostState?: SyncOAuthBundlePostState;
    /**
     * Post-commit projection for pause-markers envelopes (Phase B).
     * Singleton entity. User-visible UX state, not secrets — broadcast
     * + sync transports carry it freely.
     */
    pauseMarkersPostState?: SyncPauseMarkersPostState;
    /**
     * Post-commit projection for layout-state envelopes (Phase B).
     * Singleton entity. Pure UX state, not secrets — broadcast + sync
     * transports carry it freely.
     */
    layoutStatePostState?: SyncLayoutStatePostState;
    /**
     * Post-commit projection for files envelopes (Phase B). Singleton
     * entity. Catalog only — bytes live in the platform `BlobStore` IDB
     * and are read lazily on demand.
     */
    filesPostState?: SyncFilesPostState;
    /**
     * Post-commit projection for extensionWorkspace envelopes (Phase B).
     * Singleton entity at the GLOBAL scope (lives above the per-workspace
     * oracle). Published by the global-scope oracle, not the
     * per-workspace one; renderer-side mirrors filter by `body.type` so
     * source-of-broadcast is transparent.
     */
    extensionWorkspacePostState?: SyncExtensionWorkspacePostState;
  };

  /**
   * Awareness broadcast — canonical per-workspace presence list,
   * re-emitted by the SW on every publish/GC change. Ephemeral; never
   * persisted. Lives on a separate channel from `syncBroadcast` because
   * awareness is high-frequency and entangling presence flicker with
   * mutation projection would couple two unrelated lifecycles
   * (`docs/SYNC_ENGINE_DESIGN.md` §14).
   */
  awarenessBroadcast: {
    workspaceId: string;
    presence: AwarenessState[];
  };
}
