/**
 * Resolve a `WorkspaceExport` + `DiffResult` + per-entity strategy
 * picks into an `ImportPlan` the SW orchestrator can execute.
 *
 * Pure function — no storage reads, no platform deps. The orchestrator
 * (in the extension SW) consumes the plan and drives store calls. Same
 * shape as `parse.ts` / `diff.ts` — round-trip-friendly so tests can
 * pin a strategy map and assert the resulting writes.
 *
 * What this layer does:
 *   - Apply per-entity strategy (`new-uid` / `update` / `skip` /
 *     `merge-by-name` / `replace` / `merge-vars` / `merge-children`)
 *   - Force `Rule.enabled = false`, `LiveWorkflow.enabled = false`,
 *     `LiveVariable.enabled = false` (design §2.2 + §5.5; the
 *     "trust this export" override is `trustExport: true`)
 *   - Regenerate uids + paths via `deepCopyHierarchy` for `new-uid`
 *     entries that share a tree (collections + folders + entities)
 *   - Track the uid remap so back-pointers can rebind:
 *     `Rule.collectionId` / `Rule.folderId`,
 *     `WorkflowStep.requestUid`, `LiveVariable.workflowUid`
 *
 * What's deliberately NOT here (lands later):
 *   - Transitive-dep expansion (PR 5 — export-side toggle, not importer)
 *   - Quota pre-check (PR 2C orchestrator concern)
 *   - DNR rebuild (PR 2C — `scheduleUpdate('import', { immediate: true })`)
 *   - Soft-dedup banner state (PR 2C — UI-side, ImportReport history)
 *   - Workspace metadata behavior on `target=existing` (caller-side —
 *     the orchestrator decides whether to copy `defaultEnvironmentId`,
 *     name suffix, etc.; this layer just hands it the resolved
 *     entities)
 */

import type {
  Collection,
  Environment,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Template,
  Variable,
  Vault,
  VaultSecret,
  WorkspaceVariables,
} from '../types/index';
import { generateUid, toFolderName } from '../utils/workspace';
import { deepCopyHierarchy, type LocalFolder } from './deep-copy-hierarchy';
import type { CollisionStrategy, DiffEntry, DiffResult, DiffSingleton, TargetWorkspaceState } from './diff';
import type { WorkspaceExport } from './schema';

// ── Plan shape ──────────────────────────────────────────────────────

/**
 * Per-entity action a SW write step takes. `update` overwrites the
 * targetUid. `create` writes a fresh entity (no prior target).
 * `skip` keeps the entity out of the plan; the SW does nothing.
 */
export type PlanAction = 'create' | 'update' | 'skip';

export interface PlanEntry<T> {
  action: PlanAction;
  entity: T;
  /** Target-side uid this write overwrites (only when `action === 'update'`). */
  targetUid?: string;
}

export type PlanSingletonAction = 'merge-by-name' | 'replace' | 'skip';

export interface PlanWorkspaceVariables {
  action: PlanSingletonAction;
  /** Final variable list to persist (already merged for `merge-by-name`). */
  variables: Variable[];
}

export interface PlanVault {
  action: PlanSingletonAction;
  /** Final secret list to persist (already merged for `merge-by-name`). */
  secrets: VaultSecret[];
}

export interface ImportPlan {
  collections: PlanEntry<Collection>[];
  folders: PlanEntry<LocalFolder>[];
  rules: PlanEntry<Rule>[];
  requests: PlanEntry<Request>[];
  templates: PlanEntry<Template>[];
  environments: PlanEntry<Environment>[];
  liveWorkflows: PlanEntry<LiveWorkflow>[];
  liveVariables: PlanEntry<LiveVariable>[];
  workspaceVars: PlanWorkspaceVariables;
  vault: PlanVault;
  /**
   * Flat old-uid → new-uid map across every `new-uid` write. Exposed so
   * the orchestrator can rebind cross-entity references that this
   * layer didn't already remap.
   */
  uidRemap: Record<string, string>;
}

// ── Strategy override map ───────────────────────────────────────────

