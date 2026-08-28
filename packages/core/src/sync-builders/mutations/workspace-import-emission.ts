/**
 * Workspace-import → local-mutation emission.
 *
 * Converts an executed `ImportPlan` into ordinary local `MutationBatch`es
 * — the same envelopes the editors mint — so an import into a workspace
 * with a live sync engine rides the normal apply path: materialization,
 * cache projection + persistence, broadcast, and the outbound mutation
 * plane. This is what lets a client-host import (web tab, extension
 * joined to a backend) propagate upstream as the authenticated user's
 * edits instead of landing host-local via the inbound-origin reseed.
 *
 * Shape per plan entry:
 *   - `create` → the family's seed batch (`create` + per-member
 *     `addToSet`), exactly what `buildAddBatch` wraps, plus the parent's
 *     containment slot in the same batch: the workspace roots' set for
 *     a collection, the parent's `folders` / `items` set for a folder /
 *     leaf, appended after the parent's live tail. A leaf whose parent
 *     is unresolvable lands slot-less (the by-path seeding rehomes it)
 *     rather than being dropped.
 *   - `update` → a diff against the pre-import target entity: scalar
 *     leaves via the family's `buildUpdateBatch` where one exists
 *     (rules / requests / templates / live workflows / live variables),
 *     raw `setField`/`unsetField` bodies elsewhere; set-modeled paths
 *     via `synthesizeSetDiff` keyed by the members' persisted uids, so
 *     a replay on a peer that already holds the target entity converges
 *     without duplicating set members.
 *   - `skip` → nothing.
 *
 * Pure synthesis — no oracle writes, no IO. The caller supplies the
 * live set-entry reader (for orderKey-accurate set diffs) and a
 * context factory (each batch mints fresh HLCs), then applies the
 * returned batches in order: collections before folders (parent slots
 * must exist for the folder create's `addToSet`), folders before
 * leaves, singletons last.
 */

