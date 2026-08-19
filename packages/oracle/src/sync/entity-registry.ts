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

import {
  AuthConfigSchema,
  CollectionSchema,
  EnvironmentSchema,
  GrpcRequestSchema,
  GrpcResponseExampleSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  RequestSchema,
  ResponseExampleSchema,
  RuleSchema,
  SchemaVersionSchema,
  ScriptPackageSchema,
  SpecSchema,
  schemaParseError,
  TemplateSchema,
  WebSocketRequestSchema,
  WsResponseExampleSchema,
} from '@openheaders/core/schemas';
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
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_METADATA_PATH,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
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
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  SCRIPT_PACKAGE_ENTITY_TYPE,
  SPEC_ENTITY_TYPE,
  SPEC_FILES_PATH,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  VAULT_PATH,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_PATH,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import * as v from 'valibot';
import { type BroadcastProjector, composeProjectors, type EntityPostState } from './bridge';
import type { InMemoryBroadcast } from './broadcast';
import { createCollectionCache } from './caches/collection-cache';
import { createEnvironmentCache } from './caches/environment-cache';
import { createExtensionWorkspaceCache } from './caches/extension-workspace-cache';
import { createFilesCache } from './caches/files-cache';
import { createFolderCache } from './caches/folder-cache';
import { createGrpcRequestCache } from './caches/grpc-request-cache';
import { createGrpcResponseExampleCache } from './caches/grpc-response-example-cache';
import { createLayoutStateCache } from './caches/layout-state-cache';
import { createLiveFallbackPriorityCache } from './caches/live-fallback-priority-cache';
import { createLiveValueCache } from './caches/live-value-cache';
import { createLiveVariableCache } from './caches/live-variable-cache';
import { createLiveWorkflowCache } from './caches/live-workflow-cache';
import { createOAuthBundleCache } from './caches/oauth-bundle-cache';
import { createPauseMarkersCache } from './caches/pause-markers-cache';
import { createRequestCache } from './caches/request-cache';
import { createRequestCollectionCache } from './caches/request-collection-cache';
import { createRequestFolderCache } from './caches/request-folder-cache';
import { createResponseExampleCache } from './caches/response-example-cache';
import { createRuleCache } from './caches/rule-cache';
import { createScriptPackageCache } from './caches/script-package-cache';
import { createSpecCache } from './caches/spec-cache';
import { createTemplateCache } from './caches/template-cache';
import { createTemplateCollectionCache } from './caches/template-collection-cache';
import { createTemplateFolderCache } from './caches/template-folder-cache';
import { createVaultCache } from './caches/vault-cache';
import { createWebSocketRequestCache } from './caches/websocket-request-cache';
import { createWorkspaceVariablesCache } from './caches/workspace-variables-cache';
import { createWsResponseExampleCache } from './caches/ws-response-example-cache';
import type { EntityOracle } from './oracle';
import { projectCollectionByUid, projectCollectionPostState } from './post-state/collection-post-state';
import { projectEnvironmentByUid, projectEnvironmentPostState } from './post-state/env-post-state';
import {
  projectExtensionWorkspacePostState,
  projectExtensionWorkspaceSingleton,
} from './post-state/extension-workspace-post-state';
import { projectFilesPostState, projectFilesSingleton } from './post-state/files-post-state';
import { projectFolderByUid, projectFolderPostState } from './post-state/folder-post-state';
import { projectGrpcRequestByUid, projectGrpcRequestPostState } from './post-state/grpc-request-post-state';
import {
  projectGrpcResponseExampleByUid,
  projectGrpcResponseExamplePostState,
} from './post-state/grpc-response-example-post-state';
import { projectLayoutStatePostState, projectLayoutStateSingleton } from './post-state/layout-state-post-state';
import {
  projectLiveFallbackPriorityPostState,
  projectLiveFallbackPrioritySingleton,
} from './post-state/live-fallback-priority-post-state';
import { projectLiveValuePostState, projectLiveValueSingleton } from './post-state/live-value-post-state';
import { projectLiveVariableByUid, projectLiveVariablePostState } from './post-state/live-variable-post-state';
import { projectLiveWorkflowByUid, projectLiveWorkflowPostState } from './post-state/live-workflow-post-state';
import { projectOAuthBundlePostState, projectOAuthBundleSingleton } from './post-state/oauth-bundle-post-state';
import { projectPauseMarkersPostState, projectPauseMarkersSingleton } from './post-state/pause-markers-post-state';
import {
  projectRequestCollectionByUid,
  projectRequestCollectionPostState,
} from './post-state/request-collection-post-state';
import { projectRequestFolderByUid, projectRequestFolderPostState } from './post-state/request-folder-post-state';
import { projectRequestByUid, projectRequestPostState } from './post-state/request-post-state';
import { projectResponseExampleByUid, projectResponseExamplePostState } from './post-state/response-example-post-state';
import { projectRuleByUid, projectRulePostState } from './post-state/rule-post-state';
import { projectScriptPackageByUid, projectScriptPackagePostState } from './post-state/script-package-post-state';
import { projectSpecByUid, projectSpecPostState } from './post-state/spec-post-state';
import {
  projectTemplateCollectionByUid,
  projectTemplateCollectionPostState,
} from './post-state/template-collection-post-state';
import { projectTemplateFolderByUid, projectTemplateFolderPostState } from './post-state/template-folder-post-state';
import { projectTemplateByUid, projectTemplatePostState } from './post-state/template-post-state';
import { projectVaultPostState, projectVaultSingleton } from './post-state/vault-post-state';
import {
  projectWebSocketRequestByUid,
  projectWebSocketRequestPostState,
} from './post-state/websocket-request-post-state';
import {
  projectWorkspaceVariablesPostState,
  projectWorkspaceVariablesSingleton,
} from './post-state/workspace-variables-post-state';
import {
  projectWsResponseExampleByUid,
  projectWsResponseExamplePostState,
} from './post-state/ws-response-example-post-state';
import type { SwContextHandle } from './sw-context';

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