/**
 * User-chosen strategies, keyed by the incoming entity's uid. When an
 * entity has no entry, the diff's default strategy is used.
 */
export interface StrategyMap {
  collections?: Record<string, CollisionStrategy>;
  folders?: Record<string, CollisionStrategy>;
  rules?: Record<string, CollisionStrategy>;
  requests?: Record<string, CollisionStrategy>;
  templates?: Record<string, CollisionStrategy>;
  environments?: Record<string, CollisionStrategy>;
  liveWorkflows?: Record<string, CollisionStrategy>;
  liveVariables?: Record<string, CollisionStrategy>;
  workspaceVars?: PlanSingletonAction;
  vault?: PlanSingletonAction;
}

export interface ImporterOptions {
  /**
   * Trust the export's enabled flags. When `false` (default), every
   * imported Rule / LiveWorkflow / LiveVariable lands disabled. When
   * `true`, source-state passes through.
   */
  trustExport?: boolean;
  /**
   * Strip request scripts on import (design §5.5). Replaces every
   * incoming `Request.preRequestScript` / `postResponseScript` with
   * `undefined`. Surfaced as an Advanced toggle in the import preview.
   */
  stripScripts?: boolean;
  /**
   * Omit OAuth configs on import (design §5.5). Default is to keep the
   * OAuth2 config (token endpoint, client id, scopes — `clientSecret`
   * is always stripped on export). When `true`, every incoming
   * oauth2 `Request.auth` is replaced with `{ type: 'none' }` so the
   * recipient configures auth from scratch.
   */
  omitOAuthConfigs?: boolean;
  /**
   * Preserve the target collection's `order` field on update collisions
   * (design §5.5). Default is `false` — `update` takes the export's
   * order. When `true`, collections that update an existing target
   * keep the recipient's existing child order.
   */
  keepTargetCollectionOrder?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function chosenStrategy<T extends { entity: { uid: string } }>(
  entry: DiffEntry<T['entity']>,
  overrides: Record<string, CollisionStrategy> | undefined,
): CollisionStrategy {
  return overrides?.[entry.entity.uid] ?? entry.defaultStrategy;
}

function mergeVariablesByName(target: Variable[], incoming: Variable[]): Variable[] {
  const byName = new Map<string, Variable>();
  for (const v of target) byName.set(v.name, v);
  for (const v of incoming) byName.set(v.name, v); // incoming wins
  return Array.from(byName.values());
}

function mergeSecretsByName(target: VaultSecret[], incoming: VaultSecret[]): VaultSecret[] {
  const byName = new Map<string, VaultSecret>();
  for (const s of target) byName.set(s.name, s);
  for (const s of incoming) byName.set(s.name, s); // incoming wins
  return Array.from(byName.values());
}

function forceDisabled<T extends { enabled?: boolean }>(entity: T, trust: boolean): T {
  if (trust) return entity;
  return { ...entity, enabled: false };
}

/**
 * Strip pre-request / post-response script source. Returns the request
 * verbatim when `strip` is false. The fields are removed entirely
 * rather than blanked, so the importer's downstream "scripts present"
 * surface matches the rule "field absent ↔ no script."
 */
function stripRequestScripts<T extends { preRequestScript?: string; postResponseScript?: string }>(
  entity: T,
  strip: boolean,
): T {
  if (!strip) return entity;
  if (entity.preRequestScript === undefined && entity.postResponseScript === undefined) return entity;
  const next = { ...entity };
  delete next.preRequestScript;
  delete next.postResponseScript;
  return next;
}

/**
 * Replace OAuth2 `Request.auth` with `{ type: 'none' }` when the user
 * opts out of importing OAuth configs. The recipient configures auth
 * from scratch; the request's URL / method / headers / body still ship.
 */
function omitOAuthAuth<T extends { auth?: { type: string } }>(entity: T, omit: boolean): T {
  if (!omit) return entity;
  if (entity.auth?.type !== 'oauth2') return entity;
  return { ...entity, auth: { type: 'none' } as T['auth'] };
}

// ── Tree-aware new-uid for collections + folders + leaves ───────────

interface TreeSlice<E extends { uid: string; path: string; name: string }> {
  prefix: string;
  collections: Collection[];
  folders: LocalFolder[];
  entities: E[];
}

/**
 * Group leaves by their tree-prefix segment (`rules` / `requests` /
 * `templates`). Path always starts with the tree segment when the YAML
 * serializer carried it (PR 1B — see `yaml.ts` header). Falls back to
 * the explicit prefix for entities whose path doesn't conform.
 */
function _sliceByTree<E extends { uid: string; path: string; name: string }>(
  entities: E[],
  collections: Collection[],
  folders: LocalFolder[],
  prefix: 'rules' | 'requests' | 'templates',
): TreeSlice<E> {
  return {
    prefix,
    collections: collections.filter((c) => c.path.startsWith(`${prefix}/`) || !c.path.includes('/')),
    folders: folders.filter((f) => f.path.startsWith(`${prefix}/`)),
    entities: entities.filter((e) => e.path.startsWith(`${prefix}/`)),
  };
}

// ── Per-entity-array resolver ──────────────────────────────────────

interface ResolveArrayOpts<T extends { uid: string; name: string; path?: string }> {
  diff: DiffEntry<T>[];
  overrides?: Record<string, CollisionStrategy>;
  /** Pre-stamp on `update` / `create` (eg. force-disable a rule). */
  stamp?: (entity: T) => T;
}

interface ResolveArrayResult<T> {
  entries: PlanEntry<T>[];
  /** uids that were chosen for `new-uid` (need tree-prefix rewriting). */
  newUidUids: Set<string>;
}

function resolveArrayBase<T extends { uid: string; name: string; path?: string }>(
  opts: ResolveArrayOpts<T>,
): ResolveArrayResult<T> {
  const stamp = opts.stamp ?? ((e: T) => e);
  const newUidUids = new Set<string>();
  const entries: PlanEntry<T>[] = opts.diff.map((entry) => {
    const strat = chosenStrategy<{ entity: T }>(entry, opts.overrides);
    if (strat === 'skip') {
      return { action: 'skip', entity: entry.entity };
    }
    if (strat === 'update' && entry.matchedTarget) {
      // Version handling on `update`: bump past max(target, incoming).
      // Without this the target's local edit history would silently
      // regress to the snapshot version that shipped in the export
      // (see V5_WORKSPACE_EXPORT_DESIGN.md §2.1 / `version` semantics).
      const bumped = bumpVersion(entry.entity, entry.matchedTarget);
      return {
        action: 'update',
        targetUid: entry.matchedTarget.uid,
        // On update we keep the target's uid (and target's path),
        // overwriting the entity's *content* with the incoming one's.
        entity: stamp({ ...bumped, uid: entry.matchedTarget.uid }),
      };
    }
    // new-uid (default), or a fallback when update was selected but no
    // matchedTarget exists (shouldn't happen, but defensive). A fresh
    // entity instance starts at version 1 — the export's version was
    // a snapshot of the source's history and doesn't apply here.
    newUidUids.add(entry.entity.uid);
    return { action: 'create', entity: stamp(resetVersion(entry.entity)) };
  });
  return { entries, newUidUids };
}

/**
 * Set `version: 1` on an entity that's about to be created fresh
 * (`new-uid` strategy). Preserves the input shape; only entities that
 * carry a `version` number get touched.
 */
function resetVersion<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const e = entity as T & { version?: number };
  if (typeof e.version !== 'number') return entity;
  return { ...e, version: 1 };
}

