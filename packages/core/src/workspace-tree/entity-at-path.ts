/**
 * entity-at-path — the Jump to Source resolver's pure half: which
 * workspace entity a tree path belongs to. Classification follows the
 * reader's conventions (manifest names identify entities, the first
 * segment names the collection tree, every other file in an entity's
 * directory is that entity's sibling), and the manifest's YAML yields
 * the identity the editors open on — uid, name, a request's method.
 * Hosts supply the reads — the working tree's files, or a commit's: a
 * sibling's directory may carry any of the entity manifests, so the
 * host probes the candidates in order; the folders and the collection
 * above an entity are the manifests of the directories above its own.
 */

import * as YAML from 'yaml';
import {
  COLLECTION_MANIFEST_FILE,
  ENVIRONMENTS_DIR,
  FOLDER_MANIFEST_FILE,
  GRAPHQL_REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  MQTT_REQUEST_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SECRET_FILE_SUFFIX,
  SECRET_TEMPLATE_FILE_SUFFIX,
  SPEC_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  VAULT_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  WORKSPACE_VARS_FILE,
} from './layout';

export type WorkspaceTreeEntityKind =
  | 'rule'
  | 'request'
  | 'grpc'
  | 'websocket'
  | 'mqtt'
  | 'graphql'
  | 'template'
  | 'spec'
  | 'workflow'
  | 'live-variable'
  | 'collection'
  | 'folder'
  | 'environment'
  | 'workspace-variables'
  | 'vault';

export type WorkspaceTreeCollectionTree = 'rules' | 'requests' | 'templates';

/** The identity an editor opens on. */
export interface WorkspaceTreeEntityRef {
  kind: WorkspaceTreeEntityKind;
  /** Which collection tree a collection or folder belongs to; null elsewhere. */
  tree: WorkspaceTreeCollectionTree | null;
  uid: string;
  name: string;
  /** An HTTP request's method — the request editor's tab label. */
  method?: string;
}

export interface TreePathManifestCandidate {
  kind: WorkspaceTreeEntityKind;
  tree: WorkspaceTreeCollectionTree | null;
  manifestPath: string;
}

export type TreePathClass =
  /** The path IS an entity's manifest (or a one-file entity). */
  | { kind: 'manifest'; candidate: TreePathManifestCandidate }
  /** Another file in a collection-tree directory — one of these manifests names its entity. */
  | { kind: 'sibling'; candidates: TreePathManifestCandidate[] }
  /** The user's own file, a root file, or a secret — no editor. */
  | { kind: 'none' };

const MANIFEST_KINDS: ReadonlyMap<string, WorkspaceTreeEntityKind> = new Map([
  [COLLECTION_MANIFEST_FILE, 'collection'],
  [FOLDER_MANIFEST_FILE, 'folder'],
  [RULE_MANIFEST_FILE, 'rule'],
  [REQUEST_MANIFEST_FILE, 'request'],
  [GRPC_REQUEST_MANIFEST_FILE, 'grpc'],
  [WEBSOCKET_REQUEST_MANIFEST_FILE, 'websocket'],
  [MQTT_REQUEST_MANIFEST_FILE, 'mqtt'],
  [GRAPHQL_REQUEST_MANIFEST_FILE, 'graphql'],
  [TEMPLATE_MANIFEST_FILE, 'template'],
  [SPEC_MANIFEST_FILE, 'spec'],
  [LIVE_WORKFLOW_MANIFEST_FILE, 'workflow'],
  [LIVE_VARIABLE_MANIFEST_FILE, 'live-variable'],
]);

function treeOf(firstSegment: string): WorkspaceTreeCollectionTree | null {
  return firstSegment === 'rules' || firstSegment === 'requests' || firstSegment === 'templates' ? firstSegment : null;
}

export function classifyTreePath(path: string): TreePathClass {
  const cut = path.lastIndexOf('/');
  const dir = cut === -1 ? '' : path.slice(0, cut);
  const base = cut === -1 ? path : path.slice(cut + 1);
  const first = path.indexOf('/') === -1 ? path : path.slice(0, path.indexOf('/'));

  if (dir === '') {
    if (base === WORKSPACE_VARS_FILE) {
      return { kind: 'manifest', candidate: { kind: 'workspace-variables', tree: null, manifestPath: path } };
    }
    if (base === VAULT_FILE) return { kind: 'manifest', candidate: { kind: 'vault', tree: null, manifestPath: path } };
    return { kind: 'none' };
  }
  if (dir === ENVIRONMENTS_DIR) {
    if (!base.endsWith('.yaml') || base.endsWith(SECRET_FILE_SUFFIX) || base.endsWith(SECRET_TEMPLATE_FILE_SUFFIX)) {
      return { kind: 'none' };
    }
    return { kind: 'manifest', candidate: { kind: 'environment', tree: null, manifestPath: path } };
  }
  const tree = treeOf(first);
  const manifestKind = MANIFEST_KINDS.get(base);
  if (manifestKind !== undefined) {
    if ((manifestKind === 'collection' || manifestKind === 'folder') && tree === null) return { kind: 'none' };
    return { kind: 'manifest', candidate: { kind: manifestKind, tree, manifestPath: path } };
  }
  if (tree === null) return { kind: 'none' };
  const candidates: TreePathManifestCandidate[] = [];
  for (const [file, kind] of MANIFEST_KINDS) {
    candidates.push({ kind, tree, manifestPath: `${dir}/${file}` });
  }
  return { kind: 'sibling', candidates };
}

/**
 * The manifests that may name what holds an entity of a collection
 * tree: per directory above the entity's own, nearest first, that
 * directory's folder manifest and its collection manifest. Empty
 * outside the collection trees, and for a collection itself.
 */
export function containerCandidatesAbove(candidate: TreePathManifestCandidate): TreePathManifestCandidate[][] {
  const { tree } = candidate;
  if (tree === null) return [];
  const dirs = candidate.manifestPath.split('/').slice(0, -2);
  const above: TreePathManifestCandidate[][] = [];
  // dirs[0] is the tree's own directory — it holds collections and is none itself.
  for (let depth = dirs.length; depth >= 2; depth -= 1) {
    const dir = dirs.slice(0, depth).join('/');
    above.push([
      { kind: 'folder', tree, manifestPath: `${dir}/${FOLDER_MANIFEST_FILE}` },
      { kind: 'collection', tree, manifestPath: `${dir}/${COLLECTION_MANIFEST_FILE}` },
    ]);
  }
  return above;
}

function stringField(doc: unknown, field: string): string | null {
  if (doc === null || typeof doc !== 'object') return null;
  const value = (doc as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The entity a manifest's YAML names. Workspace variables and the
 * vault are one-per-workspace pages with no uid; every other kind
 * needs its `uid`, and a missing one answers null (a manifest the
 * reader would have quarantined).
 */
export function entityRefOfManifest(candidate: TreePathManifestCandidate, yaml: string): WorkspaceTreeEntityRef | null {
  if (candidate.kind === 'workspace-variables' || candidate.kind === 'vault') {
    return { kind: candidate.kind, tree: null, uid: '', name: '' };
  }
  let doc: unknown;
  try {
    doc = YAML.parse(yaml);
  } catch {
    return null;
  }
  const uid = stringField(doc, 'uid');
  if (uid === null) return null;
  const name = stringField(doc, 'name') ?? '';
  const method = candidate.kind === 'request' ? stringField(doc, 'method') : null;
  return {
    kind: candidate.kind,
    tree: candidate.tree,
    uid,
    name,
    ...(method !== null ? { method } : {}),
  };
}
