/**
 * commit-conflicts — the two ends of answering a conflicted pick by
 * hand: the texts a person compares, and the reading of what they
 * decided.
 *
 * `applyCommitChange` names the documents the change and the branch
 * both changed. A document is one entity, written as one or more files
 * (a request: its manifest, its body, its scripts). For each, the
 * files are serialized three times through the planner — at the
 * change's start (`base`), at its end (`theirs`) and as the branch
 * holds it (`mine`) — so formatting a person typed into a commit never
 * reads as a change. Only a file the change touched that also differs
 * from the branch's is shown; a file the change left alone is the
 * branch's, and one where both ends agree needs no answer.
 *
 * Where the change DELETES a document the branch edited, the manifest
 * alone is shown: an empty answer takes the deletion, any other keeps
 * the document as the branch holds it.
 *
 * The answers come back as file texts at the branch's paths. They are
 * laid over the branch's planned files and read by the tree reader —
 * the same reader a hand edit on disk goes through — into the
 * `resolved` argument of `applyCommitChange`.
 */

import type { CommitChangeDocument, CommitChangeResolved } from './commit-change';
import {
  environmentFilePath,
  TRUSTED_ROOTS_DOC_KEY,
  TRUSTED_ROOTS_FILE,
  VAULT_DOC_KEY,
  VAULT_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
import { planWorkspaceTree } from './plan';
import { readWorkspaceTree } from './read';
import type { TreeFile, TreeReadResult, WorkspaceTreeState } from './types';

type TreeState = TreeReadResult['state'];

/** One file of a conflicted document. A side that has no such file leaves its text absent. */
export interface CommitConflictFile {
  /** The file's path on the branch — the path its answer is read at. */
  path: string;
  /** The file where the change starts. */
  base?: string;
  /** The file where the change ends — absent when the change removes it, or the whole document. */
  theirs?: string;
  /** The file as the branch holds it. */
  mine?: string;
}

export interface CommitConflictDocument {
  /** The entity uid (a singleton's doc key). */
  uid: string;
  /** The document's manifest on the branch. */
  path: string;
  /** The change deletes the document; its one file decides — an empty answer takes the deletion. */
  deleted: boolean;
  /** The files to answer. Empty when the texts show nothing apart — the branch's document then stands. */
  files: CommitConflictFile[];
}

export interface CommitConflictDocumentsArgs {
  current: WorkspaceTreeState;
  from: TreeState;
  to: TreeState;
  conflicts: readonly CommitChangeDocument[];
}

/** One answered file. Content that is empty, or whitespace alone, means the file is gone. */
export interface CommitResolution {
  path: string;
  content: string;
}

export type CommitResolutionsRead =
  | { ok: true; resolved: CommitChangeResolved }
  /** `path` names the file whose answer could not be taken. */
  | { ok: false; path: string; message: string };

/** A document's files on one side, by their name inside the document. */
interface SideDocument {
  files: ReadonlyMap<string, string>;
  pathOf: (name: string) => string;
}

/** The name a one-file document (an environment, a root singleton) keeps its file under. */
const SINGLE_FILE = '';

const SINGLETON_FILES: ReadonlyArray<readonly [string, string]> = [
  [WORKSPACE_VARS_DOC_KEY, WORKSPACE_VARS_FILE],
  [VAULT_DOC_KEY, VAULT_FILE],
  [TRUSTED_ROOTS_DOC_KEY, TRUSTED_ROOTS_FILE],
];

function split(path: string): { dir: string; name: string } {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut), name: path.slice(cut + 1) };
}

/** Every entity that owns a directory of the tree. */
function directoryEntities(state: TreeState): ReadonlyArray<{ uid: string; path: string }> {
  return [
    ...state.collections,
    ...state.requestCollections,
    ...state.templateCollections,
    ...state.folders,
    ...state.requestFolders,
    ...state.templateFolders,
    ...state.rules,
    ...state.requests,
    ...state.grpcRequests,
    ...state.websocketRequests,
    ...state.mqttRequests,
    ...state.graphqlRequests,
    ...state.templates,
    ...state.specs,
    ...state.liveWorkflows,
    ...state.liveVariables,
  ];
}

/** The uids a tree holds a document for. */
function documentUids(state: TreeState): Set<string> {
  const uids = new Set<string>();
  for (const entity of directoryEntities(state)) uids.add(entity.uid);
  for (const environment of state.environments) uids.add(environment.uid);
  if (state.workspaceVariables !== null) uids.add(WORKSPACE_VARS_DOC_KEY);
  if (state.vault !== null) uids.add(VAULT_DOC_KEY);
  if (state.trustedRoots !== null) uids.add(TRUSTED_ROOTS_DOC_KEY);
  return uids;
}

/**
 * The planned files of a tree. A commit's read may lack the manifest
 * (`workspace.yaml` is not one of the documents answered here) — the
 * branch's stands in so the planner has one.
 */
function plan(state: TreeState, current: WorkspaceTreeState): TreeFile[] {
  return planWorkspaceTree({ ...state, workspace: state.workspace ?? current.workspace });
}