/**
 * Compute the next `version` for an `update` collision: one past the
 * higher of (target's current version, incoming's snapshot version).
 * Preserves target's local edit history while letting subscribers /
 * snapshot diffs see "this entity changed on import".
 */
function bumpVersion<T>(incoming: T, target: T): T {
  if (!incoming || typeof incoming !== 'object') return incoming;
  const inc = incoming as T & { version?: number };
  const tgt = target as T & { version?: number };
  const incomingV = typeof inc.version === 'number' ? inc.version : 0;
  const targetV = typeof tgt.version === 'number' ? tgt.version : 0;
  if (incomingV === 0 && targetV === 0) return incoming;
  return { ...inc, version: Math.max(incomingV, targetV) + 1 };
}

// ── Main entry ──────────────────────────────────────────────────────

export function buildImportPlan(
  incoming: WorkspaceExport,
  diff: DiffResult,
  _target: TargetWorkspaceState,
  strategies: StrategyMap = {},
  opts: ImporterOptions = {},
): ImportPlan {
  const trust = opts.trustExport ?? false;
  const strip = opts.stripScripts ?? false;
  const omitOAuth = opts.omitOAuthConfigs ?? false;
  const uidRemap: Record<string, string> = {};

  // ── Resolve per-array strategies (action tagging) ───────────────
  const collections = resolveArrayBase<Collection>({
    diff: diff.collections,
    overrides: strategies.collections,
  });
  // Keep-target-order override: on `update`, preserve the target
  // collection's `order` instead of taking export's. Indexed walk —
  // resolveArrayBase preserves diff order so the entries align 1:1.
  if (opts.keepTargetCollectionOrder) {
    for (let i = 0; i < collections.entries.length; i++) {
      const entry = collections.entries[i];
      const diffEntry = diff.collections[i];
      if (entry.action !== 'update' || !diffEntry?.matchedTarget) continue;
      const targetOrder = diffEntry.matchedTarget.order;
      const next: Collection = { ...entry.entity };
      if (targetOrder !== undefined) next.order = targetOrder;
      else delete (next as { order?: unknown }).order;
      collections.entries[i] = { ...entry, entity: next };
    }
  }
  const folders = resolveArrayBase<LocalFolder>({
    diff: diff.folders,
    overrides: strategies.folders,
  });
  const rules = resolveArrayBase<Rule>({
    diff: diff.rules,
    overrides: strategies.rules,
    stamp: (r) => forceDisabled(r, trust),
  });
  const requests = resolveArrayBase<Request>({
    diff: diff.requests,
    overrides: strategies.requests,
    stamp: (r) => omitOAuthAuth(stripRequestScripts(r, strip), omitOAuth),
  });
  const templates = resolveArrayBase<Template>({
    diff: diff.templates,
    overrides: strategies.templates,
  });
  const environments = resolveArrayBase<Environment>({
    diff: diff.environments,
    overrides: strategies.environments,
  });
  const liveWorkflows = resolveArrayBase<LiveWorkflow>({
    diff: diff.liveWorkflows,
    overrides: strategies.liveWorkflows,
    stamp: (w) => forceDisabled(w, trust),
  });
  const liveVariables = resolveArrayBase<LiveVariable>({
    diff: diff.liveVariables,
    overrides: strategies.liveVariables,
    stamp: (lv) => forceDisabled(lv, trust),
  });

  // ── Tree-aware new-uid: rules / requests / templates ───────────
  // Folders + collections that belong to a given tree must regen with
  // the entities that share the tree, so the path remap is consistent.
  // We slice by tree-prefix and run `deepCopyHierarchy` per tree on
  // the `new-uid`-marked subset.
  const allCreatedRules: Rule[] = [];
  for (const tree of ['rules', 'requests', 'templates'] as const) {
    const treeColIds = new Set<string>();
    const treeFolderIds = new Set<string>();
    for (const c of collections.entries) {
      if (c.action === 'create' && c.entity.path.startsWith(`${tree}/`)) treeColIds.add(c.entity.uid);
    }
    for (const f of folders.entries) {
      if (f.action === 'create' && f.entity.path.startsWith(`${tree}/`)) treeFolderIds.add(f.entity.uid);
    }

    const incomingTreeCols = collections.entries
      .filter((e) => e.action === 'create' && e.entity.path.startsWith(`${tree}/`))
      .map((e) => e.entity);
    const incomingTreeFolders = folders.entries
      .filter((e) => e.action === 'create' && e.entity.path.startsWith(`${tree}/`))
      .map((e) => e.entity);

    let leaves: { uid: string; path: string; name: string }[] = [];
    if (tree === 'rules') {
      leaves = rules.entries.filter((e) => e.action === 'create').map((e) => e.entity);
    } else if (tree === 'requests') {
      leaves = requests.entries.filter((e) => e.action === 'create').map((e) => e.entity);
    } else {
      leaves = templates.entries.filter((e) => e.action === 'create').map((e) => e.entity);
    }

    if (incomingTreeCols.length === 0 && incomingTreeFolders.length === 0 && leaves.length === 0) continue;

    if (tree === 'rules') {
      const out = deepCopyHierarchy<Rule>({
        entities: leaves as Rule[],
        collections: incomingTreeCols,
        folders: incomingTreeFolders,
        treePrefix: tree,
        finalizeEntity: (rule, ctx) => {
          const withIds = rule as Rule & { collectionId?: string; folderId?: string };
          const remap = (oldId: string | undefined): string | undefined => {
            if (!oldId) return oldId;
            return ctx.collectionUidRemap.get(oldId) ?? ctx.folderUidRemap.get(oldId) ?? oldId;
          };
          return {
            ...rule,
            ...(withIds.collectionId && { collectionId: remap(withIds.collectionId) }),
            ...(withIds.folderId && { folderId: remap(withIds.folderId) }),
          } as Rule;
        },
      });
      // Splice the renamed collections/folders/entities back into the
      // plan entries (replacing the originals matched by old uid).
      replaceCreates(collections.entries, out.collections, incomingTreeCols);
      replaceCreates(folders.entries, out.folders, incomingTreeFolders);
      replaceCreates(rules.entries, out.entities, leaves as Rule[]);
      mergeUidRemap(uidRemap, out, incomingTreeCols, incomingTreeFolders, leaves);
      allCreatedRules.push(...out.entities);
    } else if (tree === 'requests') {
      const out = deepCopyHierarchy<Request>({
        entities: leaves as Request[],
        collections: incomingTreeCols,
        folders: incomingTreeFolders,
        treePrefix: tree,
      });
      replaceCreates(collections.entries, out.collections, incomingTreeCols);
      replaceCreates(folders.entries, out.folders, incomingTreeFolders);
      replaceCreates(requests.entries, out.entities, leaves as Request[]);
      mergeUidRemap(uidRemap, out, incomingTreeCols, incomingTreeFolders, leaves);
    } else {
      const out = deepCopyHierarchy<Template>({
        entities: leaves as Template[],
        collections: incomingTreeCols,
        folders: incomingTreeFolders,
        treePrefix: tree,
      });
      replaceCreates(collections.entries, out.collections, incomingTreeCols);
      replaceCreates(folders.entries, out.folders, incomingTreeFolders);
      replaceCreates(templates.entries, out.entities, leaves as Template[]);
      mergeUidRemap(uidRemap, out, incomingTreeCols, incomingTreeFolders, leaves);
    }
  }

  // ── new-uid for environments / live-* (no tree, just regen). ───
  applyFlatNewUid(environments.entries, uidRemap);
  applyFlatNewUid(liveWorkflows.entries, uidRemap);
  // Live variables rebind their workflowUid through uidRemap.
  applyFlatNewUid(liveVariables.entries, uidRemap, (lv) => {
    const remappedWorkflowUid = uidRemap[lv.workflowUid] ?? lv.workflowUid;
    return { ...lv, workflowUid: remappedWorkflowUid };
  });

  // Live workflows rebind their step requestUids through uidRemap too.
  for (const entry of liveWorkflows.entries) {
    if (entry.action !== 'create') continue;
    entry.entity = {
      ...entry.entity,
      steps: entry.entity.steps.map((s) => ({ ...s, requestUid: uidRemap[s.requestUid] ?? s.requestUid })),
    };
  }

  // ── Singletons: workspaceVars + vault ───────────────────────────
  const workspaceVars = resolveWorkspaceVarsSingleton(
    incoming.entities.workspaceVars,
    diff.workspaceVars,
    strategies.workspaceVars,
    _target.workspaceVars,
  );
  const vault = resolveVaultSingleton(incoming.entities.vault, diff.vault, strategies.vault, _target.vault);

  return {
    collections: collections.entries,
    folders: folders.entries,
    rules: rules.entries,
    requests: requests.entries,
    templates: templates.entries,
    environments: environments.entries,
    liveWorkflows: liveWorkflows.entries,
    liveVariables: liveVariables.entries,
    workspaceVars,
    vault,
    uidRemap,
  };
}

