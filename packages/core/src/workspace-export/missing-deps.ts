/**
 * Missing-deps walk — gates 7 + 8 of the import validation pipeline
 * (design §4.1). Pure function, runs after `parse.ts` and before the
 * preview modal renders.
 *
 * Two passes:
 *   • **Reference integrity** — walks `Rule.collectionId` /
 *     `Rule.folderId`, `WorkflowStep.requestUid`, and
 *     `LiveVariable.workflowUid` against the union of incoming export
 *     entities + the target workspace's existing entities. Every
 *     unresolved reference becomes a `MissingDep` row.
 *   • **Variable-reference scan** — every `{{env.X}}`, `{{secret.X}}`,
 *     `{{live.X}}`, `{{collection.X}}`, `{{workspace.X}}` reference
 *     inside conditions / actions / request bodies / live-workflow
 *     steps is parsed via the production template parser
 *     (`scanTemplateReferencesMany`). Names that don't resolve in the
 *     union of export + target environment vars / vault / live
 *     variables / collection vars / workspace vars surface as
 *     `MissingDep` rows.
 *
 * Informational only — never rejects the import. The preview modal
 * renders the list so the user can cancel, proceed (rules import as
 * broken bindings; auto-rebind once the missing entity appears), or
 * (in PR 5) expand the export's selection scope to auto-include the
 * missing deps.
 */

import * as v from 'valibot';
import { scanTemplateReferencesMany } from '../live/template-scan';
import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Vault,
  WorkspaceVariables,
} from '../types/index';
import type { TargetWorkspaceState } from './diff';
import type { WorkspaceExport } from './schema';

// ── Schema ─────────────────────────────────────────────────────────

export const MISSING_DEP_TYPES = [
  'env',
  'workflow',
  'collection',
  'workspace-var',
  'secret',
  'request',
  'folder',
] as const;
export const MissingDepTypeSchema = v.picklist(MISSING_DEP_TYPES);
export type MissingDepType = v.InferOutput<typeof MissingDepTypeSchema>;

/**
 * A reference inside an imported entity that didn't resolve at import
 * time. `referencedBy` is a list of "<entityType>:<uid>" pointers so
 * the detail panel can walk to the affected entities.
 */
export const MissingDepSchema = v.object({
  type: MissingDepTypeSchema,
  name: v.string(),
  referencedBy: v.array(v.string()),
});
export type MissingDep = v.InferOutput<typeof MissingDepSchema>;

// ── Helpers ────────────────────────────────────────────────────────

function entityRef(type: string, uid: string): string {
  return `${type}:${uid}`;
}

interface NameResolver {
  has(name: string): boolean;
}

interface UidResolver {
  has(uid: string): boolean;
}

function namesOf<T extends { name: string }>(...lists: readonly T[][]): NameResolver {
  const set = new Set<string>();
  for (const list of lists) for (const item of list) set.add(item.name);
  return {
    has: (name) => set.has(name),
  };
}

function uidsOf<T extends { uid: string }>(...lists: readonly T[][]): UidResolver {
  const set = new Set<string>();
  for (const list of lists) for (const item of list) set.add(item.uid);
  return {
    has: (uid) => set.has(uid),
  };
}

/** Collect every string-valued field of `value` (deep). */
function collectStrings(value: unknown, out: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
}

// ── Add-or-merge a missing-dep row ─────────────────────────────────

function addDep(acc: Map<string, MissingDep>, type: MissingDep['type'], name: string, referencedBy: string): void {
  const key = `${type}:${name}`;
  const existing = acc.get(key);
  if (existing) {
    if (!existing.referencedBy.includes(referencedBy)) existing.referencedBy.push(referencedBy);
    return;
  }
  acc.set(key, { type, name, referencedBy: [referencedBy] });
}

// ── Variable-reference scan over an entity ─────────────────────────

interface UnionResolvers {
  env: NameResolver;
  vault: NameResolver;
  workspaceVar: NameResolver;
  collectionVar: NameResolver;
  liveVariable: NameResolver;
}

