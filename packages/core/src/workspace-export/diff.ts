/**
 * Collision detection between an incoming `WorkspaceExport` and the
 * target workspace's current state.
 *
 * Match keys (per design §2.1):
 *   - Most entities match by `uid` first, fall back to `name` within
 *     the same logical scope (workspace-wide for Environments / Live*,
 *     within parent for Collection / Folder / Rule / Request / Template).
 *   - `WorkspaceVariables` and `Vault` are workspace singletons — match
 *     is "this is the workspace's only one"; collision means it has any
 *     existing content.
 *
 * Default strategies are tuned for the **share** path (recipient is
 * bringing in someone else's workspace and shouldn't overwrite their
 * own data):
 *
 *   - Collection / Folder → `new-uid` (duplicate-with-new-uid)
 *   - Rule / Request / Template → `new-uid`
 *   - Environment / LiveWorkflow / LiveVariable → `new-uid`
 *   - WorkspaceVariables / Vault → `merge-by-name`
 *
 * Pure function. No platform deps. The output describes the proposed
 * action; the importer (`importer.ts`) consumes it to build a write
 * plan, and the preview modal renders it as the collision tree.
 */

import * as v from 'valibot';
import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Spec,
  Template,
  Vault,
  WorkspaceVariables,
} from '../types/index';
import type { WorkspaceExport } from './schema';

// ── Strategies & states ─────────────────────────────────────────────

/**
 * Per-entity action the importer will take. Not all values apply to
 * every entity type — see `allowedStrategies` on each `DiffEntry`.
 */
export const COLLISION_STRATEGIES = [
  'new-uid',
  'update',
  'skip',
  'merge-by-name',
  'replace',
  'merge-vars',
  'merge-children',
] as const;
export const CollisionStrategySchema = v.picklist(COLLISION_STRATEGIES);
export type CollisionStrategy = v.InferOutput<typeof CollisionStrategySchema>;

export type CollisionState = 'no-collision' | 'collision-uid' | 'collision-name';

export interface DiffEntry<T> {
  entity: T;
  state: CollisionState;
  /** The target-side entity that matched, when `state !== 'no-collision'`. */
  matchedTarget?: T;
  defaultStrategy: CollisionStrategy;
  allowedStrategies: readonly CollisionStrategy[];
  /**
   * `true` when `update` would overwrite an entity whose `updatedAt` is
   * newer than the export's `exportedAt` (design §12 q34 — diverged
   * target detection). Drives the "edited since export was made" warning
   * and suppresses auto-`update` selection in the preview.
   */
  divergedFromExport?: boolean;
}

export interface DiffSingleton<T> {
  state: CollisionState;
  defaultStrategy: CollisionStrategy;
  allowedStrategies: readonly CollisionStrategy[];
  /** Singleton has any existing content on the target. */
  targetHasContent: boolean;
  /**
   * Target-side singleton value when present — surfaced so the import
   * preview's diff pane can render a side-by-side comparison against
   * the incoming envelope's singleton (design §5.2 "show me what
   * changes" — the same affordance as DiffEntry.matchedTarget).
   */
  target?: T;
}

export interface DiffResult {
  collections: DiffEntry<Collection>[];
  folders: DiffEntry<Folder>[];
  rules: DiffEntry<Rule>[];
  requests: DiffEntry<Request>[];
  templates: DiffEntry<Template>[];
  environments: DiffEntry<Environment>[];
  liveWorkflows: DiffEntry<LiveWorkflow>[];
  liveVariables: DiffEntry<LiveVariable>[];
  specs: DiffEntry<Spec>[];
  workspaceVars: DiffSingleton<WorkspaceVariables>;
  vault: DiffSingleton<Vault>;
}

export interface TargetWorkspaceState {
  collections: Collection[];
  folders: Folder[];
  rules: Rule[];
  requests: Request[];
  templates: Template[];
  environments: Environment[];
  liveWorkflows: LiveWorkflow[];
  liveVariables: LiveVariable[];
  specs: Spec[];
  workspaceVars?: WorkspaceVariables;
  vault?: Vault;
}

// ── Strategy tables ─────────────────────────────────────────────────

const COLLECTION_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip', 'merge-children'];
const FOLDER_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const RULE_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const REQUEST_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const TEMPLATE_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const ENVIRONMENT_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip', 'merge-vars'];
const LIVE_WORKFLOW_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const LIVE_VARIABLE_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const SPEC_STRATEGIES: readonly CollisionStrategy[] = ['new-uid', 'update', 'skip'];
const SINGLETON_STRATEGIES: readonly CollisionStrategy[] = ['merge-by-name', 'replace', 'skip'];