import {
  type ChildPlacement,
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  canonicalJson,
  deriveSideEffectsForEnvelope,
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  keyBetween,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type MutatorIntent,
  mergedTailKey,
  mintBatch,
  type ParentRefShape,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  RULE_ENTITY_TYPE,
  resolveTreeParent,
  type SideEffectIntent,
  SPEC_ENTITY_TYPE,
  SPEC_FILES_PATH,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_FOLDER_TREE_KINDS,
  TRUSTED_ROOTS_ENTITY_TYPE,
  TRUSTED_ROOTS_ID,
  TRUSTED_ROOTS_PATH,
  type TreeParentKinds,
  type TreeParentRef,
  treeOrderScope,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_PATH,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
  type WorkspaceRootsRef,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type {
  Collection,
  Environment,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Spec,
  Template,
  TrustedRoot,
  TrustedRoots,
  Variable,
  Vault,
  VaultSecret,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { lastPathSegment, parentPathOf } from '@openheaders/core/utils';
import type { ImportPlan, LocalFolder, PlanEntry } from '@openheaders/core/workspace-export';
import { seedCollection } from '../projections/collection-projection';
import { seedEnvironment } from '../projections/env-projection';
import { seedRequestCollection } from '../projections/request-collection-projection';
import { seedSpec } from '../projections/spec-projection';
import { seedTemplateCollection } from '../projections/template-collection-projection';
import { seedTrustedRoots } from '../projections/trusted-roots-projection';
import { seedVault } from '../projections/vault-projection';
import { seedWorkspaceVariables } from '../projections/workspace-variables-projection';
import { buildCreateFolderBatch } from './folder-mutations';
import { buildAddLiveVariableBatch, buildUpdateLiveVariableBatch } from './live-variable-mutations';
import { buildAddLiveWorkflowBatch, buildUpdateLiveWorkflowBatch } from './live-workflow-mutations';
import { buildCreateRequestFolderBatch } from './request-folder-mutations';
import {
  buildAddBatch as buildAddRequestBatch,
  buildUpdateBatch as buildUpdateRequestBatch,
} from './request-mutations';
import { buildAddBatch as buildAddRuleBatch, buildUpdateBatch as buildUpdateRuleBatch } from './rule-mutations';
import { buildCreateTemplateFolderBatch } from './template-folder-mutations';
import {
  buildAddBatch as buildAddTemplateBatch,
  buildUpdateBatch as buildUpdateTemplateBatch,
} from './template-mutations';
import type { SlotOrderPlan } from './tree-slot-order';

/** One applicable unit: a minted batch plus its derived side effects. */
export interface EmissionBatch {
  /** Diagnostic tag, e.g. `rule:abc123 (update)` — for failure logs. */
  label: string;
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live `(itemId, orderKey, item)` reader over the target workspace's
 * oracle. Same triplet the write-site builders consume; the emission
 * uses it for orderKey-accurate set diffs and for appending created
 * folders after the parent's existing children.
 */
export type LiveSetEntriesReader = (entityType: string, id: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

export interface ImportEmissionDeps {
  /** Fresh mutator context per batch — mintBatch ticks HLCs off it. */
  nextCtx: () => MutatorContext;
  liveSetEntries: LiveSetEntriesReader;
  /**
   * The slot-key minter to place created children with. Absent = a
   * fresh tail tracker over `liveSetEntries`; a caller that mints slots
   * beyond this emission in the same run (the tree delta) shares its own
   * so two minters never hand the same parent the same key.
   */
  tail?: TailTracker;
}

/**
 * Pre-import target buckets — what the target workspace (and, modulo
 * in-flight envelopes, the backend) holds before the import. Update
 * diffs are computed against these.
 */
export interface ImportEmissionPrev {
  rules: Rule[];
  requests: Request[];
  templates: Template[];
  environments: Environment[];
  liveWorkflows: LiveWorkflow[];
  liveVariables: LiveVariable[];
  specs: Spec[];
  ruleCollections: Collection[];
  requestCollections: Collection[];
  templateCollections: Collection[];
  ruleFolders: LocalFolder[];
  requestFolders: LocalFolder[];
  templateFolders: LocalFolder[];
  workspaceVars?: WorkspaceVariables;
  vault?: Vault;
  trustedRoots?: TrustedRoots;
}

/** The plan's collection/folder arrays, demuxed per tree by the caller. */
export interface ImportEmissionPlanSlices {
  plan: ImportPlan;
  ruleCollections: PlanEntry<Collection>[];
  requestCollections: PlanEntry<Collection>[];
  templateCollections: PlanEntry<Collection>[];
  ruleFolders: PlanEntry<LocalFolder>[];
  requestFolders: PlanEntry<LocalFolder>[];
  templateFolders: PlanEntry<LocalFolder>[];
}

export function synthesizeImportEmission(
  slices: ImportEmissionPlanSlices,
  prev: ImportEmissionPrev,
  deps: ImportEmissionDeps,
): EmissionBatch[] {
  const out: EmissionBatch[] = [];
  const { plan } = slices;

  // One tail tracker per emission: every parent's `folders` / `items`
  // set and the roots' collection sets append strictly after their live
  // tail, and sibling creates in the same run keep ascending.
  const tail = deps.tail ?? createTailTracker(deps.liveSetEntries);
  const ruleTree = createTreePlacer(
    FOLDER_TREE_KINDS,
    prev.ruleCollections,
    slices.ruleCollections,
    prev.ruleFolders,
    slices.ruleFolders,
  );
  const requestTree = createTreePlacer(
    REQUEST_FOLDER_TREE_KINDS,
    prev.requestCollections,
    slices.requestCollections,
    prev.requestFolders,
    slices.requestFolders,
  );
  const templateTree = createTreePlacer(
    TEMPLATE_FOLDER_TREE_KINDS,
    prev.templateCollections,
    slices.templateCollections,
    prev.templateFolders,
    slices.templateFolders,
  );

  // ── Collections (parents first: folder creates addToSet their slots) ──
  emitCollections(
    out,
    slices.ruleCollections,
    prev.ruleCollections,
    COLLECTION_ENTITY_TYPE,
    COLLECTION_VARS_PATH,
    WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
    seedCollection,
    tail,
    deps,
  );
  emitCollections(
    out,
    slices.requestCollections,
    prev.requestCollections,
    REQUEST_COLLECTION_ENTITY_TYPE,
    REQUEST_COLLECTION_VARS_PATH,
    WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
    seedRequestCollection,
    tail,
    deps,
  );
  emitCollections(
    out,
    slices.templateCollections,
    prev.templateCollections,
    TEMPLATE_COLLECTION_ENTITY_TYPE,
    TEMPLATE_COLLECTION_VARS_PATH,
    WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
    seedTemplateCollection,
    tail,
    deps,
  );

  // ── Folders (depth order; parent slot rides the create batch) ──
  emitFolders(out, {
    entries: slices.ruleFolders,
    prevFolders: prev.ruleFolders,
    tree: ruleTree,
    childrenPath: FOLDER_CHILDREN_PATH,
    buildCreate: buildCreateFolderBatch,
    tail,
    deps,
  });
  emitFolders(out, {
    entries: slices.requestFolders,
    prevFolders: prev.requestFolders,
    tree: requestTree,
    childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
    buildCreate: buildCreateRequestFolderBatch,
    tail,
    deps,
  });
  emitFolders(out, {
    entries: slices.templateFolders,
    prevFolders: prev.templateFolders,
    tree: templateTree,
    childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
    buildCreate: buildCreateTemplateFolderBatch,
    tail,
    deps,
  });

  // ── Leaves ──
  emitLeaves(out, plan.rules, prev.rules, 'rule', {
    place: (rule) => ruleTree.placeLeaf(rule, FOLDER_ITEMS_PATH, tail),
    create: (rule, ctx, placement) => buildAddRuleBatch(rule, ctx, placement),
    update: (uid, entity, updates, ctx) =>
      buildUpdateRuleBatch(
        uid,
        entity.type,
        updates as Partial<Omit<Rule, 'uid' | 'path'>>,
        ctx,
        (id, setPath) => deps.liveSetEntries(RULE_ENTITY_TYPE, id, setPath),
        (id, path) => prevField(prev.rules, id, path),
      ),
    entityType: RULE_ENTITY_TYPE,
    deps,
  });
  emitLeaves(out, plan.requests, prev.requests, 'request', {
    place: (request) => requestTree.placeLeaf(request, REQUEST_FOLDER_ITEMS_PATH, tail),
    create: (request, ctx, placement) => buildAddRequestBatch(request, ctx, placement),
    update: (uid, _entity, updates, ctx) =>
      buildUpdateRequestBatch(
        uid,
        updates as Partial<Omit<Request, 'uid' | 'path'>>,
        ctx,
        (id, setPath) => deps.liveSetEntries(REQUEST_ENTITY_TYPE, id, setPath),
        (id, path) => prevField(prev.requests, id, path),
      ),
    entityType: REQUEST_ENTITY_TYPE,
    deps,
  });
  emitLeaves(out, plan.templates, prev.templates, 'template', {
    place: (template) => templateTree.placeLeaf(template, TEMPLATE_FOLDER_ITEMS_PATH, tail),
    create: (template, ctx, placement) => buildAddTemplateBatch(template, ctx, placement),
    update: (uid, _entity, updates, ctx) =>
      buildUpdateTemplateBatch(uid, updates as Partial<Omit<Template, 'uid' | 'path'>>, ctx, (id, setPath) =>
        deps.liveSetEntries(TEMPLATE_ENTITY_TYPE, id, setPath),
      ),
    entityType: TEMPLATE_ENTITY_TYPE,
    deps,
  });

  // ── Environments (name scalar + uid-keyed variables set) ──
  emitEnvironments(out, plan.environments, prev.environments, deps);

  // ── Specs (scalars + uid-keyed files set) ──
  emitSpecs(out, plan.specs, prev.specs, deps);

  // ── Live workflows / variables (flat scalars) ──
  emitLeaves(out, plan.liveWorkflows, prev.liveWorkflows, 'live-workflow', {
    place: () => null,
    create: (wf, ctx) => buildAddLiveWorkflowBatch(wf, ctx),
    update: (uid, _entity, updates, ctx) =>
      buildUpdateLiveWorkflowBatch(uid, updates as Partial<Omit<LiveWorkflow, 'uid' | 'path'>>, ctx),
    entityType: LIVE_WORKFLOW_ENTITY_TYPE,
    deps,
  });
  emitLeaves(out, plan.liveVariables, prev.liveVariables, 'live-variable', {
    place: () => null,
    create: (lv, ctx) => buildAddLiveVariableBatch(lv, ctx),
    update: (uid, _entity, updates, ctx) =>
      buildUpdateLiveVariableBatch(uid, updates as Partial<Omit<LiveVariable, 'uid' | 'path'>>, ctx),
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
    deps,
  });

  // ── Singletons ──
  emitVariablesSingleton(
    out,
    plan.workspaceVars.action !== 'skip' ? plan.workspaceVars.variables : null,
    prev.workspaceVars,
    deps,
  );
  emitVaultSingleton(out, plan.vault.action !== 'skip' ? plan.vault.secrets : null, prev.vault, deps);
  emitTrustedRootsSingleton(
    out,
    plan.trustedRoots.action !== 'skip' ? plan.trustedRoots.roots : null,
    prev.trustedRoots,
    deps,
  );

  return out.filter((e) => e.batch.mutations.length > 0);
}

// ── Shared helpers ─────────────────────────────────────────────────

export const changed = (a: unknown, b: unknown): boolean => canonicalJson(a) !== canonicalJson(b);

/**
 * Mints the slot key a child takes at a parent's ordered set. With no
 * order plan (or a set the plan does not cover) that is the next append
 * key: strictly after the live tail of the set's order scope on the
 * first call — a tree child set's scope is the parent's `folders` AND
 * `items` together, one merged order — strictly after the previous
 * mint on every later call, so a run of creates keeps its order across
 * kinds. A planned set hands out the position the tree's `order:`
 * assigned the child instead, and the tail stays untouched.
 */
export type TailTracker = (parent: ParentRefShape, setPath: string, childUid: string) => string;

export function createTailTracker(liveSetEntries: LiveSetEntriesReader, plan?: SlotOrderPlan): TailTracker {
  const lastKey = new Map<string, string | null>();
  return (parent, setPath, childUid) => {
    const planned = plan?.keyFor(parent, setPath, childUid);
    if (planned !== null && planned !== undefined) return planned;
    const scope = treeOrderScope(setPath);
    const mapKey = `${parent.type}:${parent.uid}:${scope.join('+')}`;
    let tail = lastKey.get(mapKey);
    if (tail === undefined) {
      tail = mergedTailKey(scope.map((path) => liveSetEntries(parent.type, parent.uid, path)));
    }
    const next = keyBetween(tail, null);
    lastKey.set(mapKey, next);
    return next;
  };
}

/**
 * Path → parent-ref resolution over one tree for the duration of an
 * emission: the target's collections and folders plus the plan's
 * non-skip entries (a created child may hang under a container created
 * by this same run), with the path's own uid tail as the fallback.
 */
export interface TreePlacer<C extends string, F extends string> {
  readonly kinds: TreeParentKinds<C, F>;
  parentOf(entityPath: string): TreeParentRef<C, F> | null;
  /** Placement for a leaf: its parent + the key the tracker mints for it
   *  on the parent's `setPath`; `null` when unresolvable. */
  placeLeaf(
    entity: { uid: string; path: string },
    setPath: string,
    tail: TailTracker,
  ): ChildPlacement<TreeParentRef<C, F>> | null;
}

export function createTreePlacer<C extends string, F extends string>(
  kinds: TreeParentKinds<C, F>,
  prevCollections: readonly Collection[],
  planCollections: readonly PlanEntry<Collection>[],
  prevFolders: readonly LocalFolder[],
  planFolders: readonly PlanEntry<LocalFolder>[],
): TreePlacer<C, F> {
  const collections: Array<{ uid: string; path: string }> = [...prevCollections];
  for (const e of planCollections) if (e.action !== 'skip') collections.push(e.entity);
  const folders: Array<{ uid: string; path: string }> = [...prevFolders];
  for (const e of planFolders) if (e.action !== 'skip') folders.push(e.entity);
  const lookup = { collections, folders };
  const parentOf = (entityPath: string): TreeParentRef<C, F> | null => {
    const parentPath = parentPathOf(entityPath);
    return parentPath === null ? null : resolveTreeParent(parentPath, lookup, kinds);
  };
  return {
    kinds,
    parentOf,
    placeLeaf(entity, setPath, tail) {
      const parent = parentOf(entity.path);
      return parent ? { parent, orderKey: tail(parent, setPath, entity.uid) } : null;
    },
  };
}

function byUid<T extends { uid: string }>(items: readonly T[] | undefined): Map<string, T> {
  return new Map((items ?? []).map((e) => [e.uid, e] as const));
}

function prevField<T extends { uid: string }>(items: readonly T[], uid: string, path: string): unknown {
  const entity = items.find((e) => e.uid === uid);
  return entity ? (entity as Record<string, unknown>)[path] : undefined;
}

function intentBatch(label: string, intent: MutatorIntent): EmissionBatch {
  return { label, batch: intent.batch, sideEffects: intent.sideEffects };
}

export function bodiesBatch(label: string, bodies: MutationBody[], ctx: MutatorContext): EmissionBatch {
  const batch = mintBatch(ctx, bodies);
  return { label, batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

export function seedBatch(label: string, batch: MutationBatch): EmissionBatch {
  return { label, batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

/**
 * Changed-keys patch for an update collision: every key of `next`
 * (minus `skip`) whose canonical value differs from `prev`'s. Keys
 * present on `prev` but absent from `next` are returned separately —
 * they tombstone via raw `unsetField` (the family `buildUpdateBatch`s
 * skip `undefined` by contract).
 */
export function diffKeys(
  prevEntity: Record<string, unknown> | undefined,
  nextEntity: Record<string, unknown>,
  skip: ReadonlySet<string>,
): { updates: Record<string, unknown>; removedKeys: string[] } {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nextEntity)) {
    if (skip.has(key) || value === undefined) continue;
    if (!prevEntity || changed(prevEntity[key], value)) updates[key] = value;
  }
  const removedKeys: string[] = [];
  if (prevEntity) {
    for (const key of Object.keys(prevEntity)) {
      if (skip.has(key) || key in nextEntity) continue;
      if (prevEntity[key] === undefined) continue;
      removedKeys.push(key);
    }
  }
  return { updates, removedKeys };
}

/**
 * Entity-managed keys an update collision never rewrites: identity,
 * the projected path, and the frozen segment behind it (an import
 * source that predates containment carries no `pathSegment`; a diff
 * against the target must not tombstone it).
 */
export const LEAF_SKIP: ReadonlySet<string> = new Set(['uid', 'path', 'pathSegment']);

// ── Leaves (rules / requests / templates / live wf / live vars) ────

interface LeafFamily<T extends { uid: string }, P extends ParentRefShape> {
  entityType: string;
  /** Containment for a created leaf; `null` for families without a parent. */
  place: (entity: T) => ChildPlacement<P> | null;
  create: (
    entity: T,
    ctx: MutatorContext,
    placement: ChildPlacement<P> | null,
  ) => { batch: MutationBatch; sideEffects: SideEffectIntent[] };
  update: (
    uid: string,
    entity: T,
    updates: Record<string, unknown>,
    ctx: MutatorContext,
  ) => { batch: MutationBatch; sideEffects: SideEffectIntent[] };
  deps: ImportEmissionDeps;
}

function emitLeaves<T extends { uid: string }, P extends ParentRefShape>(
  out: EmissionBatch[],
  entries: PlanEntry<T>[],
  prevItems: readonly T[],
  tag: string,
  family: LeafFamily<T, P>,
): void {
  const prevByUid = byUid(prevItems);
  for (const entry of entries) {
    if (entry.action === 'skip') continue;
    const uid = entry.entity.uid;
    const prevEntity = entry.action === 'update' ? prevByUid.get(uid) : undefined;
    if (entry.action === 'create' || !prevEntity) {
      const payload = family.create(entry.entity, family.deps.nextCtx(), family.place(entry.entity));
      out.push({ label: `${tag}:${uid} (create)`, batch: payload.batch, sideEffects: payload.sideEffects });
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as Record<string, unknown>,
      entry.entity as Record<string, unknown>,
      LEAF_SKIP,
    );
    if (Object.keys(updates).length > 0) {
      const payload = family.update(uid, entry.entity, updates, family.deps.nextCtx());
      out.push({ label: `${tag}:${uid} (update)`, batch: payload.batch, sideEffects: payload.sideEffects });
    }
    if (removedKeys.length > 0) {
      const bodies: MutationBody[] = removedKeys.map((key) => ({
        kind: 'unsetField',
        type: family.entityType,
        id: uid,
        path: key,
      }));
      out.push(bodiesBatch(`${tag}:${uid} (unset)`, bodies, family.deps.nextCtx()));
    }
  }
}

// ── Collections ────────────────────────────────────────────────────

/**
 * `order` is a projection of the parent's sets stamped for the planner
 * (`workspace-tree/order.ts`), never entity state — a tree-authored
 * `order:` converges through the slot-order plan, not a field write.
 */
const COLLECTION_SKIP = new Set(['uid', 'path', 'variables', 'order']);

function emitCollections(
  out: EmissionBatch[],
  entries: PlanEntry<Collection>[],
  prevItems: readonly Collection[],
  entityType: string,
  varsPath: string,
  rootsPath: string,
  seed: (collection: Collection, ctx: MutatorContext, placement: ChildPlacement<WorkspaceRootsRef>) => MutationBatch,
  tail: TailTracker,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entry of entries) {
    if (entry.action === 'skip') continue;
    const uid = entry.entity.uid;
    const prevEntity = entry.action === 'update' ? prevByUid.get(uid) : undefined;
    if (entry.action === 'create' || !prevEntity) {
      const placement = { parent: WORKSPACE_ROOTS_REF, orderKey: tail(WORKSPACE_ROOTS_REF, rootsPath, uid) };
      out.push(seedBatch(`${entityType}:${uid} (create)`, seed(entry.entity, deps.nextCtx(), placement)));
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as unknown as Record<string, unknown>,
      entry.entity as unknown as Record<string, unknown>,
      COLLECTION_SKIP,
    );
    const bodies: MutationBody[] = [];
    for (const [key, value] of Object.entries(updates)) {
      bodies.push({ kind: 'setField', type: entityType, id: uid, path: key, value });
    }
    for (const key of removedKeys) {
      bodies.push({ kind: 'unsetField', type: entityType, id: uid, path: key });
    }
    if (changed(prevEntity.variables, entry.entity.variables)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: entityType,
          id: uid,
          path: varsPath,
          live: deps.liveSetEntries(entityType, uid, varsPath),
          newItems: entry.entity.variables,
        }),
      );
    }
    if (bodies.length > 0) out.push(bodiesBatch(`${entityType}:${uid} (update)`, bodies, deps.nextCtx()));
  }
}

// ── Folders ────────────────────────────────────────────────────────

interface FolderEmissionArgs<C extends string, F extends string> {
  entries: PlanEntry<LocalFolder>[];
  prevFolders: readonly LocalFolder[];
  tree: TreePlacer<C, F>;
  /** The parent's ordered child-folder set path (`folders` on every tree). */
  childrenPath: string;
  buildCreate: (
    input: { folderUid: string; parent: TreeParentRef<C, F>; name: string; pathSegment?: string; orderKey?: string },
    ctx: MutatorContext,
  ) => MutatorIntent;
  tail: TailTracker;
  deps: ImportEmissionDeps;
}

function emitFolders<C extends string, F extends string>(out: EmissionBatch[], args: FolderEmissionArgs<C, F>): void {
  const prevByUid = byUid(args.prevFolders);

  // Parents before children — depth from `/` separators is total-ordered
  // with parents-first, same trick the folder cache's seed uses.
  const creates = args.entries
    .filter((e) => e.action === 'create')
    .sort((a, b) => depthOf(a.entity.path) - depthOf(b.entity.path));

  for (const entry of creates) {
    const folder = entry.entity;
    const parent = args.tree.parentOf(folder.path);
    if (!parent) continue; // unresolvable parent — same skip the reseed applies
    const segment = lastPathSegment(folder.path);
    const intent = args.buildCreate(
      {
        folderUid: folder.uid,
        parent,
        name: folder.name,
        ...(segment ? { pathSegment: segment } : {}),
        orderKey: args.tail(parent, args.childrenPath, folder.uid),
      },
      args.deps.nextCtx(),
    );
    out.push(intentBatch(`${args.tree.kinds.folderType}:${folder.uid} (create)`, intent));
  }

  // Update collisions carry the folder's own scalar state only — parent
  // linkage and sibling order live on the parent slot and are not part
  // of an import update's contract (matched folders share a position).
  for (const entry of args.entries) {
    if (entry.action !== 'update') continue;
    const prevEntity = prevByUid.get(entry.entity.uid);
    if (!prevEntity) continue; // handled as create above only when action says so
    if (prevEntity.name !== entry.entity.name) {
      const folderType = args.tree.kinds.folderType;
      out.push(
        bodiesBatch(
          `${folderType}:${entry.entity.uid} (rename)`,
          [{ kind: 'setField', type: folderType, id: entry.entity.uid, path: 'name', value: entry.entity.name }],
          args.deps.nextCtx(),
        ),
      );
    }
  }
}

const depthOf = (path: string): number => path.split('/').length;

// ── Environments ───────────────────────────────────────────────────

const ENVIRONMENT_SKIP = new Set(['uid', 'path', 'variables']);

function emitEnvironments(
  out: EmissionBatch[],
  entries: PlanEntry<Environment>[],
  prevItems: readonly Environment[],
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entry of entries) {
    if (entry.action === 'skip') continue;
    const uid = entry.entity.uid;
    const prevEntity = entry.action === 'update' ? prevByUid.get(uid) : undefined;
    if (entry.action === 'create' || !prevEntity) {
      out.push(seedBatch(`environment:${uid} (create)`, seedEnvironment(entry.entity, deps.nextCtx())));
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as unknown as Record<string, unknown>,
      entry.entity as unknown as Record<string, unknown>,
      ENVIRONMENT_SKIP,
    );
    const bodies: MutationBody[] = [];
    for (const [key, value] of Object.entries(updates)) {
      bodies.push({ kind: 'setField', type: ENVIRONMENT_ENTITY_TYPE, id: uid, path: key, value });
    }
    for (const key of removedKeys) {
      bodies.push({ kind: 'unsetField', type: ENVIRONMENT_ENTITY_TYPE, id: uid, path: key });
    }
    if (changed(prevEntity.variables, entry.entity.variables)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: ENVIRONMENT_ENTITY_TYPE,
          id: uid,
          path: ENV_VARS_PATH,
          live: deps.liveSetEntries(ENVIRONMENT_ENTITY_TYPE, uid, ENV_VARS_PATH),
          newItems: entry.entity.variables,
        }),
      );
    }
    if (bodies.length > 0) out.push(bodiesBatch(`environment:${uid} (update)`, bodies, deps.nextCtx()));
  }
}

