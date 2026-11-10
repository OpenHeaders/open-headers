/**
 * commit-change — one commit's OWN change laid over the workspace as
 * the branch holds it now (the state behind Cherry-Pick and Revert).
 *
 * A pull makes every entity the foreign side touched take the foreign
 * document whole; a picked commit must not — it carries only what that
 * one commit did. So the change is read as two trees (`from` → `to`:
 * the commit's parent and the commit for a pick, the two swapped for a
 * revert) and laid over the engine's snapshot entity by entity:
 *
 *   created by the change   → lands under the parent the branch holds
 *                             (skipped when the branch has no such
 *                             parent);
 *   edited by the change    → the keys it touched, over the branch's
 *                             entity (`three-way-patch.ts`); skipped
 *                             when the branch no longer has the entity;
 *   moved by the change     → follows to the same parent on the branch,
 *                             and everything the branch keeps beneath a
 *                             moved container follows it;
 *   deleted by the change   → leaves, unless it is a container the
 *                             branch still keeps something in.
 *
 * The result is the tree delta's input: `next` beside the manifests the
 * change touched (`changedPaths`) and removed (`removedPaths`), with
 * the engine's snapshot as its `prev`. Pure — the caller reads the two
 * trees and applies the delta.
 *
 * A document both sides changed is named in `conflicts`. The caller may
 * answer it (`resolved`): the document as a person resolved it stands
 * where the patch would have, or the change's deletion of it is taken.
 */

import { canonicalJson } from '../sync';
import type { Environment } from '../types/variable';
import type { WorkspaceManifest } from '../types/workspace';
import { lastPathSegment, parentPathOf } from '../utils/workspace';
import {
  COLLECTION_MANIFEST_FILE,
  environmentFilePath,
  FOLDER_MANIFEST_FILE,
  GRAPHQL_REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  MQTT_REQUEST_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SPEC_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  TRUSTED_ROOTS_DOC_KEY,
  TRUSTED_ROOTS_FILE,
  VAULT_DOC_KEY,
  VAULT_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
import { type PatchTally, patchRecord, type Row } from './three-way-patch';
import type { TreeReadResult, WorkspaceTreeState } from './types';

type TreeState = TreeReadResult['state'];

export interface CommitChangeArgs {
  /** The engine's snapshot — the branch as it stands. */
  current: WorkspaceTreeState;
  /** The tree the change starts from: the commit's parent for a pick, the commit for a revert. */
  from: TreeState;
  /** The tree the change ends at. */
  to: TreeState;
  /** Answers to documents both sides changed — absent on the first pass. */
  resolved?: CommitChangeResolved;
  /**
   * The files the change removed, when the caller has them (a diff of
   * the change's two commits). A document `from` holds and `to` lacks is
   * then deleted only where its file is among them — one that merely did
   * not read on the `to` side stands as the branch holds it. Absent =
   * every document `to` lacks is deleted.
   */
  removedPaths?: ReadonlySet<string>;
}

/** Documents resolved by hand, taken in place of the patch (`commit-conflicts.ts` reads them). */
export interface CommitChangeResolved {
  /** A tree holding the resolved documents, each entity at its path on the branch. */
  state: TreeState;
  /** The uids (a singleton's doc key) whose value in `state` is the answer. */
  documents: ReadonlySet<string>;
  /** The uids answered as gone — the change's deletion of a document the branch edited is taken. */
  removed: ReadonlySet<string>;
}

/** One document of the change: its entity uid (a singleton's doc key) and its manifest path in the change. */
export interface CommitChangeDocument {
  uid: string;
  path: string;
}

export type CommitChangeSkipReason =
  /** The change edits an entity the branch no longer has. */
  | 'missing'
  /** The change creates or moves an entity under a container the branch does not have. */
  | 'parent-missing'
  /** The change deletes a container the branch still keeps something in. */
  | 'not-empty'
  /**
   * Both sides changed the document where none of its files shows it (a
   * secret row's name) — there is nothing to answer, the branch's stands.
   * Named by the caller that builds the conflict texts, never by the model.
   */
  | 'conflict-unshown';

export interface CommitChangeSkip extends CommitChangeDocument {
  reason: CommitChangeSkipReason;
}

export interface CommitChange {
  /** `current` with the change laid over it — the tree delta's `next`. */
  next: TreeState;
  /** Manifests of the entities the change created, edited or moved, at their paths in `next`. */
  changedPaths: Set<string>;
  /** Manifests of the entities the change deleted, at their paths in `current`. */
  removedPaths: Set<string>;
  /** Documents where the branch and the change both changed one value — the change's value stands in `next`. */
  conflicts: CommitChangeDocument[];
  /** Parts of the change that were not taken. */
  skipped: CommitChangeSkip[];
}

interface PathEntity extends Row {
  uid: string;
  path: string;
}

interface Pass {
  changedPaths: Set<string>;
  removedPaths: Set<string>;
  conflicts: CommitChangeDocument[];
  skipped: CommitChangeSkip[];
  /** A container's path in the change's end tree → its path in `next`. */
  containerAt: Map<string, string>;
  /** Containers the change moved: the path the branch held → the path in `next`. */
  moved: Map<string, string>;
  /** Uids answered with a document, and uids answered as gone. */
  answered: ReadonlySet<string>;
  answeredGone: ReadonlySet<string>;
  /** Whether the change removed the document at this path — false for one that only failed to read. */
  removed: (path: string) => boolean;
}

interface Family<T extends PathEntity> {
  manifest: string;
  container: boolean;
  from: readonly T[];
  to: readonly T[];
  /** The family as it will stand, by uid — the branch's entities first, in their order. */
  next: Map<string, T>;
  /** The family in the resolved tree, by uid. */
  resolved: Map<string, T>;
}

const differs = (a: unknown, b: unknown): boolean => canonicalJson(a) !== canonicalJson(b);

const depthOf = (path: string): number => path.split('/').length;

const NO_SKIP: ReadonlySet<string> = new Set();

/** `path` is the caller's: a moved entity is re-homed against the branch's containers, never copied. */
const ENTITY_SKIP: ReadonlySet<string> = new Set(['uid', 'path']);

function byUid<T extends { uid: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.uid, item] as const));
}

