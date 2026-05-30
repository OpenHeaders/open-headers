/**
 * Entity registry — single declarative source-of-truth for every
 * sync-engine entity wired into the SW.
 *
 * Each registration captures the per-entity wiring that `service.ts`
 * (per-workspace) and `global-service.ts` (cross-workspace metadata)
 * would otherwise copy-paste in seven places: cache construction,
 * cache disposal, broadcast projector, post-state field naming,
 * snapshot iteration, and the test-init duplicate. Adding a new
 * entity becomes one registry entry instead of edits scattered across
 * the SW boot path.
 *
 * Two kinds:
 *   - `FlatRegistration` — many entities by uid; snapshot iterates
 *     `oracle.materializeAll()` and projects each row.
 *   - `SingletonRegistration` — one entity per scope (vault, layout,
 *     files, oauth-bundle, pause-markers, workspace-variables,
 *     extension-workspace); snapshot projects once.
 *
 * The lifecycle helpers (`buildCaches`, `disposeCaches`,
 * `buildProjectorPipeline`) are scope-agnostic — both
 * `WORKSPACE_REGISTRY` and `GLOBAL_REGISTRY` flow through the same
 * code paths. The two scopes are kept as separate arrays because
 * their host services have different lifecycles (per-workspace
 * dispose + reinit on workspace switch vs. once-per-SW global), not
 * because the per-entity wiring differs.
 */

import type { EntitySchema, EntitySchemaRegistry, MutationEnvelope, SetPathsResolver } from '@openheaders/core/sync';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACES_SET_PATH,
  FILES_ENTITY_TYPE,
  FILES_REFS_PATH,
  FOLDER_ENTITY_TYPE,
  LAYOUT_STATE_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
  LIVE_VALUE_ENTITY_TYPE,
  LIVE_VALUE_VALUES_PATH,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_PATH,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_HEADERS_PATH,
  REQUEST_PARAMS_PATH,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  VAULT_PATH,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';
import { type BroadcastProjector, composeProjectors, type EntityPostState } from './bridge';
import type { InMemoryBroadcast } from './broadcast';
import { createCollectionCache } from './collection-cache';
import { projectCollectionByUid, projectCollectionPostState } from './collection-post-state';
import { projectEnvironmentByUid, projectEnvironmentPostState } from './env-post-state';
import { createEnvironmentCache } from './environment-cache';
import { createExtensionWorkspaceCache } from './extension-workspace-cache';
import {
  projectExtensionWorkspacePostState,
  projectExtensionWorkspaceSingleton,
} from './extension-workspace-post-state';
import { createFilesCache } from './files-cache';
import { projectFilesPostState, projectFilesSingleton } from './files-post-state';
import { createFolderCache } from './folder-cache';
import { projectFolderByUid, projectFolderPostState } from './folder-post-state';
import { createLayoutStateCache } from './layout-state-cache';
import { projectLayoutStatePostState, projectLayoutStateSingleton } from './layout-state-post-state';
import { createLiveFallbackPriorityCache } from './live-fallback-priority-cache';
import {
  projectLiveFallbackPriorityPostState,
  projectLiveFallbackPrioritySingleton,
} from './live-fallback-priority-post-state';
import { createLiveValueCache } from './live-value-cache';
import { projectLiveValuePostState, projectLiveValueSingleton } from './live-value-post-state';
import { createLiveVariableCache } from './live-variable-cache';
import { projectLiveVariableByUid, projectLiveVariablePostState } from './live-variable-post-state';
import { createLiveWorkflowCache } from './live-workflow-cache';
import { projectLiveWorkflowByUid, projectLiveWorkflowPostState } from './live-workflow-post-state';
import { createOAuthBundleCache } from './oauth-bundle-cache';
import { projectOAuthBundlePostState, projectOAuthBundleSingleton } from './oauth-bundle-post-state';
import type { EntityOracle } from './oracle';
import { createPauseMarkersCache } from './pause-markers-cache';
import { projectPauseMarkersPostState, projectPauseMarkersSingleton } from './pause-markers-post-state';
import { createRequestCache } from './request-cache';
import { createRequestCollectionCache } from './request-collection-cache';
import { projectRequestCollectionByUid, projectRequestCollectionPostState } from './request-collection-post-state';
import { createRequestFolderCache } from './request-folder-cache';
import { projectRequestFolderByUid, projectRequestFolderPostState } from './request-folder-post-state';
import { projectRequestByUid, projectRequestPostState } from './request-post-state';
import { createRuleCache } from './rule-cache';
import { projectRuleByUid, projectRulePostState } from './rule-post-state';
import type { SwContextHandle } from './sw-context';
import { createTemplateCache } from './template-cache';
import { createTemplateCollectionCache } from './template-collection-cache';
import { projectTemplateCollectionByUid, projectTemplateCollectionPostState } from './template-collection-post-state';
import { createTemplateFolderCache } from './template-folder-cache';
import { projectTemplateFolderByUid, projectTemplateFolderPostState } from './template-folder-post-state';
import { projectTemplateByUid, projectTemplatePostState } from './template-post-state';
import { createVaultCache } from './vault-cache';
import { projectVaultPostState, projectVaultSingleton } from './vault-post-state';
import { createWorkspaceVariablesCache } from './workspace-variables-cache';
import {
  projectWorkspaceVariablesPostState,
  projectWorkspaceVariablesSingleton,
} from './workspace-variables-post-state';