// ── Match helpers ───────────────────────────────────────────────────

interface NameKeyed {
  uid: string;
  name: string;
}

interface PathKeyed extends NameKeyed {
  path: string;
}

/**
 * Match by uid, then by name within the same parent path. Returns the
 * matched target + the kind of match. The parent-path scoping is the
 * design's "within parent" qualifier — two folders both named "Auth"
 * but under different collections are not a collision.
 */
function matchByUidThenSiblingName<T extends PathKeyed>(
  incoming: T,
  targets: readonly T[],
): { target: T; state: 'collision-uid' | 'collision-name' } | null {
  const byUid = targets.find((t) => t.uid === incoming.uid);
  if (byUid) return { target: byUid, state: 'collision-uid' };
  const incomingParent = parentPath(incoming.path);
  const byName = targets.find((t) => t.name === incoming.name && parentPath(t.path) === incomingParent);
  if (byName) return { target: byName, state: 'collision-name' };
  return null;
}

/** Match by uid, then by name workspace-wide (no parent-path scoping). */
function matchByUidThenName<T extends NameKeyed>(
  incoming: T,
  targets: readonly T[],
): { target: T; state: 'collision-uid' | 'collision-name' } | null {
  const byUid = targets.find((t) => t.uid === incoming.uid);
  if (byUid) return { target: byUid, state: 'collision-uid' };
  const byName = targets.find((t) => t.name === incoming.name);
  if (byName) return { target: byName, state: 'collision-name' };
  return null;
}

function parentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.substring(0, idx);
}

// ── Diverged-target detection ───────────────────────────────────────

interface MaybeUpdatedAt {
  updatedAt?: string;
}

function isDivergedFromExport(target: unknown, exportedAt: string): boolean {
  const t = target as MaybeUpdatedAt;
  if (typeof t.updatedAt !== 'string') return false;
  return t.updatedAt > exportedAt;
}

// ── Entry builders ──────────────────────────────────────────────────

interface BuildEntryOpts<T> {
  match: { target: T; state: 'collision-uid' | 'collision-name' } | null;
  defaultStrategy: CollisionStrategy;
  noCollisionStrategy?: CollisionStrategy;
  allowedStrategies: readonly CollisionStrategy[];
  exportedAt: string;
}

function buildEntry<T>(entity: T, opts: BuildEntryOpts<T>): DiffEntry<T> {
  if (!opts.match) {
    return {
      entity,
      state: 'no-collision',
      defaultStrategy: opts.noCollisionStrategy ?? 'new-uid',
      allowedStrategies: opts.allowedStrategies,
    };
  }
  const diverged = isDivergedFromExport(opts.match.target, opts.exportedAt);
  return {
    entity,
    state: opts.match.state,
    matchedTarget: opts.match.target,
    defaultStrategy: opts.defaultStrategy,
    allowedStrategies: opts.allowedStrategies,
    ...(diverged ? { divergedFromExport: true } : {}),
  };
}

// ── Singleton diff ──────────────────────────────────────────────────

function diffWorkspaceVarsSingleton(target?: WorkspaceVariables): DiffSingleton<WorkspaceVariables> {
  const targetHasContent = !!target && target.variables.length > 0;
  return {
    state: targetHasContent ? 'collision-name' : 'no-collision',
    defaultStrategy: 'merge-by-name',
    allowedStrategies: SINGLETON_STRATEGIES,
    targetHasContent,
    ...(target ? { target } : {}),
  };
}

function diffVaultSingleton(target?: Vault): DiffSingleton<Vault> {
  const targetHasContent = !!target && target.secrets.length > 0;
  return {
    state: targetHasContent ? 'collision-name' : 'no-collision',
    defaultStrategy: 'merge-by-name',
    allowedStrategies: SINGLETON_STRATEGIES,
    targetHasContent,
    ...(target ? { target } : {}),
  };
}

// ── Main entry point ────────────────────────────────────────────────