// ── Tree-splice helpers ─────────────────────────────────────────────

function replaceCreates<T extends { uid: string }>(entries: PlanEntry<T>[], newEntities: T[], oldEntities: T[]): void {
  for (let i = 0; i < oldEntities.length; i++) {
    const oldUid = oldEntities[i].uid;
    const idx = entries.findIndex((e) => e.action === 'create' && e.entity.uid === oldUid);
    if (idx >= 0) entries[idx] = { action: 'create', entity: newEntities[i] };
  }
}

function mergeUidRemap<E extends { uid: string }>(
  out: Record<string, string>,
  result: { collections: { uid: string }[]; folders: { uid: string }[]; entities: E[] },
  oldCols: { uid: string }[],
  oldFolders: { uid: string }[],
  oldLeaves: { uid: string }[],
): void {
  for (let i = 0; i < oldCols.length; i++) out[oldCols[i].uid] = result.collections[i].uid;
  for (let i = 0; i < oldFolders.length; i++) out[oldFolders[i].uid] = result.folders[i].uid;
  for (let i = 0; i < oldLeaves.length; i++) out[oldLeaves[i].uid] = result.entities[i].uid;
}

// ── Flat new-uid (no tree) ──────────────────────────────────────────

function applyFlatNewUid<T extends { uid: string; name: string; path?: string }>(
  entries: PlanEntry<T>[],
  uidRemap: Record<string, string>,
  rebind?: (entity: T) => T,
): void {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.action !== 'create') continue;
    const oldUid = e.entity.uid;
    const newUid = generateUid();
    uidRemap[oldUid] = newUid;
    const next: T = {
      ...e.entity,
      uid: newUid,
      ...(typeof e.entity.path === 'string' ? { path: rebuildPath(e.entity.path, e.entity.name, newUid) } : {}),
    };
    entries[i] = { action: 'create', entity: rebind ? rebind(next) : next };
  }
}