/** Valibot schema shape accepted by the local-write gate. */
export type LocalWriteSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

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
  /**
   * Canonical schema for this entity's MATERIALIZED shape
   * (`MaterializedEntity.data`). Consulted by the oracle's local-write
   * gate ({@link OracleConfig.validateLocalWrite}) after each local
   * batch applies: a post-state that fails the schema rolls the batch
   * back with `schema-rejected` and a path-bearing detail, so a
   * caller-shaped seed (`createLocalRequest` and siblings forward
   * their payloads verbatim) can never persist an out-of-shape entity.
   *
   * `null` = consciously ungated. Singletons stay null because they
   * are observable without a create (`observableWithoutCreate`), so a
   * partial materialization mid-convergence — e.g. a vault secret
   * re-entered over an undecryptable baseline before any create — is
   * a legal state the canonical schema would false-reject. Required
   * (not optional) so every new registration makes the gating
   * decision explicitly.
   */
  localWriteSchema: LocalWriteSchema | null;
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
  localWriteSchema: LocalWriteSchema | null;
}): FlatRegistration<K> {
  return {
    kind: 'flat',
    entityType: spec.entityType,
    createCache: spec.createCache as CacheFactory,
    postStateKey: spec.postStateKey,
    projectPostState: spec.projectPostState,
    projectByUid: spec.projectByUid,
    setPaths: spec.setPaths,
    localWriteSchema: spec.localWriteSchema,
  };
}

function singletonEntity<K extends PostStateKey, C extends EntityCacheLike>(spec: {
  entityType: string;
  createCache: CacheFactory<C>;
  postStateKey: K;
  projectPostState: PostStateProjector<K>;
  projectSingleton: SingletonProjector<K>;
  setPaths?: SetPathsResolver;
  localWriteSchema: LocalWriteSchema | null;
}): SingletonRegistration<K> {
  return {
    kind: 'singleton',
    entityType: spec.entityType,
    createCache: spec.createCache as CacheFactory,
    postStateKey: spec.postStateKey,
    projectPostState: spec.projectPostState,
    projectSingleton: spec.projectSingleton,
    setPaths: spec.setPaths,
    localWriteSchema: spec.localWriteSchema,
  };
}

// ── Per-entity registrations ────────────────────────────────────────

// Folder entities materialize a scalar shell, not the canonical
// `Folder`: `path` is reconstructed at projection time by walking the
// parent chain, and `uid` rides `MaterializedEntity.id`. The
// local-write gate therefore validates the shell shape the seed
// builders commit (`seedFolder` / `seedRequestFolder` /
// `seedTemplateFolder`), mirroring their payloads verbatim.
const FolderShellSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  name: v.string(),
  pathSegment: v.pipe(v.string(), v.minLength(1)),
});