export function diffWorkspaceExport(incoming: WorkspaceExport, target: TargetWorkspaceState): DiffResult {
  const { exportedAt } = incoming;

  const collections = incoming.entities.collections.map<DiffEntry<Collection>>((c) =>
    buildEntry(c, {
      match: matchByUidThenSiblingName(c, target.collections),
      defaultStrategy: 'new-uid',
      allowedStrategies: COLLECTION_STRATEGIES,
      exportedAt,
    }),
  );
  const folders = incoming.entities.folders.map<DiffEntry<Folder>>((f) =>
    buildEntry(f, {
      match: matchByUidThenSiblingName(f, target.folders),
      defaultStrategy: 'new-uid',
      allowedStrategies: FOLDER_STRATEGIES,
      exportedAt,
    }),
  );
  const rules = incoming.entities.rules.map<DiffEntry<Rule>>((r) =>
    buildEntry(r, {
      match: matchByUidThenSiblingName(r, target.rules),
      defaultStrategy: 'new-uid',
      allowedStrategies: RULE_STRATEGIES,
      exportedAt,
    }),
  );
  const requests = incoming.entities.requests.map<DiffEntry<Request>>((r) =>
    buildEntry(r, {
      match: matchByUidThenSiblingName(r, target.requests),
      defaultStrategy: 'new-uid',
      allowedStrategies: REQUEST_STRATEGIES,
      exportedAt,
    }),
  );
  const templates = incoming.entities.templates.map<DiffEntry<Template>>((t) =>
    buildEntry(t, {
      match: matchByUidThenSiblingName(t, target.templates),
      defaultStrategy: 'new-uid',
      allowedStrategies: TEMPLATE_STRATEGIES,
      exportedAt,
    }),
  );
  const environments = incoming.entities.environments.map<DiffEntry<Environment>>((e) =>
    buildEntry(e, {
      // Environments are workspace-wide, not parent-scoped.
      match: matchByUidThenName(e, target.environments),
      defaultStrategy: 'new-uid',
      allowedStrategies: ENVIRONMENT_STRATEGIES,
      exportedAt,
    }),
  );
  const liveWorkflows = incoming.entities.liveWorkflows.map<DiffEntry<LiveWorkflow>>((w) =>
    buildEntry(w, {
      match: matchByUidThenName(w, target.liveWorkflows),
      defaultStrategy: 'new-uid',
      allowedStrategies: LIVE_WORKFLOW_STRATEGIES,
      exportedAt,
    }),
  );
  const liveVariables = incoming.entities.liveVariables.map<DiffEntry<LiveVariable>>((lv) =>
    buildEntry(lv, {
      match: matchByUidThenName(lv, target.liveVariables),
      defaultStrategy: 'new-uid',
      allowedStrategies: LIVE_VARIABLE_STRATEGIES,
      exportedAt,
    }),
  );
  const specs = incoming.entities.specs.map<DiffEntry<Spec>>((s) =>
    buildEntry(s, {
      // Specs are workspace-wide, not parent-scoped — same as environments.
      match: matchByUidThenName(s, target.specs),
      defaultStrategy: 'new-uid',
      allowedStrategies: SPEC_STRATEGIES,
      exportedAt,
    }),
  );

  return {
    collections,
    folders,
    rules,
    requests,
    templates,
    environments,
    liveWorkflows,
    liveVariables,
    specs,
    workspaceVars: diffWorkspaceVarsSingleton(target.workspaceVars),
    vault: diffVaultSingleton(target.vault),
  };
}

/**
 * Backup-restore mode toggle (the "this is mine" switch from design
 * §2.1). Flips Rule/Request/Template/Environment/Live*'s `defaultStrategy`
 * to `update` for every collision-uid match — so re-importing one's
 * own export into the same workspace updates in place. Skips collision-
 * name matches (a name-only match across forks shouldn't auto-update).
 *
 * Diverged entries (`divergedFromExport: true`) are NOT auto-flipped to
 * `update` — protects against silent data loss when the user has edited
 * the entity since the export was created.
 */
export function applyBackupRestoreToggle(diff: DiffResult): DiffResult {
  const flip = <T>(entries: DiffEntry<T>[]): DiffEntry<T>[] =>
    entries.map((entry) => {
      if (entry.state !== 'collision-uid') return entry;
      if (entry.divergedFromExport) return entry;
      if (!entry.allowedStrategies.includes('update')) return entry;
      return { ...entry, defaultStrategy: 'update' };
    });
  return {
    ...diff,
    rules: flip(diff.rules),
    requests: flip(diff.requests),
    templates: flip(diff.templates),
    environments: flip(diff.environments),
    liveWorkflows: flip(diff.liveWorkflows),
    liveVariables: flip(diff.liveVariables),
    specs: flip(diff.specs),
  };
}