// ── Specs ──────────────────────────────────────────────────────────

const SPEC_SKIP = new Set(['uid', 'path', 'files']);

function emitSpecs(
  out: EmissionBatch[],
  entries: PlanEntry<Spec>[],
  prevItems: readonly Spec[],
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entry of entries) {
    if (entry.action === 'skip') continue;
    const uid = entry.entity.uid;
    const prevEntity = entry.action === 'update' ? prevByUid.get(uid) : undefined;
    if (entry.action === 'create' || !prevEntity) {
      out.push(seedBatch(`spec:${uid} (create)`, seedSpec(entry.entity, deps.nextCtx())));
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as unknown as Record<string, unknown>,
      entry.entity as unknown as Record<string, unknown>,
      SPEC_SKIP,
    );
    const bodies: MutationBody[] = [];
    for (const [key, value] of Object.entries(updates)) {
      bodies.push({ kind: 'setField', type: SPEC_ENTITY_TYPE, id: uid, path: key, value });
    }
    for (const key of removedKeys) {
      bodies.push({ kind: 'unsetField', type: SPEC_ENTITY_TYPE, id: uid, path: key });
    }
    if (changed(prevEntity.files, entry.entity.files)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: SPEC_ENTITY_TYPE,
          id: uid,
          path: SPEC_FILES_PATH,
          live: deps.liveSetEntries(SPEC_ENTITY_TYPE, uid, SPEC_FILES_PATH),
          newItems: entry.entity.files,
        }),
      );
    }
    if (bodies.length > 0) out.push(bodiesBatch(`spec:${uid} (update)`, bodies, deps.nextCtx()));
  }
}