// ── Types ────────────────────────────────────────────────────────────

/** Structural minimum the registry needs from any entity cache. */
export interface EntityCacheLike {
  /**
   * Read this entity's persisted projection from `chrome.storage.local`
   * and seed the oracle. No-op for caches without a chrome.storage
   * projection (e.g. files — bytes live in BlobStore IDB, the catalog
   * is sync-engine-singleton without a wsKeys projection). Awaited by
   * {@link buildService}'s `hydrated` promise so per-workspace services
   * start with their caches populated regardless of Active state — the
   * fix for the cross-workspace residency bug where lazy re-materialized
   * non-Active services would otherwise project an empty oracle and
   * report `Workflow X not found in workspace Y` for entities that
   * exist in storage.
   */
  hydrateFromStorage(): Promise<void>;
  dispose(): void;
}

type ContextFactoryFn = () => ReturnType<SwContextHandle['next']>;

export type CacheFactory<C extends EntityCacheLike = EntityCacheLike> = (
  scope: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: ContextFactoryFn,
) => C;

/** All optional post-state slices the broadcast event carries. */
export type PostStateKey = keyof EntityPostState;

type ProjectionOf<K extends PostStateKey> = NonNullable<EntityPostState[K]>;

type PostStateProjector<K extends PostStateKey> = (
  oracle: EntityOracle,
  envelope: MutationEnvelope,
) => ProjectionOf<K> | null | undefined;

type ByUidProjector<K extends PostStateKey> = (oracle: EntityOracle, id: string) => ProjectionOf<K> | null | undefined;

type SingletonProjector<K extends PostStateKey> = (oracle: EntityOracle) => ProjectionOf<K> | null | undefined;

interface BaseRegistration<K extends PostStateKey> {
  entityType: string;
  createCache: CacheFactory;
  postStateKey: K;
  projectPostState: PostStateProjector<K>;
  /** Set-modeled paths that must always materialize as arrays — `[]`
   *  when no live entries exist, the ordered set otherwise. Drives the
   *  schema-aware materializer in `core/sync/store/materialize.ts`.
   *  Omit for entities with no set-modeled fields (folder, layout,
   *  live-workflow, live-variable). */
  setPaths?: SetPathsResolver;
}

export interface FlatRegistration<K extends PostStateKey = PostStateKey> extends BaseRegistration<K> {
  kind: 'flat';
  projectByUid: ByUidProjector<K>;
}

export interface SingletonRegistration<K extends PostStateKey = PostStateKey> extends BaseRegistration<K> {
  kind: 'singleton';
  projectSingleton: SingletonProjector<K>;
}

export type EntityRegistration = FlatRegistration | SingletonRegistration;

// Builder helpers: the per-entity cache type C is captured at the call
// site so `createCache` is type-checked against the registration's
// declared cache type. The builders widen to `EntityCacheLike` for
// storage in the registry array.
function flatEntity<K extends PostStateKey, C extends EntityCacheLike>(spec: {
  entityType: string;
  createCache: CacheFactory<C>;
  postStateKey: K;
  projectPostState: PostStateProjector<K>;
  projectByUid: ByUidProjector<K>;
  setPaths?: SetPathsResolver;
}): FlatRegistration<K> {
  return {
    kind: 'flat',
    entityType: spec.entityType,
    createCache: spec.createCache as CacheFactory,
    postStateKey: spec.postStateKey,
    projectPostState: spec.projectPostState,
    projectByUid: spec.projectByUid,
    setPaths: spec.setPaths,
  };
}