/** One side's documents by uid, each with its files as the planner writes them. */
function sideDocuments(state: TreeState, current: WorkspaceTreeState): Map<string, SideDocument> {
  const content = new Map<string, string>();
  const byDir = new Map<string, Map<string, string>>();
  for (const file of plan(state, current)) {
    content.set(file.path, file.content);
    const { dir, name } = split(file.path);
    const bucket = byDir.get(dir);
    if (bucket) bucket.set(name, file.content);
    else byDir.set(dir, new Map([[name, file.content]]));
  }

  const single = (path: string): SideDocument | null => {
    const text = content.get(path);
    if (text === undefined) return null;
    return { files: new Map([[SINGLE_FILE, text]]), pathOf: () => path };
  };

  const documents = new Map<string, SideDocument>();
  for (const entity of directoryEntities(state)) {
    documents.set(entity.uid, {
      files: byDir.get(entity.path) ?? new Map(),
      pathOf: (name) => `${entity.path}/${name}`,
    });
  }
  for (const environment of state.environments) {
    const document = single(environmentFilePath(environment));
    if (document !== null) documents.set(environment.uid, document);
  }
  for (const [key, path] of SINGLETON_FILES) {
    const document = single(path);
    if (document !== null) documents.set(key, document);
  }
  return documents;
}

/**
 * The files the planner writes for these documents of `state`, at their
 * paths there: a directory entity's own files, an environment's or a
 * root singleton's one file. A uid `state` holds no document for names
 * none.
 */
export function commitDocumentFiles(state: WorkspaceTreeState, uids: Iterable<string>): Set<string> {
  const documents = sideDocuments(state, state);
  const paths = new Set<string>();
  for (const uid of uids) {
    const document = documents.get(uid);
    if (document === undefined) continue;
    for (const name of document.files.keys()) paths.add(document.pathOf(name));
  }
  return paths;
}

function withText(file: CommitConflictFile, key: 'base' | 'theirs' | 'mine', text: string | undefined): void {
  if (text !== undefined) file[key] = text;
}

/** The texts of each conflicted document, at the branch's paths. */
export function commitConflictDocuments(args: CommitConflictDocumentsArgs): CommitConflictDocument[] {
  const { current, from, to, conflicts } = args;
  const mineDocuments = sideDocuments(current, current);
  const baseDocuments = sideDocuments(from, current);
  const theirsDocuments = sideDocuments(to, current);

  const out: CommitConflictDocument[] = [];
  for (const conflict of conflicts) {
    const mine = mineDocuments.get(conflict.uid);
    if (mine === undefined) continue;
    const base = baseDocuments.get(conflict.uid);
    const theirs = theirsDocuments.get(conflict.uid);
    // The conflict names its manifest in the change; a one-file document is its own manifest.
    const manifest = mine.files.has(SINGLE_FILE) ? SINGLE_FILE : split(conflict.path).name;
    const path = mine.pathOf(manifest);

    if (theirs === undefined) {
      const file: CommitConflictFile = { path };
      withText(file, 'base', base?.files.get(manifest));
      withText(file, 'mine', mine.files.get(manifest));
      out.push({ uid: conflict.uid, path, deleted: true, files: [file] });
      continue;
    }

    const names = new Set([...(base?.files.keys() ?? []), ...theirs.files.keys(), ...mine.files.keys()]);
    const ordered = [...names].sort((a, b) => (a === manifest ? -1 : b === manifest ? 1 : a < b ? -1 : a > b ? 1 : 0));
    const files: CommitConflictFile[] = [];
    for (const name of ordered) {
      const baseText = base?.files.get(name);
      const theirsText = theirs.files.get(name);
      const mineText = mine.files.get(name);
      if (baseText === theirsText || theirsText === mineText) continue;
      const file: CommitConflictFile = { path: mine.pathOf(name) };
      withText(file, 'base', baseText);
      withText(file, 'theirs', theirsText);
      withText(file, 'mine', mineText);
      files.push(file);
    }
    out.push({ uid: conflict.uid, path, deleted: false, files });
  }
  return out;
}

/**
 * Read the answers into the `resolved` argument of `applyCommitChange`.
 * Every shown file needs an answer and no other path takes one; a
 * document whose answered files do not read as that document refuses,
 * naming the file.
 */
export function readCommitResolutions(args: {
  current: WorkspaceTreeState;
  documents: readonly CommitConflictDocument[];
  resolutions: readonly CommitResolution[];
}): CommitResolutionsRead {
  const { current, documents, resolutions } = args;
  const shown = new Set(documents.flatMap((document) => document.files.map((file) => file.path)));
  const answers = new Map<string, string>();
  for (const resolution of resolutions) {
    if (!shown.has(resolution.path)) {
      return { ok: false, path: resolution.path, message: 'not a file of this conflict' };
    }
    answers.set(resolution.path, resolution.content);
  }
  for (const path of shown) {
    if (!answers.has(path)) return { ok: false, path, message: 'no answer for this file' };
  }

  const gone = (path: string): boolean => (answers.get(path) ?? '').trim().length === 0;
  const files = new Map(planWorkspaceTree(current).map((file) => [file.path, file.content] as const));
  for (const [path, content] of answers) {
    if (gone(path)) files.delete(path);
    else files.set(path, content);
  }

  const removed = new Set<string>();
  for (const document of documents) {
    if (document.deleted && document.files.some((file) => gone(file.path))) removed.add(document.uid);
  }

  const read = readWorkspaceTree([...files].map(([path, content]) => ({ path, content })));
  const held = documentUids(read.state);
  const answered = new Set<string>();
  for (const document of documents) {
    if (removed.has(document.uid)) continue;
    if (!held.has(document.uid)) {
      const issue = read.issues.find((entry) => entry.path === document.path);
      return {
        ok: false,
        path: document.files[0]?.path ?? document.path,
        message: issue?.message ?? 'the answered files do not read as this document',
      };
    }
    answered.add(document.uid);
  }
  return { ok: true, resolved: { state: read.state, documents: answered, removed } };
}
