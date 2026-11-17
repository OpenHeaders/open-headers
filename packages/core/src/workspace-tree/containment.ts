/**
 * Containment of a tree read — what of it the workspace can hold.
 *
 * Containment is the parent's set, so a folder or a leaf is taken in
 * only where its directory is a container the workspace has: one read
 * in this reading, or one the engine holds — resolved as a placement
 * resolves it (`resolveTreeParent`: the exact path, then the path's uid
 * tail). A container whose manifest does not read keeps its children
 * while the engine holds it; a new one has no set to hold them, and a
 * child taken in under it is slotted on nothing and re-homed.
 *
 * Top-down: a folder that is refused takes what its directory holds
 * with it. Each refusal is an issue at the manifest — the file kept,
 * off the baseline — and everything else of the read stands.
 *
 * The reader stays a function of the files alone. This asks the one
 * question that needs the engine, where a read meets its snapshot.
 */

import {
  FOLDER_TREE_KINDS,
  REQUEST_FOLDER_TREE_KINDS,
  resolveTreeParent,
  TEMPLATE_FOLDER_TREE_KINDS,
  type TreeParentKinds,
} from '../sync';
import {
  FOLDER_MANIFEST_FILE,
  GRAPHQL_REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  MQTT_REQUEST_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
} from './layout';
import type { TreeIssue, TreeReadResult, WorkspaceTreeState } from './types';

type TreeState = TreeReadResult['state'];

/** The containers the engine holds, by tree — a snapshot is one. */
export type HeldContainers = Pick<
  WorkspaceTreeState,
  'collections' | 'folders' | 'requestCollections' | 'requestFolders' | 'templateCollections' | 'templateFolders'
>;

interface LeafFamily {
  key: 'rules' | 'requests' | 'grpcRequests' | 'websocketRequests' | 'mqttRequests' | 'graphqlRequests' | 'templates';
  manifest: string;
  kind: string;
}

interface Tree {
  kinds: TreeParentKinds<string, string>;
  collections: 'collections' | 'requestCollections' | 'templateCollections';
  folders: 'folders' | 'requestFolders' | 'templateFolders';
  leaves: readonly LeafFamily[];
}

const TREES: readonly Tree[] = [
  {
    kinds: FOLDER_TREE_KINDS,
    collections: 'collections',
    folders: 'folders',
    leaves: [{ key: 'rules', manifest: RULE_MANIFEST_FILE, kind: 'rule' }],
  },
  {
    kinds: REQUEST_FOLDER_TREE_KINDS,
    collections: 'requestCollections',
    folders: 'requestFolders',
    leaves: [
      { key: 'requests', manifest: REQUEST_MANIFEST_FILE, kind: 'request' },
      { key: 'grpcRequests', manifest: GRPC_REQUEST_MANIFEST_FILE, kind: 'gRPC request' },
      { key: 'websocketRequests', manifest: WEBSOCKET_REQUEST_MANIFEST_FILE, kind: 'WebSocket request' },
      { key: 'mqttRequests', manifest: MQTT_REQUEST_MANIFEST_FILE, kind: 'MQTT request' },
      { key: 'graphqlRequests', manifest: GRAPHQL_REQUEST_MANIFEST_FILE, kind: 'GraphQL request' },
    ],
  },
  {
    kinds: TEMPLATE_FOLDER_TREE_KINDS,
    collections: 'templateCollections',
    folders: 'templateFolders',
    leaves: [{ key: 'templates', manifest: TEMPLATE_MANIFEST_FILE, kind: 'template' }],
  },
];

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

const depthOf = (path: string): number => path.split('/').length;

type Refuse = (entity: { uid: string; path: string }, manifest: string, kind: string) => void;

function refuseUncontained(tree: Tree, state: TreeState, held: HeldContainers, refuse: Refuse): void {
  const lookup = { collections: held[tree.collections], folders: held[tree.folders] };
  const heldUids = new Set([...lookup.collections, ...lookup.folders].map((container) => container.uid));

  // A directory a container was read at answers for itself: a
  // collection is a root and stands, a folder stands where its own
  // directory does. Only a directory with no container read at it asks
  // the engine.
  const readDirs = new Set<string>();
  const takenDirs = new Set<string>();
  for (const collection of state[tree.collections]) {
    readDirs.add(collection.path);
    takenDirs.add(collection.path);
  }
  for (const folder of state[tree.folders]) readDirs.add(folder.path);

  const heldAt = new Map<string, boolean>();
  const takes = (dir: string): boolean => {
    if (readDirs.has(dir)) return takenDirs.has(dir);
    let answer = heldAt.get(dir);
    if (answer === undefined) {
      const parent = resolveTreeParent(dir, lookup, tree.kinds);
      answer = parent !== null && heldUids.has(parent.uid);
      heldAt.set(dir, answer);
    }
    return answer;
  };

  for (const folder of [...state[tree.folders]].sort((a, b) => depthOf(a.path) - depthOf(b.path))) {
    if (takes(dirOf(folder.path))) takenDirs.add(folder.path);
    else refuse(folder, FOLDER_MANIFEST_FILE, 'folder');
  }
  for (const family of tree.leaves) {
    for (const leaf of state[family.key]) {
      if (!takes(dirOf(leaf.path))) refuse(leaf, family.manifest, family.kind);
    }
  }
}

/** The read with every folder and leaf the workspace cannot hold refused — the same read when there is none. */
export function containTreeRead(read: TreeReadResult, held: HeldContainers): TreeReadResult {
  const refused = new Set<string>();
  const issues: TreeIssue[] = [];
  const refuse: Refuse = (entity, manifest, kind) => {
    refused.add(entity.uid);
    issues.push({
      path: `${entity.path}/${manifest}`,
      message: `${kind} inside no collection or folder of the workspace — skipped`,
    });
  };
  for (const tree of TREES) refuseUncontained(tree, read.state, held, refuse);
  if (refused.size === 0) return read;

  const kept = <T extends { uid: string }>(items: T[]): T[] => items.filter((item) => !refused.has(item.uid));
  return {
    state: {
      ...read.state,
      rules: kept(read.state.rules),
      folders: kept(read.state.folders),
      requests: kept(read.state.requests),
      grpcRequests: kept(read.state.grpcRequests),
      websocketRequests: kept(read.state.websocketRequests),
      mqttRequests: kept(read.state.mqttRequests),
      graphqlRequests: kept(read.state.graphqlRequests),
      requestFolders: kept(read.state.requestFolders),
      templates: kept(read.state.templates),
      templateFolders: kept(read.state.templateFolders),
    },
    unknowns: Object.fromEntries(Object.entries(read.unknowns).filter(([key]) => !refused.has(key))),
    issues: [...read.issues, ...issues],
  };
}