function singletonEntity<K extends PostStateKey, C extends EntityCacheLike>(spec: {
  entityType: string;
  createCache: CacheFactory<C>;
  postStateKey: K;
  projectPostState: PostStateProjector<K>;
  projectSingleton: SingletonProjector<K>;
  setPaths?: SetPathsResolver;
}): SingletonRegistration<K> {
  return {
    kind: 'singleton',
    entityType: spec.entityType,
    createCache: spec.createCache as CacheFactory,
    postStateKey: spec.postStateKey,
    projectPostState: spec.projectPostState,
    projectSingleton: spec.projectSingleton,
    setPaths: spec.setPaths,
  };
}

// ── Per-entity registrations ────────────────────────────────────────

// `conditions` is universal across rule variants. `action.requestHeaders`
// + `action.responseHeaders` exist only on `type: 'header'` rules — the
// resolver branches on the discriminant so non-header rules don't grow
// stray empty header arrays on their action shape.
const ruleSetPaths: SetPathsResolver = (partial: unknown): readonly string[] => {
  if (
    typeof partial === 'object' &&
    partial !== null &&
    !Array.isArray(partial) &&
    (partial as { type?: unknown }).type === 'header'
  ) {
    return ['conditions', 'action.requestHeaders', 'action.responseHeaders'];
  }
  return ['conditions'];
};

export const RULE_REGISTRATION = flatEntity({
  entityType: RULE_ENTITY_TYPE,
  createCache: createRuleCache,
  postStateKey: 'rulePostState',
  projectPostState: projectRulePostState,
  projectByUid: projectRuleByUid,
  setPaths: ruleSetPaths,
});

export const ENVIRONMENT_REGISTRATION = flatEntity({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  createCache: createEnvironmentCache,
  postStateKey: 'environmentPostState',
  projectPostState: projectEnvironmentPostState,
  projectByUid: projectEnvironmentByUid,
  setPaths: [ENV_VARS_PATH],
});

export const COLLECTION_REGISTRATION = flatEntity({
  entityType: COLLECTION_ENTITY_TYPE,
  createCache: createCollectionCache,
  postStateKey: 'collectionPostState',
  projectPostState: projectCollectionPostState,
  projectByUid: projectCollectionByUid,
  setPaths: [COLLECTION_VARS_PATH],
});

export const FOLDER_REGISTRATION = flatEntity({
  entityType: FOLDER_ENTITY_TYPE,
  createCache: createFolderCache,
  postStateKey: 'folderPostState',
  projectPostState: projectFolderPostState,
  projectByUid: projectFolderByUid,
});

export const WORKSPACE_VARIABLES_REGISTRATION = singletonEntity({
  entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  createCache: createWorkspaceVariablesCache,
  postStateKey: 'workspaceVariablesPostState',
  projectPostState: projectWorkspaceVariablesPostState,
  projectSingleton: projectWorkspaceVariablesSingleton,
  setPaths: [WORKSPACE_VARIABLES_PATH],
});

export const VAULT_REGISTRATION = singletonEntity({
  entityType: VAULT_ENTITY_TYPE,
  createCache: createVaultCache,
  postStateKey: 'vaultPostState',
  projectPostState: projectVaultPostState,
  projectSingleton: projectVaultSingleton,
  setPaths: [VAULT_PATH],
});

export const REQUEST_REGISTRATION = flatEntity({
  entityType: REQUEST_ENTITY_TYPE,
  createCache: createRequestCache,
  postStateKey: 'requestPostState',
  projectPostState: projectRequestPostState,
  projectByUid: projectRequestByUid,
  setPaths: [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH],
});

export const REQUEST_COLLECTION_REGISTRATION = flatEntity({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  createCache: createRequestCollectionCache,
  postStateKey: 'requestCollectionPostState',
  projectPostState: projectRequestCollectionPostState,
  projectByUid: projectRequestCollectionByUid,
  setPaths: [REQUEST_COLLECTION_VARS_PATH],
});

export const REQUEST_FOLDER_REGISTRATION = flatEntity({
  entityType: REQUEST_FOLDER_ENTITY_TYPE,
  createCache: createRequestFolderCache,
  postStateKey: 'requestFolderPostState',
  projectPostState: projectRequestFolderPostState,
  projectByUid: projectRequestFolderByUid,
});

export const TEMPLATE_REGISTRATION = flatEntity({
  entityType: TEMPLATE_ENTITY_TYPE,
  createCache: createTemplateCache,
  postStateKey: 'templatePostState',
  projectPostState: projectTemplatePostState,
  projectByUid: projectTemplateByUid,
  setPaths: [TEMPLATE_CONDITIONS_PATH],
});