/**
 * Walk a single entity's stringy fields and append unresolved variable
 * references to the missing-deps accumulator.
 */
function walkVariableRefs(
  ref: string,
  strings: readonly string[],
  resolvers: UnionResolvers,
  acc: Map<string, MissingDep>,
): void {
  if (strings.length === 0) return;
  const result = scanTemplateReferencesMany(strings);

  for (const name of result.live) {
    if (!resolvers.liveVariable.has(name)) addDep(acc, 'workflow', name, ref);
  }
  for (const r of result.other) {
    if (r.namespace === 'env') {
      if (!resolvers.env.has(r.name)) addDep(acc, 'env', r.name, ref);
    } else if (r.namespace === 'vault') {
      if (!resolvers.vault.has(r.name)) addDep(acc, 'secret', r.name, ref);
    } else if (r.namespace === 'workspace') {
      if (!resolvers.workspaceVar.has(r.name)) addDep(acc, 'workspace-var', r.name, ref);
    } else if (r.namespace === 'collection') {
      if (!resolvers.collectionVar.has(r.name)) addDep(acc, 'workspace-var', r.name, ref);
    }
    // `file` / `dynamic` / `step` / null — not flagged here.
  }
}

// ── Resolver construction (export ∪ target) ────────────────────────

function buildEnvResolver(exportEnvs: Environment[], targetEnvs: Environment[]): NameResolver {
  const set = new Set<string>();
  for (const env of [...exportEnvs, ...targetEnvs]) {
    for (const v of env.variables ?? []) set.add(v.name);
  }
  return { has: (name) => set.has(name) };
}

function buildVaultResolver(exportVault: Vault | undefined, targetVault: Vault | undefined): NameResolver {
  const set = new Set<string>();
  for (const v of exportVault?.secrets ?? []) set.add(v.name);
  for (const v of targetVault?.secrets ?? []) set.add(v.name);
  return { has: (name) => set.has(name) };
}

function buildWorkspaceVarResolver(
  exportVars: WorkspaceVariables | undefined,
  targetVars: WorkspaceVariables | undefined,
): NameResolver {
  const set = new Set<string>();
  for (const v of exportVars?.variables ?? []) set.add(v.name);
  for (const v of targetVars?.variables ?? []) set.add(v.name);
  return { has: (name) => set.has(name) };
}

function buildLiveVariableResolver(exportLVs: LiveVariable[], targetLVs: LiveVariable[]): NameResolver {
  return namesOf<LiveVariable>(exportLVs, targetLVs);
}

// Collection-variables live inside Collection.variables (when present).
// The existing schema treats them as Variable[] keyed off the collection.
// We resolve `{{collection.X}}` against the union of every collection's
// variables across export + target — same as Postman-style behavior.
function buildCollectionVarResolver(exportCols: Collection[], targetCols: Collection[]): NameResolver {
  const set = new Set<string>();
  type WithVars = Collection & { variables?: { name: string }[] };
  for (const c of [...exportCols, ...targetCols] as WithVars[]) {
    for (const v of c.variables ?? []) set.add(v.name);
  }
  return { has: (name) => set.has(name) };
}

// ── Reference-integrity (uid pointers) ─────────────────────────────

function walkContainerRefs(
  rules: Rule[],
  collectionUids: UidResolver,
  folderUids: UidResolver,
  collectionsByUid: Map<string, Collection>,
  foldersByUid: Map<string, Folder>,
  acc: Map<string, MissingDep>,
): void {
  for (const rule of rules) {
    const r = rule as Rule & { collectionId?: string; folderId?: string };
    if (r.collectionId && !collectionUids.has(r.collectionId)) {
      const name = collectionsByUid.get(r.collectionId)?.name ?? r.collectionId;
      addDep(acc, 'collection', name, entityRef('rules', rule.uid));
    }
    if (r.folderId && !folderUids.has(r.folderId)) {
      const name = foldersByUid.get(r.folderId)?.name ?? r.folderId;
      addDep(acc, 'folder', name, entityRef('rules', rule.uid));
    }
  }
}

