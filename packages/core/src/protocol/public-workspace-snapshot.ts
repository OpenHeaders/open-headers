/**
 * Public workspace snapshot — the anonymous read plane's vocabulary
 * (the access-foundation plan §8 F5b, decision d: SNAPSHOT-FIRST).
 *
 * A workspace whose visibility is `public` can be published as a
 * captured PROJECTION served read-only at a stable anonymous URL
 * (`/public/<workspaceId>`); re-publish replaces it in place and
 * unpublish 404s it. This module owns the pieces both sides of that
 * URL share — the daemon's publish verb + HTTP route and the web
 * viewer that hydrates the payload:
 *
 *   - the path vocabulary (`/public/<id>` page, `…/snapshot.json` data),
 *   - the publication payload envelope (workspace meta + snapshot),
 *   - {@link buildPublicWorkspaceSnapshot} — the ratified content
 *     contract applied BY CONSTRUCTION, and
 *   - {@link summarizePublicWorkspaceSnapshot} — the review-moment
 *     summary the publish flow renders before the confirm, computed
 *     from the projection so what the publisher eyeballs is exactly
 *     what ships.
 *
 * The content contract (ratified at F5's gate — do not widen or
 * narrow casually):
 *
 *   - The projection is UNRESOLVED AUTHORING STATE — nothing is ever
 *     variable-resolved into it; `{{refs}}` ride verbatim as text.
 *   - The sensitive set is stripped (vault, oauthBundles, liveValues —
 *     {@link redactSensitiveSnapshotKeys}).
 *   - Secret-TYPED variable VALUES are stripped in every scope that
 *     carries variables (workspace, environment, collection — request
 *     and rule collections alike); NAMES are kept so the reference
 *     stays honest about what a consumer must supply.
 *   - Runtime state is dropped: pauseMarkers, layoutState,
 *     liveFallbackPriority.
 *   - File blob BYTES never enter — the `files` entity is
 *     metadata-only by shape, and no blob route exists on the plane.
 *
 * Everything else IS the integration reference and rides verbatim.
 */

import * as v from 'valibot';

import type { Variable } from '../types';
import { redactSensitiveSnapshotKeys, type WorkspaceSnapshot, WorkspaceSnapshotSchema } from './snapshot';
import type {
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncRequestCollectionPostState,
  SyncTemplateCollectionPostState,
  SyncWorkspaceVariablesPostState,
} from './sync-bridge';

/** Every anonymous public-plane path lives under this prefix. */
export const PUBLIC_WORKSPACE_PATH_PREFIX = '/public/';

const SNAPSHOT_FILE = 'snapshot.json';

/** The stable page URL a published workspace is viewed at. */
export function publicWorkspacePagePath(workspaceId: string): string {
  return `${PUBLIC_WORKSPACE_PATH_PREFIX}${encodeURIComponent(workspaceId)}`;
}

/** The payload URL the anonymous viewer hydrates from. */
export function publicWorkspaceSnapshotPath(workspaceId: string): string {
  return `${publicWorkspacePagePath(workspaceId)}/${SNAPSHOT_FILE}`;
}

export interface ParsedPublicWorkspacePath {
  workspaceId: string;
  /** `page` = the viewer document; `snapshot` = the JSON payload. */
  kind: 'page' | 'snapshot';
}

/**
 * Parse a request path under {@link PUBLIC_WORKSPACE_PATH_PREFIX}.
 * Returns null for paths outside the prefix AND for malformed ones
 * inside it (extra segments, empty id) — the route owner 404s those
 * rather than letting them fall through to another handler.
 */