// Request-folder shells additionally carry the ancestor script slots
// and default auth (field absent ↔ no script / transparent level).
const RequestFolderShellSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  name: v.string(),
  pathSegment: v.pipe(v.string(), v.minLength(1)),
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
  auth: v.optional(AuthConfigSchema),
});

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
  localWriteSchema: RuleSchema,
});

export const ENVIRONMENT_REGISTRATION = flatEntity({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  createCache: createEnvironmentCache,
  postStateKey: 'environmentPostState',
  projectPostState: projectEnvironmentPostState,
  projectByUid: projectEnvironmentByUid,
  setPaths: [ENV_VARS_PATH],
  localWriteSchema: EnvironmentSchema,
});

export const COLLECTION_REGISTRATION = flatEntity({
  entityType: COLLECTION_ENTITY_TYPE,
  createCache: createCollectionCache,
  postStateKey: 'collectionPostState',
  projectPostState: projectCollectionPostState,
  projectByUid: projectCollectionByUid,
  setPaths: [COLLECTION_VARS_PATH],
  localWriteSchema: CollectionSchema,
});

export const FOLDER_REGISTRATION = flatEntity({
  entityType: FOLDER_ENTITY_TYPE,
  createCache: createFolderCache,
  postStateKey: 'folderPostState',
  projectPostState: projectFolderPostState,
  projectByUid: projectFolderByUid,
  localWriteSchema: FolderShellSchema,
});

export const WORKSPACE_VARIABLES_REGISTRATION = singletonEntity({
  entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  createCache: createWorkspaceVariablesCache,
  postStateKey: 'workspaceVariablesPostState',
  projectPostState: projectWorkspaceVariablesPostState,
  projectSingleton: projectWorkspaceVariablesSingleton,
  setPaths: [WORKSPACE_VARIABLES_PATH],
  localWriteSchema: null,
});

export const VAULT_REGISTRATION = singletonEntity({
  entityType: VAULT_ENTITY_TYPE,
  createCache: createVaultCache,
  postStateKey: 'vaultPostState',
  projectPostState: projectVaultPostState,
  projectSingleton: projectVaultSingleton,
  setPaths: [VAULT_PATH],
  localWriteSchema: null,
});

export const REQUEST_REGISTRATION = flatEntity({
  entityType: REQUEST_ENTITY_TYPE,
  createCache: createRequestCache,
  postStateKey: 'requestPostState',
  projectPostState: projectRequestPostState,
  projectByUid: projectRequestByUid,
  setPaths: [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH],
  localWriteSchema: RequestSchema,
});

export const GRPC_REQUEST_REGISTRATION = flatEntity({
  entityType: GRPC_REQUEST_ENTITY_TYPE,
  createCache: createGrpcRequestCache,
  postStateKey: 'grpcRequestPostState',
  projectPostState: projectGrpcRequestPostState,
  projectByUid: projectGrpcRequestByUid,
  setPaths: [GRPC_REQUEST_METADATA_PATH],
  localWriteSchema: GrpcRequestSchema,
});

export const WEBSOCKET_REQUEST_REGISTRATION = flatEntity({
  entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
  createCache: createWebSocketRequestCache,
  postStateKey: 'websocketRequestPostState',
  projectPostState: projectWebSocketRequestPostState,
  projectByUid: projectWebSocketRequestByUid,
  setPaths: [WEBSOCKET_REQUEST_HEADERS_PATH, WEBSOCKET_REQUEST_PARAMS_PATH, WEBSOCKET_REQUEST_EVENTS_PATH],
  localWriteSchema: WebSocketRequestSchema,
});

export const REQUEST_COLLECTION_REGISTRATION = flatEntity({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  createCache: createRequestCollectionCache,
  postStateKey: 'requestCollectionPostState',
  projectPostState: projectRequestCollectionPostState,
  projectByUid: projectRequestCollectionByUid,
  setPaths: [REQUEST_COLLECTION_VARS_PATH],
  localWriteSchema: CollectionSchema,
});

export const REQUEST_FOLDER_REGISTRATION = flatEntity({
  entityType: REQUEST_FOLDER_ENTITY_TYPE,
  createCache: createRequestFolderCache,
  postStateKey: 'requestFolderPostState',
  projectPostState: projectRequestFolderPostState,
  projectByUid: projectRequestFolderByUid,
  localWriteSchema: RequestFolderShellSchema,
});