// ── Singletons ─────────────────────────────────────────────────────

function emitVariablesSingleton(
  out: EmissionBatch[],
  finalVariables: Variable[] | null,
  prevSingleton: WorkspaceVariables | undefined,
  deps: ImportEmissionDeps,
): void {
  if (!finalVariables) return;
  if (!prevSingleton) {
    out.push(
      seedBatch(
        'workspace-variables (create)',
        seedWorkspaceVariables({ schemaVersion: 5, variables: finalVariables }, deps.nextCtx()),
      ),
    );
    return;
  }
  if (!changed(prevSingleton.variables, finalVariables)) return;
  const bodies = synthesizeSetDiff({
    type: WORKSPACE_VARIABLES_ENTITY_TYPE,
    id: WORKSPACE_VARIABLES_ID,
    path: WORKSPACE_VARIABLES_PATH,
    live: deps.liveSetEntries(WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_ID, WORKSPACE_VARIABLES_PATH),
    newItems: finalVariables,
  });
  if (bodies.length > 0) out.push(bodiesBatch('workspace-variables (update)', bodies, deps.nextCtx()));
}

function emitVaultSingleton(
  out: EmissionBatch[],
  finalSecrets: VaultSecret[] | null,
  prevSingleton: Vault | undefined,
  deps: ImportEmissionDeps,
): void {
  if (!finalSecrets) return;
  if (!prevSingleton) {
    out.push(seedBatch('vault (create)', seedVault({ schemaVersion: 5, secrets: finalSecrets }, deps.nextCtx())));
    return;
  }
  if (!changed(prevSingleton.secrets, finalSecrets)) return;
  const bodies = synthesizeSetDiff({
    type: VAULT_ENTITY_TYPE,
    id: VAULT_ID,
    path: VAULT_PATH,
    live: deps.liveSetEntries(VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH),
    newItems: finalSecrets,
  });
  if (bodies.length > 0) out.push(bodiesBatch('vault (update)', bodies, deps.nextCtx()));
}

function emitTrustedRootsSingleton(
  out: EmissionBatch[],
  finalRoots: TrustedRoot[] | null,
  prevSingleton: TrustedRoots | undefined,
  deps: ImportEmissionDeps,
): void {
  if (!finalRoots) return;
  if (!prevSingleton) {
    out.push(
      seedBatch('trusted-roots (create)', seedTrustedRoots({ schemaVersion: 5, roots: finalRoots }, deps.nextCtx())),
    );
    return;
  }
  if (!changed(prevSingleton.roots, finalRoots)) return;
  const bodies = synthesizeSetDiff({
    type: TRUSTED_ROOTS_ENTITY_TYPE,
    id: TRUSTED_ROOTS_ID,
    path: TRUSTED_ROOTS_PATH,
    live: deps.liveSetEntries(TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH),
    newItems: finalRoots,
  });
  if (bodies.length > 0) out.push(bodiesBatch('trusted-roots (update)', bodies, deps.nextCtx()));
}