export const TEMPLATE_COLLECTION_REGISTRATION = flatEntity({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  createCache: createTemplateCollectionCache,
  postStateKey: 'templateCollectionPostState',
  projectPostState: projectTemplateCollectionPostState,
  projectByUid: projectTemplateCollectionByUid,
  setPaths: [TEMPLATE_COLLECTION_VARS_PATH],
});

export const TEMPLATE_FOLDER_REGISTRATION = flatEntity({
  entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
  createCache: createTemplateFolderCache,
  postStateKey: 'templateFolderPostState',
  projectPostState: projectTemplateFolderPostState,
  projectByUid: projectTemplateFolderByUid,
});

export const LIVE_VARIABLE_REGISTRATION = flatEntity({
  entityType: LIVE_VARIABLE_ENTITY_TYPE,
  createCache: createLiveVariableCache,
  postStateKey: 'liveVariablePostState',
  projectPostState: projectLiveVariablePostState,
  projectByUid: projectLiveVariableByUid,
});

export const LIVE_WORKFLOW_REGISTRATION = flatEntity({
  entityType: LIVE_WORKFLOW_ENTITY_TYPE,
  createCache: createLiveWorkflowCache,
  postStateKey: 'liveWorkflowPostState',
  projectPostState: projectLiveWorkflowPostState,
  projectByUid: projectLiveWorkflowByUid,
});

export const LIVE_VALUE_REGISTRATION = singletonEntity({
  entityType: LIVE_VALUE_ENTITY_TYPE,
  createCache: createLiveValueCache,
  postStateKey: 'liveValuePostState',
  projectPostState: projectLiveValuePostState,
  projectSingleton: projectLiveValueSingleton,
  setPaths: [LIVE_VALUE_VALUES_PATH],
});

export const LIVE_FALLBACK_PRIORITY_REGISTRATION = singletonEntity({
  entityType: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  createCache: createLiveFallbackPriorityCache,
  postStateKey: 'liveFallbackPriorityPostState',
  projectPostState: projectLiveFallbackPriorityPostState,
  projectSingleton: projectLiveFallbackPrioritySingleton,
  setPaths: [LIVE_FALLBACK_PRIORITY_MEMBERS_PATH],
});

export const OAUTH_BUNDLE_REGISTRATION = singletonEntity({
  entityType: OAUTH_BUNDLE_ENTITY_TYPE,
  createCache: createOAuthBundleCache,
  postStateKey: 'oauthBundlePostState',
  projectPostState: projectOAuthBundlePostState,
  projectSingleton: projectOAuthBundleSingleton,
  setPaths: [OAUTH_TOKENS_PATH, OAUTH_CONFIGS_PATH, OAUTH_REFRESH_ERRORS_PATH],
});

export const PAUSE_MARKERS_REGISTRATION = singletonEntity({
  entityType: PAUSE_MARKERS_ENTITY_TYPE,
  createCache: createPauseMarkersCache,
  postStateKey: 'pauseMarkersPostState',
  projectPostState: projectPauseMarkersPostState,
  projectSingleton: projectPauseMarkersSingleton,
  setPaths: [PAUSE_MARKERS_PATH],
});

export const LAYOUT_STATE_REGISTRATION = singletonEntity({
  entityType: LAYOUT_STATE_ENTITY_TYPE,
  createCache: createLayoutStateCache,
  postStateKey: 'layoutStatePostState',
  projectPostState: projectLayoutStatePostState,
  projectSingleton: projectLayoutStateSingleton,
});

export const FILES_REGISTRATION = singletonEntity({
  entityType: FILES_ENTITY_TYPE,
  createCache: createFilesCache,
  postStateKey: 'filesPostState',
  projectPostState: projectFilesPostState,
  projectSingleton: projectFilesSingleton,
  setPaths: [FILES_REFS_PATH],
});

export const EXTENSION_WORKSPACE_REGISTRATION = singletonEntity({
  entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
  createCache: createExtensionWorkspaceCache,
  postStateKey: 'extensionWorkspacePostState',
  projectPostState: projectExtensionWorkspacePostState,
  projectSingleton: projectExtensionWorkspaceSingleton,
  setPaths: [EXTENSION_WORKSPACES_SET_PATH],
});

/**
 * Per-workspace registry. The host (`service.ts`) iterates this on
 * init / dispose / projector-build / test-init. The scope of "per
 * workspace" is captured by the host service's lifecycle, not by any
 * field on the registration — adding a new per-workspace entity is a
 * single push here.
 */