export const TEMPLATE_REGISTRATION = flatEntity({
  entityType: TEMPLATE_ENTITY_TYPE,
  createCache: createTemplateCache,
  postStateKey: 'templatePostState',
  projectPostState: projectTemplatePostState,
  projectByUid: projectTemplateByUid,
  setPaths: [TEMPLATE_CONDITIONS_PATH],
  localWriteSchema: TemplateSchema,
});

export const TEMPLATE_COLLECTION_REGISTRATION = flatEntity({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  createCache: createTemplateCollectionCache,
  postStateKey: 'templateCollectionPostState',
  projectPostState: projectTemplateCollectionPostState,
  projectByUid: projectTemplateCollectionByUid,
  setPaths: [TEMPLATE_COLLECTION_VARS_PATH],
  localWriteSchema: CollectionSchema,
});

export const TEMPLATE_FOLDER_REGISTRATION = flatEntity({
  entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
  createCache: createTemplateFolderCache,
  postStateKey: 'templateFolderPostState',
  projectPostState: projectTemplateFolderPostState,
  projectByUid: projectTemplateFolderByUid,
  localWriteSchema: FolderShellSchema,
});

export const LIVE_VARIABLE_REGISTRATION = flatEntity({
  entityType: LIVE_VARIABLE_ENTITY_TYPE,
  createCache: createLiveVariableCache,
  postStateKey: 'liveVariablePostState',
  projectPostState: projectLiveVariablePostState,
  projectByUid: projectLiveVariableByUid,
  localWriteSchema: LiveVariableSchema,
});

export const SCRIPT_PACKAGE_REGISTRATION = flatEntity({
  entityType: SCRIPT_PACKAGE_ENTITY_TYPE,
  createCache: createScriptPackageCache,
  postStateKey: 'scriptPackagePostState',
  projectPostState: projectScriptPackagePostState,
  projectByUid: projectScriptPackageByUid,
  localWriteSchema: ScriptPackageSchema,
});

export const SPEC_REGISTRATION = flatEntity({
  entityType: SPEC_ENTITY_TYPE,
  createCache: createSpecCache,
  postStateKey: 'specPostState',
  projectPostState: projectSpecPostState,
  projectByUid: projectSpecByUid,
  setPaths: [SPEC_FILES_PATH],
  localWriteSchema: SpecSchema,
});

export const GRPC_RESPONSE_EXAMPLE_REGISTRATION = flatEntity({
  entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  createCache: createGrpcResponseExampleCache,
  postStateKey: 'grpcResponseExamplePostState',
  projectPostState: projectGrpcResponseExamplePostState,
  projectByUid: projectGrpcResponseExampleByUid,
  localWriteSchema: GrpcResponseExampleSchema,
});

export const WS_RESPONSE_EXAMPLE_REGISTRATION = flatEntity({
  entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
  createCache: createWsResponseExampleCache,
  postStateKey: 'wsResponseExamplePostState',
  projectPostState: projectWsResponseExamplePostState,
  projectByUid: projectWsResponseExampleByUid,
  localWriteSchema: WsResponseExampleSchema,
});

export const RESPONSE_EXAMPLE_REGISTRATION = flatEntity({
  entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
  createCache: createResponseExampleCache,
  postStateKey: 'responseExamplePostState',
  projectPostState: projectResponseExamplePostState,
  projectByUid: projectResponseExampleByUid,
  localWriteSchema: ResponseExampleSchema,
});

export const LIVE_WORKFLOW_REGISTRATION = flatEntity({
  entityType: LIVE_WORKFLOW_ENTITY_TYPE,
  createCache: createLiveWorkflowCache,
  postStateKey: 'liveWorkflowPostState',
  projectPostState: projectLiveWorkflowPostState,
  projectByUid: projectLiveWorkflowByUid,
  localWriteSchema: LiveWorkflowSchema,
});

export const LIVE_VALUE_REGISTRATION = singletonEntity({
  entityType: LIVE_VALUE_ENTITY_TYPE,
  createCache: createLiveValueCache,
  postStateKey: 'liveValuePostState',
  projectPostState: projectLiveValuePostState,
  projectSingleton: projectLiveValueSingleton,
  setPaths: [LIVE_VALUE_VALUES_PATH],
  localWriteSchema: null,
});

export const LIVE_FALLBACK_PRIORITY_REGISTRATION = singletonEntity({
  entityType: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  createCache: createLiveFallbackPriorityCache,
  postStateKey: 'liveFallbackPriorityPostState',
  projectPostState: projectLiveFallbackPriorityPostState,
  projectSingleton: projectLiveFallbackPrioritySingleton,
  setPaths: [LIVE_FALLBACK_PRIORITY_MEMBERS_PATH],
  localWriteSchema: null,
});