/** `current` patched by the change, noting the document when both sides changed one value. */
function patched<T extends Row>(current: T, from: T | undefined, to: T, document: CommitChangeDocument, pass: Pass): T {
  const tally: PatchTally = { overridden: 0 };
  const out = patchRecord(current, from, to, ENTITY_SKIP, tally);
  if (tally.overridden > 0) pass.conflicts.push(document);
  return out;
}

/**
 * Where a path of the change's end tree lands on the branch: the same
 * directory name under the parent container as `next` holds it. A
 * direct child of a tree root keeps its path; null when the branch has
 * no such parent.
 */
function rehome(toPath: string, pass: Pass): string | null {
  const parent = parentPathOf(toPath);
  const segment = lastPathSegment(toPath);
  if (parent === null || segment === null || !parent.includes('/')) return toPath;
  const landed = pass.containerAt.get(parent);
  return landed === undefined ? null : `${landed}/${segment}`;
}

function family<T extends PathEntity>(
  manifest: string,
  container: boolean,
  current: readonly T[],
  from: readonly T[],
  to: readonly T[],
  resolved: readonly T[] | undefined,
): Family<T> {
  return { manifest, container, from, to, next: byUid(current), resolved: byUid(resolved ?? []) };
}

/** The document as resolved by hand, when the caller answered this uid with one. */
function answerOf<T extends { uid: string }>(resolved: ReadonlyMap<string, T>, uid: string, pass: Pass): T | undefined {
  return pass.answered.has(uid) ? resolved.get(uid) : undefined;
}

/** Creations, edits and moves — parents before children, so a child re-homes against a settled parent. */
function layOver<T extends PathEntity>(group: Family<T>, pass: Pass): void {
  const fromByUid = byUid(group.from);
  for (const after of [...group.to].sort((a, b) => depthOf(a.path) - depthOf(b.path))) {
    const document = { uid: after.uid, path: `${after.path}/${group.manifest}` };
    const before = fromByUid.get(after.uid);
    const mine = group.next.get(after.uid);
    if (mine === undefined) {
      if (before !== undefined) {
        if (differs(before, after)) pass.skipped.push({ ...document, reason: 'missing' });
        continue;
      }
      const path = rehome(after.path, pass);
      if (path === null) {
        pass.skipped.push({ ...document, reason: 'parent-missing' });
        continue;
      }
      group.next.set(after.uid, { ...after, path });
      pass.changedPaths.add(`${path}/${group.manifest}`);
    } else if (differs(before, after)) {
      const relocated = before !== undefined && before.path !== after.path;
      const destination = relocated ? rehome(after.path, pass) : mine.path;
      if (destination === null) pass.skipped.push({ ...document, reason: 'parent-missing' });
      const answer = answerOf(group.resolved, after.uid, pass);
      const landed = { ...(answer ?? patched(mine, before, after, document, pass)), path: destination ?? mine.path };
      if (differs(mine, landed)) {
        group.next.set(after.uid, landed);
        pass.changedPaths.add(`${landed.path}/${group.manifest}`);
        if (group.container && landed.path !== mine.path) pass.moved.set(mine.path, landed.path);
      }
    }
    const settled = group.next.get(after.uid);
    if (group.container && settled !== undefined) pass.containerAt.set(after.path, settled.path);
  }
}