export function parsePublicWorkspacePath(path: string): ParsedPublicWorkspacePath | null {
  if (!path.startsWith(PUBLIC_WORKSPACE_PATH_PREFIX)) return null;
  const rest = path.slice(PUBLIC_WORKSPACE_PATH_PREFIX.length);
  const segments = rest.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.length > 2) return null;
  let workspaceId: string;
  try {
    workspaceId = decodeURIComponent(segments[0]);
  } catch {
    return null;
  }
  if (workspaceId.length === 0) return null;
  if (segments.length === 1) return { workspaceId, kind: 'page' };
  return segments[1] === SNAPSHOT_FILE ? { workspaceId, kind: 'snapshot' } : null;
}

/** Current publication envelope schema version. Bumps on breaking shape changes. */
export const PUBLIC_WORKSPACE_PUBLICATION_SCHEMA_VERSION = 1;

/**
 * Workspace-record fields the anonymous viewer needs to present the
 * published copy (the snapshot itself carries only per-workspace
 * entities). Deliberately minimal — no org, no timestamps, no sync
 * bookkeeping.
 */
export interface PublicWorkspaceMeta {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

/** The stored + served publication payload — replaced whole on re-publish. */
export interface PublicWorkspacePublication {
  schemaVersion: number;
  publishedAt: string;
  workspace: PublicWorkspaceMeta;
  snapshot: WorkspaceSnapshot;
}

export const PublicWorkspaceMetaSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.string(),
  description: v.optional(v.string()),
  color: v.optional(v.string()),
  icon: v.optional(v.string()),
});

export const PublicWorkspacePublicationSchema = v.object({
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  publishedAt: v.string(),
  workspace: PublicWorkspaceMetaSchema,
  snapshot: WorkspaceSnapshotSchema,
});

function stripSecretVariableValues(variables: readonly Variable[]): { variables: Variable[]; stripped: number } {
  let stripped = 0;
  const out = variables.map((variable) => {
    if (variable.type !== 'secret' || variable.value === '') return variable;
    stripped += 1;
    return { ...variable, value: '' };
  });
  return { variables: out, stripped };
}

interface StripResult<T> {
  items: T[];
  stripped: number;
}

function stripCollectionVariables<T extends { collection: { variables: Variable[] } }>(
  items: readonly T[],
): StripResult<T> {
  let stripped = 0;
  const out = items.map((item) => {
    const result = stripSecretVariableValues(item.collection.variables);
    stripped += result.stripped;
    if (result.stripped === 0) return item;
    return { ...item, collection: { ...item.collection, variables: result.variables } };
  });
  return { items: out, stripped };
}

export interface PublicWorkspaceSnapshotBuildResult {
  snapshot: WorkspaceSnapshot;
  /** How many secret-typed variable values the projection blanked. */
  secretValuesStripped: number;
}

/**
 * Apply the ratified public content contract to a captured
 * {@link WorkspaceSnapshot}. Pure; the input is not mutated. The input
 * is the ordinary snapshot-builder output — unresolved authoring state
 * by construction, since the builder captures materialized entities
 * and never runs the variable resolver.
 */
export function buildPublicWorkspaceSnapshot(snapshot: WorkspaceSnapshot): PublicWorkspaceSnapshotBuildResult {
  const redacted = redactSensitiveSnapshotKeys(snapshot);
  let secretValuesStripped = 0;

  const workspaceVariables = (redacted.workspaceVariables as SyncWorkspaceVariablesPostState[]).map((state) => {
    const result = stripSecretVariableValues(state.workspaceVariables.variables);
    secretValuesStripped += result.stripped;
    if (result.stripped === 0) return state;
    return { ...state, workspaceVariables: { ...state.workspaceVariables, variables: result.variables } };
  });

  const environments = (redacted.environments as SyncEnvironmentPostState[]).map((state) => {
    const result = stripSecretVariableValues(state.environment.variables);
    secretValuesStripped += result.stripped;
    if (result.stripped === 0) return state;
    return { ...state, environment: { ...state.environment, variables: result.variables } };
  });

  const collections = stripCollectionVariables(redacted.collections as SyncCollectionPostState[]);
  const requestCollections = stripCollectionVariables(redacted.requestCollections as SyncRequestCollectionPostState[]);
  const templateCollections = stripCollectionVariables(
    redacted.templateCollections as SyncTemplateCollectionPostState[],
  );
  secretValuesStripped += collections.stripped + requestCollections.stripped + templateCollections.stripped;

  return {
    snapshot: {
      ...redacted,
      workspaceVariables,
      environments,
      collections: collections.items,
      requestCollections: requestCollections.items,
      templateCollections: templateCollections.items,
      // Runtime state never rides: run/pause posture, per-surface dock
      // layout, and the offline-fallback host ranking are all live
      // concerns of the publishing host, not the reference.
      pauseMarkers: [],
      layoutState: [],
      liveFallbackPriority: [],
    },
    secretValuesStripped,
  };
}