export const OAUTH_BUNDLE_REGISTRATION = singletonEntity({
  entityType: OAUTH_BUNDLE_ENTITY_TYPE,
  createCache: createOAuthBundleCache,
  postStateKey: 'oauthBundlePostState',
  projectPostState: projectOAuthBundlePostState,
  projectSingleton: projectOAuthBundleSingleton,
  setPaths: [OAUTH_TOKENS_PATH, OAUTH_CONFIGS_PATH, OAUTH_REFRESH_ERRORS_PATH],
  localWriteSchema: null,
});

export const PAUSE_MARKERS_REGISTRATION = singletonEntity({
  entityType: PAUSE_MARKERS_ENTITY_TYPE,
  createCache: createPauseMarkersCache,
  postStateKey: 'pauseMarkersPostState',
  projectPostState: projectPauseMarkersPostState,
  projectSingleton: projectPauseMarkersSingleton,
  setPaths: [PAUSE_MARKERS_PATH],
  localWriteSchema: null,
});

export const LAYOUT_STATE_REGISTRATION = singletonEntity({
  entityType: LAYOUT_STATE_ENTITY_TYPE,
  createCache: createLayoutStateCache,
  postStateKey: 'layoutStatePostState',
  projectPostState: projectLayoutStatePostState,
  projectSingleton: projectLayoutStateSingleton,
  localWriteSchema: null,
});

export const FILES_REGISTRATION = singletonEntity({
  entityType: FILES_ENTITY_TYPE,
  createCache: createFilesCache,
  postStateKey: 'filesPostState',
  projectPostState: projectFilesPostState,
  projectSingleton: projectFilesSingleton,
  setPaths: [FILES_REFS_PATH],
  localWriteSchema: null,
});

export const EXTENSION_WORKSPACE_REGISTRATION = singletonEntity({
  entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
  createCache: createExtensionWorkspaceCache,
  postStateKey: 'extensionWorkspacePostState',
  projectPostState: projectExtensionWorkspacePostState,
  projectSingleton: projectExtensionWorkspaceSingleton,
  setPaths: [EXTENSION_WORKSPACES_SET_PATH],
  localWriteSchema: null,
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
  GRPC_REQUEST_REGISTRATION,
  WEBSOCKET_REQUEST_REGISTRATION,
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  RESPONSE_EXAMPLE_REGISTRATION,
  GRPC_RESPONSE_EXAMPLE_REGISTRATION,
  WS_RESPONSE_EXAMPLE_REGISTRATION,
  TEMPLATE_REGISTRATION,
  TEMPLATE_COLLECTION_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  LIVE_VARIABLE_REGISTRATION,
  LIVE_WORKFLOW_REGISTRATION,
  SCRIPT_PACKAGE_REGISTRATION,
  SPEC_REGISTRATION,
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
    // Singletons are observable without a create — their well-known
    // identity exists a priori, and mutations may legitimately precede
    // any create (e.g. a secret re-entered over an undecryptable vault
    // baseline). Flat entities stay create-gated.
    const observableWithoutCreate = reg.kind === 'singleton' || undefined;
    if (reg.setPaths !== undefined || observableWithoutCreate) {
      out.set(reg.entityType, {
        setPaths: reg.setPaths ?? [],
        ...(observableWithoutCreate ? { observableWithoutCreate } : {}),
      });
    }
  }
  return out;
}

/**
 * Compose the local-write schema gate for an oracle scope. The oracle
 * calls the returned validator on every touched entity's materialized
 * post-state after a LOCAL batch applies ({@link
 * OracleConfig.validateLocalWrite}); a path-bearing error string rolls
 * the batch back with `schema-rejected`. Registrations with
 * `localWriteSchema: null` (and unknown entity types) pass — the gate
 * is a per-kind opt-in declared at the registry, never a guess.
 */
export function buildLocalWriteValidator(
  registry: EntityRegistration[],
): (type: string, data: unknown) => string | null {
  const byType = new Map<string, LocalWriteSchema>();
  for (const reg of registry) {
    if (reg.localWriteSchema) byType.set(reg.entityType, reg.localWriteSchema);
  }
  return (type, data) => {
    const schema = byType.get(type);
    if (!schema) return null;
    return schemaParseError(schema, data);
  };
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