/** What the branch keeps beneath a container the change moved follows it — the change's end tree does not know it. */
function follow<T extends PathEntity>(group: Family<T>, pass: Pass): void {
  if (pass.moved.size === 0) return;
  const known = new Set(group.to.map((entity) => entity.uid));
  for (const [uid, entity] of group.next) {
    if (known.has(uid)) continue;
    let prefix: string | null = null;
    for (const old of pass.moved.keys()) {
      if (entity.path.startsWith(`${old}/`) && (prefix === null || old.length > prefix.length)) prefix = old;
    }
    if (prefix === null) continue;
    const path = `${pass.moved.get(prefix)}${entity.path.slice(prefix.length)}`;
    group.next.set(uid, { ...entity, path });
    pass.changedPaths.add(`${path}/${group.manifest}`);
  }
}

/** Deletions — deepest first; a container leaves only when nothing of the branch is left beneath it. */
function withdraw<T extends PathEntity>(group: Family<T>, pass: Pass, occupied: (path: string) => boolean): void {
  const kept = new Set(group.to.map((entity) => entity.uid));
  const leaving = group.from
    .filter(
      (before) =>
        !kept.has(before.uid) && group.next.has(before.uid) && pass.removed(`${before.path}/${group.manifest}`),
    )
    .sort((a, b) => depthOf(b.path) - depthOf(a.path));
  for (const before of leaving) {
    const mine = group.next.get(before.uid);
    if (mine === undefined) continue;
    const document = { uid: before.uid, path: `${before.path}/${group.manifest}` };
    const answer = answerOf(group.resolved, before.uid, pass);
    if (answer !== undefined) {
      // Answered as kept: the document stays, as resolved.
      const kept = { ...answer, path: mine.path };
      if (differs(mine, kept)) {
        group.next.set(before.uid, kept);
        pass.changedPaths.add(`${mine.path}/${group.manifest}`);
      }
      continue;
    }
    if (group.container && occupied(mine.path)) {
      pass.skipped.push({ ...document, reason: 'not-empty' });
      continue;
    }
    if (!pass.answeredGone.has(before.uid) && differs({ ...mine, path: before.path }, before)) {
      pass.conflicts.push(document);
    }
    group.next.delete(before.uid);
    pass.removedPaths.add(`${mine.path}/${group.manifest}`);
  }
}

/** Environments have no directory of their own — the file is named after the entity. */
function layOverEnvironments(
  current: readonly Environment[],
  from: readonly Environment[],
  to: readonly Environment[],
  resolved: readonly Environment[] | undefined,
  pass: Pass,
): Environment[] {
  const answers = byUid(resolved ?? []);
  const next = byUid(current);
  const fromByUid = byUid(from);
  const kept = new Set(to.map((environment) => environment.uid));
  for (const after of to) {
    const document = { uid: after.uid, path: environmentFilePath(after) };
    const before = fromByUid.get(after.uid);
    const mine = next.get(after.uid);
    if (mine === undefined) {
      if (before === undefined) {
        next.set(after.uid, after);
        pass.changedPaths.add(document.path);
      } else if (differs(before, after)) {
        pass.skipped.push({ ...document, reason: 'missing' });
      }
    } else if (differs(before, after)) {
      const landed = answerOf(answers, after.uid, pass) ?? patched(mine, before, after, document, pass);
      if (differs(mine, landed)) {
        next.set(after.uid, landed);
        pass.changedPaths.add(environmentFilePath(landed));
      }
    }
  }
  for (const before of from) {
    const mine = next.get(before.uid);
    if (kept.has(before.uid) || mine === undefined || !pass.removed(environmentFilePath(before))) continue;
    const answer = answerOf(answers, before.uid, pass);
    if (answer !== undefined) {
      if (differs(mine, answer)) {
        next.set(before.uid, answer);
        pass.changedPaths.add(environmentFilePath(answer));
      }
      continue;
    }
    if (!pass.answeredGone.has(before.uid) && differs(mine, before)) {
      pass.conflicts.push({ uid: before.uid, path: environmentFilePath(before) });
    }
    next.delete(before.uid);
    pass.removedPaths.add(environmentFilePath(mine));
  }
  return [...next.values()];
}