/** One variable row of the review summary — `secret` rows carry an empty value (name-only). */
export interface PublicSnapshotVariableRow {
  scope: 'workspace' | 'environment' | 'collection';
  /** The environment / collection name; null for workspace scope. */
  container: string | null;
  name: string;
  value: string;
  secret: boolean;
}

/**
 * The review-moment summary (decision d): variables listed name+value
 * for eyeballing, per-category entity counts, and the count of secret
 * values the contract stripped. Computed FROM the projection so the
 * summary can never disagree with the payload that ships.
 */
export interface PublicWorkspaceSnapshotSummary {
  variables: PublicSnapshotVariableRow[];
  /** Entity counts keyed by the snapshot's own array names; zero-count keys are omitted. */
  entityCounts: Record<string, number>;
  secretValuesStripped: number;
}

const SUMMARY_COUNT_KEYS = [
  'rules',
  'collections',
  'environments',
  'folders',
  'requests',
  'requestCollections',
  'requestFolders',
  'grpcRequests',
  'websocketRequests',
  'mqttRequests',
  'graphqlRequests',
  'responseExamples',
  'grpcResponseExamples',
  'wsResponseExamples',
  'mqttResponseExamples',
  'scriptPackages',
  'specs',
  'templates',
  'templateCollections',
  'templateFolders',
  'liveVariables',
  'liveWorkflows',
  'files',
] as const satisfies ReadonlyArray<keyof WorkspaceSnapshot>;

export function summarizePublicWorkspaceSnapshot(
  result: PublicWorkspaceSnapshotBuildResult,
): PublicWorkspaceSnapshotSummary {
  const { snapshot } = result;
  const variables: PublicSnapshotVariableRow[] = [];
  const pushRows = (scope: PublicSnapshotVariableRow['scope'], container: string | null, vars: readonly Variable[]) => {
    for (const variable of vars) {
      variables.push({
        scope,
        container,
        name: variable.name,
        value: variable.value,
        secret: variable.type === 'secret',
      });
    }
  };
  for (const state of snapshot.workspaceVariables as SyncWorkspaceVariablesPostState[]) {
    pushRows('workspace', null, state.workspaceVariables.variables);
  }
  for (const state of snapshot.environments as SyncEnvironmentPostState[]) {
    pushRows('environment', state.environment.name, state.environment.variables);
  }
  for (const state of snapshot.collections as SyncCollectionPostState[]) {
    pushRows('collection', state.collection.name, state.collection.variables);
  }
  for (const state of snapshot.requestCollections as SyncRequestCollectionPostState[]) {
    pushRows('collection', state.collection.name, state.collection.variables);
  }
  for (const state of snapshot.templateCollections as SyncTemplateCollectionPostState[]) {
    pushRows('collection', state.collection.name, state.collection.variables);
  }

  const entityCounts: Record<string, number> = {};
  for (const key of SUMMARY_COUNT_KEYS) {
    const count = snapshot[key].length;
    if (count > 0) entityCounts[key] = count;
  }
  return { variables, entityCounts, secretValuesStripped: result.secretValuesStripped };
}