function rebuildPath(oldPath: string, name: string, newUid: string): string {
  // Replace the trailing folder segment with `toFolderName(name, newUid)`.
  const idx = oldPath.lastIndexOf('/');
  const parent = idx === -1 ? '' : oldPath.substring(0, idx);
  const renamed = toFolderName(name, newUid);
  return parent ? `${parent}/${renamed}` : renamed;
}

// ── Singleton resolution ────────────────────────────────────────────

function resolveWorkspaceVarsSingleton(
  incoming: WorkspaceVariables,
  diff: DiffSingleton<WorkspaceVariables>,
  override: PlanSingletonAction | undefined,
  target?: WorkspaceVariables,
): PlanWorkspaceVariables {
  const action = override ?? (diff.defaultStrategy as PlanSingletonAction);
  if (action === 'skip') return { action, variables: target?.variables ?? [] };
  if (action === 'replace') return { action, variables: incoming.variables };
  // merge-by-name
  return { action, variables: mergeVariablesByName(target?.variables ?? [], incoming.variables) };
}

function resolveVaultSingleton(
  incoming: Vault | undefined,
  diff: DiffSingleton<Vault>,
  override: PlanSingletonAction | undefined,
  target?: Vault,
): PlanVault {
  const action = override ?? (diff.defaultStrategy as PlanSingletonAction);
  if (!incoming || incoming.secrets.length === 0) {
    return { action: 'skip', secrets: target?.secrets ?? [] };
  }
  if (action === 'skip') return { action, secrets: target?.secrets ?? [] };
  if (action === 'replace') return { action, secrets: incoming.secrets };
  return { action, secrets: mergeSecretsByName(target?.secrets ?? [], incoming.secrets) };
}