/** A root singleton document: patched when the change edited it, emptied when the change removed its file. */
function layOverSingleton<T extends Row>(
  current: T | null,
  from: T | null,
  to: T | null,
  resolved: T | null | undefined,
  document: CommitChangeDocument,
  pass: Pass,
): T | null {
  if (!differs(from, to)) return current;
  if (to === null) {
    if (!pass.removed(document.path)) return current;
    if (current !== null) pass.removedPaths.add(document.path);
    return null;
  }
  pass.changedPaths.add(document.path);
  if (current === null) return to;
  const answer = pass.answered.has(document.uid) ? (resolved ?? null) : null;
  return answer ?? patched(current, from ?? undefined, to, document, pass);
}

/** The manifest's roots order — the one part of `workspace.yaml` the entity plane reads. */
function layOverRootOrder(
  current: WorkspaceManifest,
  from: WorkspaceManifest | null,
  to: WorkspaceManifest | null,
  pass: Pass,
): WorkspaceManifest {
  if (from === null || to === null || !differs(from.order, to.order)) return current;
  const order = patchRecord(current.order ?? {}, from.order ?? {}, to.order ?? {}, NO_SKIP, { overridden: 0 });
  pass.changedPaths.add(WORKSPACE_MANIFEST_FILE);
  return { ...current, order };
}