export const WORKSPACE_REGISTRY: EntityRegistration[] = [
  RULE_REGISTRATION,
  ENVIRONMENT_REGISTRATION,
  COLLECTION_REGISTRATION,
  FOLDER_REGISTRATION,
  WORKSPACE_VARIABLES_REGISTRATION,
  VAULT_REGISTRATION,
  REQUEST_REGISTRATION,
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  TEMPLATE_REGISTRATION,
  TEMPLATE_COLLECTION_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  LIVE_VARIABLE_REGISTRATION,
  LIVE_WORKFLOW_REGISTRATION,
  LIVE_VALUE_REGISTRATION,
  LIVE_FALLBACK_PRIORITY_REGISTRATION,
  OAUTH_BUNDLE_REGISTRATION,
  PAUSE_MARKERS_REGISTRATION,
  LAYOUT_STATE_REGISTRATION,
  FILES_REGISTRATION,
];

/** Cross-workspace metadata registry, hosted by `global-service.ts`. */
export const GLOBAL_REGISTRY: EntityRegistration[] = [EXTENSION_WORKSPACE_REGISTRATION];

/**
 * Compose the schema-aware materializer registry for an oracle scope.
 * The oracle hands this to `InMemoryDocumentStore`; `materializeEntity`
 * looks up each entity's `EntitySchema` here to canonicalize empty
 * set-modeled paths to `[]`. Registrations without `setPaths` are
 * skipped — the legacy "untouched paths are absent" behaviour is
 * the right fit for entities with zero set-modeled fields.
 */
export function buildSchemaRegistry(registry: EntityRegistration[]): EntitySchemaRegistry {
  const out = new Map<string, EntitySchema>();
  for (const reg of registry) {
    if (reg.setPaths !== undefined) {
      out.set(reg.entityType, { setPaths: reg.setPaths });
    }
  }
  return out;
}

// ── Lifecycle helpers (scope-agnostic) ──────────────────────────────

/**
 * Construct one cache per registration. Returns the caches in registry
 * order so callers can dispose them later via {@link disposeCaches}.
 *
 * The cache is owned by the host service (per-workspace
 * {@link WorkspaceServiceState.caches} or the global service's
 * `state.caches`); SW-internal consumers locate the runtime-Active
 * workspace's cache via `getActiveCacheForRegistration` (in `service.ts`).
 */
export function buildCaches(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  context: SwContextHandle,
  registry: EntityRegistration[],
): EntityCacheLike[] {
  return registry.map((reg) => reg.createCache(workspaceId, oracle, broadcast, () => context.next()));
}

/**
 * Dispose every cache. Order doesn't matter — caches don't depend on
 * each other; they only read from the oracle (which outlives this call).
 */
export function disposeCaches(caches: EntityCacheLike[]): void {
  for (const cache of caches) cache.dispose();
}

/**
 * Compose a single broadcast projector over every registration. Each
 * per-entity projector wraps `reg.projectPostState` and tags the
 * output with `reg.postStateKey` so `wireBroadcastToSink` can
 * shallow-merge the result onto the wire event.
 */
export function buildProjectorPipeline(oracle: EntityOracle, registry: EntityRegistration[]): BroadcastProjector {
  return composeProjectors(...registry.map((reg) => makeKeyedProjector(oracle, reg)));
}

function makeKeyedProjector(oracle: EntityOracle, reg: EntityRegistration): BroadcastProjector {
  const { postStateKey, projectPostState } = reg;
  return (envelope) => {
    const value = projectPostState(oracle, envelope);
    if (!value) return null;
    return { [postStateKey]: value } as EntityPostState;
  };
}

// ── Snapshot helpers ────────────────────────────────────────────────

/**
 * Snapshot every materialized entity of a flat registration's type.
 * Folder-style registrations whose `projectByUid` returns null for
 * unresolvable parent linkage skip those rows — the next broadcast
 * republishes them once linkage resolves.
 */
export function flatSnapshot<K extends PostStateKey>(
  oracle: EntityOracle,
  reg: FlatRegistration<K>,
): ProjectionOf<K>[] {
  const out: ProjectionOf<K>[] = [];
  for (const m of oracle.materializeAll()) {
    if (m.type !== reg.entityType) continue;
    const projection = reg.projectByUid(oracle, m.id);
    if (projection) out.push(projection);
  }
  return out;
}

/** Snapshot a singleton registration; returns `[]` until first commit. */
export function singletonSnapshot<K extends PostStateKey>(
  oracle: EntityOracle,
  reg: SingletonRegistration<K>,
): ProjectionOf<K>[] {
  const projection = reg.projectSingleton(oracle);
  return projection ? [projection] : [];
}