function walkWorkflowSteps(
  workflows: LiveWorkflow[],
  requestUids: UidResolver,
  requestsByUid: Map<string, Request>,
  acc: Map<string, MissingDep>,
): void {
  for (const wf of workflows) {
    for (const step of wf.steps) {
      if (!requestUids.has(step.requestUid)) {
        const name = requestsByUid.get(step.requestUid)?.name ?? step.requestUid;
        addDep(acc, 'request', name, entityRef('liveWorkflows', wf.uid));
      }
    }
  }
}

function walkLiveVariables(
  liveVariables: LiveVariable[],
  workflowUids: UidResolver,
  workflowsByUid: Map<string, LiveWorkflow>,
  acc: Map<string, MissingDep>,
): void {
  for (const lv of liveVariables) {
    if (!workflowUids.has(lv.workflowUid)) {
      const name = workflowsByUid.get(lv.workflowUid)?.name ?? lv.workflowUid;
      addDep(acc, 'workflow', name, entityRef('liveVariables', lv.uid));
    }
  }
}

// ── Main entry ────────────────────────────────────────────────────

export function walkMissingDeps(incoming: WorkspaceExport, target: TargetWorkspaceState): MissingDep[] {
  const acc = new Map<string, MissingDep>();
  const e = incoming.entities;

  // ── Variable-resolution union (export ∪ target) ───────────────
  const resolvers: UnionResolvers = {
    env: buildEnvResolver(e.environments, target.environments),
    vault: buildVaultResolver(e.vault, target.vault),
    workspaceVar: buildWorkspaceVarResolver(e.workspaceVars, target.workspaceVars),
    collectionVar: buildCollectionVarResolver(e.collections, target.collections),
    liveVariable: buildLiveVariableResolver(e.liveVariables, target.liveVariables),
  };

  // ── Reference-integrity: container ids + workflow/step pointers
  const collectionUids = uidsOf<Collection>(e.collections, target.collections);
  const folderUids = uidsOf<Folder>(e.folders, target.folders);
  const requestUids = uidsOf<Request>(e.requests, target.requests);
  const workflowUids = uidsOf<LiveWorkflow>(e.liveWorkflows, target.liveWorkflows);

  const collectionsByUid = new Map<string, Collection>();
  for (const c of [...e.collections, ...target.collections]) collectionsByUid.set(c.uid, c);
  const foldersByUid = new Map<string, Folder>();
  for (const f of [...e.folders, ...target.folders]) foldersByUid.set(f.uid, f);
  const requestsByUid = new Map<string, Request>();
  for (const r of [...e.requests, ...target.requests]) requestsByUid.set(r.uid, r);
  const workflowsByUid = new Map<string, LiveWorkflow>();
  for (const w of [...e.liveWorkflows, ...target.liveWorkflows]) workflowsByUid.set(w.uid, w);

  walkContainerRefs(e.rules, collectionUids, folderUids, collectionsByUid, foldersByUid, acc);
  walkWorkflowSteps(e.liveWorkflows, requestUids, requestsByUid, acc);
  walkLiveVariables(e.liveVariables, workflowUids, workflowsByUid, acc);

  // ── Variable-reference scan: walk every entity's strings ──────
  for (const rule of e.rules) {
    const strings: string[] = [];
    collectStrings(rule.conditions, strings);
    collectStrings((rule as { action?: unknown }).action, strings);
    walkVariableRefs(entityRef('rules', rule.uid), strings, resolvers, acc);
  }
  for (const req of e.requests) {
    const strings: string[] = [];
    collectStrings(req, strings);
    walkVariableRefs(entityRef('requests', req.uid), strings, resolvers, acc);
  }
  for (const wf of e.liveWorkflows) {
    const strings: string[] = [];
    collectStrings(wf.steps, strings);
    walkVariableRefs(entityRef('liveWorkflows', wf.uid), strings, resolvers, acc);
  }

  return Array.from(acc.values());
}