export function applyCommitChange(args: CommitChangeArgs): CommitChange {
  const { current, from, to } = args;
  const answers = args.resolved?.state;
  const pass: Pass = {
    changedPaths: new Set(),
    removedPaths: new Set(),
    conflicts: [],
    skipped: [],
    containerAt: new Map(),
    moved: new Map(),
    answered: args.resolved?.documents ?? new Set(),
    answeredGone: args.resolved?.removed ?? new Set(),
    removed: (path) => args.removedPaths?.has(path) ?? true,
  };

  const collections = family(
    COLLECTION_MANIFEST_FILE,
    true,
    current.collections,
    from.collections,
    to.collections,
    answers?.collections,
  );
  const requestCollections = family(
    COLLECTION_MANIFEST_FILE,
    true,
    current.requestCollections,
    from.requestCollections,
    to.requestCollections,
    answers?.requestCollections,
  );
  const templateCollections = family(
    COLLECTION_MANIFEST_FILE,
    true,
    current.templateCollections,
    from.templateCollections,
    to.templateCollections,
    answers?.templateCollections,
  );
  const folders = family(FOLDER_MANIFEST_FILE, true, current.folders, from.folders, to.folders, answers?.folders);
  const requestFolders = family(
    FOLDER_MANIFEST_FILE,
    true,
    current.requestFolders,
    from.requestFolders,
    to.requestFolders,
    answers?.requestFolders,
  );
  const templateFolders = family(
    FOLDER_MANIFEST_FILE,
    true,
    current.templateFolders,
    from.templateFolders,
    to.templateFolders,
    answers?.templateFolders,
  );
  const rules = family(RULE_MANIFEST_FILE, false, current.rules, from.rules, to.rules, answers?.rules);
  const requests = family(
    REQUEST_MANIFEST_FILE,
    false,
    current.requests,
    from.requests,
    to.requests,
    answers?.requests,
  );
  const grpcRequests = family(
    GRPC_REQUEST_MANIFEST_FILE,
    false,
    current.grpcRequests,
    from.grpcRequests,
    to.grpcRequests,
    answers?.grpcRequests,
  );
  const websocketRequests = family(
    WEBSOCKET_REQUEST_MANIFEST_FILE,
    false,
    current.websocketRequests,
    from.websocketRequests,
    to.websocketRequests,
    answers?.websocketRequests,
  );
  const mqttRequests = family(
    MQTT_REQUEST_MANIFEST_FILE,
    false,
    current.mqttRequests,
    from.mqttRequests,
    to.mqttRequests,
    answers?.mqttRequests,
  );
  const graphqlRequests = family(
    GRAPHQL_REQUEST_MANIFEST_FILE,
    false,
    current.graphqlRequests,
    from.graphqlRequests,
    to.graphqlRequests,
    answers?.graphqlRequests,
  );
  const templates = family(
    TEMPLATE_MANIFEST_FILE,
    false,
    current.templates,
    from.templates,
    to.templates,
    answers?.templates,
  );
  const specs = family(SPEC_MANIFEST_FILE, false, current.specs, from.specs, to.specs, answers?.specs);
  const liveWorkflows = family(
    LIVE_WORKFLOW_MANIFEST_FILE,
    false,
    current.liveWorkflows,
    from.liveWorkflows,
    to.liveWorkflows,
    answers?.liveWorkflows,
  );
  const liveVariables = family(
    LIVE_VARIABLE_MANIFEST_FILE,
    false,
    current.liveVariables,
    from.liveVariables,
    to.liveVariables,
    answers?.liveVariables,
  );

  // Containers settle before what they hold: collections, then folders
  // (parents first inside the family), then the leaves.
  layOver(collections, pass);
  layOver(requestCollections, pass);
  layOver(templateCollections, pass);
  layOver(folders, pass);
  layOver(requestFolders, pass);
  layOver(templateFolders, pass);
  layOver(rules, pass);
  layOver(requests, pass);
  layOver(grpcRequests, pass);
  layOver(websocketRequests, pass);
  layOver(mqttRequests, pass);
  layOver(graphqlRequests, pass);
  layOver(templates, pass);
  layOver(specs, pass);
  layOver(liveWorkflows, pass);
  layOver(liveVariables, pass);

  follow(folders, pass);
  follow(requestFolders, pass);
  follow(templateFolders, pass);
  follow(rules, pass);
  follow(requests, pass);
  follow(grpcRequests, pass);
  follow(websocketRequests, pass);
  follow(mqttRequests, pass);
  follow(graphqlRequests, pass);
  follow(templates, pass);

  // Deletions run the other way — leaves, then folders, then
  // collections — so a container is judged by what is left in it.
  const residents: ReadonlyArray<ReadonlyMap<string, PathEntity>> = [
    folders.next,
    requestFolders.next,
    templateFolders.next,
    rules.next,
    requests.next,
    grpcRequests.next,
    websocketRequests.next,
    mqttRequests.next,
    graphqlRequests.next,
    templates.next,
  ];
  const occupied = (path: string): boolean =>
    residents.some((group) => [...group.values()].some((entity) => entity.path.startsWith(`${path}/`)));
  withdraw(rules, pass, occupied);
  withdraw(requests, pass, occupied);
  withdraw(grpcRequests, pass, occupied);
  withdraw(websocketRequests, pass, occupied);
  withdraw(mqttRequests, pass, occupied);
  withdraw(graphqlRequests, pass, occupied);
  withdraw(templates, pass, occupied);
  withdraw(specs, pass, occupied);
  withdraw(liveWorkflows, pass, occupied);
  withdraw(liveVariables, pass, occupied);
  withdraw(folders, pass, occupied);
  withdraw(requestFolders, pass, occupied);
  withdraw(templateFolders, pass, occupied);
  withdraw(collections, pass, occupied);
  withdraw(requestCollections, pass, occupied);
  withdraw(templateCollections, pass, occupied);

  const next: TreeState = {
    workspace: layOverRootOrder(current.workspace, from.workspace, to.workspace, pass),
    rules: [...rules.next.values()],
    collections: [...collections.next.values()],
    folders: [...folders.next.values()],
    requests: [...requests.next.values()],
    grpcRequests: [...grpcRequests.next.values()],
    websocketRequests: [...websocketRequests.next.values()],
    mqttRequests: [...mqttRequests.next.values()],
    graphqlRequests: [...graphqlRequests.next.values()],
    requestCollections: [...requestCollections.next.values()],
    requestFolders: [...requestFolders.next.values()],
    templates: [...templates.next.values()],
    templateCollections: [...templateCollections.next.values()],
    templateFolders: [...templateFolders.next.values()],
    environments: layOverEnvironments(
      current.environments,
      from.environments,
      to.environments,
      answers?.environments,
      pass,
    ),
    workspaceVariables: layOverSingleton(
      current.workspaceVariables,
      from.workspaceVariables,
      to.workspaceVariables,
      answers?.workspaceVariables,
      { uid: WORKSPACE_VARS_DOC_KEY, path: WORKSPACE_VARS_FILE },
      pass,
    ),
    vault: layOverSingleton(
      current.vault,
      from.vault,
      to.vault,
      answers?.vault,
      { uid: VAULT_DOC_KEY, path: VAULT_FILE },
      pass,
    ),
    trustedRoots: layOverSingleton(
      current.trustedRoots,
      from.trustedRoots,
      to.trustedRoots,
      answers?.trustedRoots,
      { uid: TRUSTED_ROOTS_DOC_KEY, path: TRUSTED_ROOTS_FILE },
      pass,
    ),
    specs: [...specs.next.values()],
    liveWorkflows: [...liveWorkflows.next.values()],
    liveVariables: [...liveVariables.next.values()],
  };

  return {
    next,
    changedPaths: pass.changedPaths,
    removedPaths: pass.removedPaths,
    conflicts: pass.conflicts,
    skipped: pass.skipped,
  };
}
