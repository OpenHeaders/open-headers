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
 * A uid more than one leaf file claims is settled here too. The reader
 * gives it to the first file in path order and keeps the others; the
 * file at the place the engine holds the leaf is the leaf, and where
 * the engine holds it at none of them, the first the workspace can
 * hold — a file refused for its place claims nothing. Containers keep
 * the reader's answer.
 *
 * And a leaf the reader skipped in a directory with no manifest at all
 * (`uncontained`) is asked the same question here: where that directory
 * resolves to a container the engine holds — its manifest removed by
 * hand, with or without a rename above it — the leaf is one the
 * workspace can hold, and it is taken in as any other file that claims
 * its uid — unless the reader gave that uid to a file of another kind,
 * whose entity it is.
 *
 * The reader stays a function of the files alone. This asks the
 * questions that need the engine, where a read meets its snapshot.
 */

import type { UnknownField } from '../codec/yaml/unknown-fields';
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
import { duplicateUidMessage } from './read';
import type { TreeIssue, TreeLeafKey, TreeReadResult, TreeShadowed, WorkspaceTreeState } from './types';

/** The containers the engine holds, by tree. */
export type HeldContainers = Pick<
  WorkspaceTreeState,
  'collections' | 'folders' | 'requestCollections' | 'requestFolders' | 'templateCollections' | 'templateFolders'
>;

/** The trees as the engine holds them: their containers, and each leaf at its place — a snapshot is one. */
export type HeldTree = HeldContainers & Pick<WorkspaceTreeState, TreeLeafKey>;

interface PathEntity {
  uid: string;
  path: string;
}

interface LeafFamily {
  key: TreeLeafKey;
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

const placeIssue = (entity: PathEntity, manifest: string, kind: string): TreeIssue => ({
  path: `${entity.path}/${manifest}`,
  message: `${kind} inside no collection or folder of the workspace — skipped`,
  uncontainedIn: dirOf(entity.path),
});

/** What a read settled against the engine changes of it. */
interface Settlement {
  /** Uids of the folders and leaves the workspace cannot hold. */
  refused: Set<string>;
  /** By leaf family: the place of the file a uid goes to, where that is not the reader's. */
  claims: Map<TreeLeafKey, Map<string, string>>;
  /** Manifests the reader skipped as duplicates that are the entity after all. */
  cleared: Set<string>;
  issues: TreeIssue[];
}

function settleTree(
  tree: Tree,
  read: TreeReadResult,
  held: HeldTree,
  out: Settlement,
  givenUids: () => Set<string>,
): void {
  const { state } = read;
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
  const contained = (entity: PathEntity): boolean => takes(dirOf(entity.path));
  const refuse = (entity: PathEntity, manifest: string, kind: string): void => {
    out.refused.add(entity.uid);
    out.issues.push(placeIssue(entity, manifest, kind));
  };

  for (const folder of [...state[tree.folders]].sort((a, b) => depthOf(a.path) - depthOf(b.path))) {
    if (contained(folder)) takenDirs.add(folder.path);
    else refuse(folder, FOLDER_MANIFEST_FILE, 'folder');
  }

  for (const family of tree.leaves) {
    // The files that may be a leaf beside the one the reader gave its
    // uid to: the duplicates it skipped, and what it skipped in a
    // directory with no manifest that the engine holds as a container.
    const rivals = new Map<string, PathEntity[]>();
    const rival = (entity: PathEntity): void => {
      const others = rivals.get(entity.uid);
      if (others) others.push(entity);
      else rivals.set(entity.uid, [entity]);
    };
    for (const { entity } of read.shadowed[family.key]) rival(entity);
    for (const { entity } of read.uncontained[family.key]) {
      if (contained(entity)) rival(entity);
    }
    const placeOf = new Map<string, string>();
    if (rivals.size > 0) {
      for (const leaf of held[family.key]) placeOf.set(leaf.uid, leaf.path);
    }
    const claim = (leaf: PathEntity): void => {
      let claims = out.claims.get(family.key);
      if (claims === undefined) {
        claims = new Map();
        out.claims.set(family.key, claims);
      }
      claims.set(leaf.uid, leaf.path);
      out.cleared.add(`${leaf.path}/${family.manifest}`);
    };

    for (const first of state[family.key]) {
      const others = rivals.get(first.uid);
      rivals.delete(first.uid);
      let leaf: PathEntity = first;
      if (others !== undefined) {
        const own = placeOf.get(first.uid);
        const files = [first, ...others];
        leaf = files.find((file) => file.path === own) ?? files.find(contained) ?? first;
      }
      if (leaf !== first) {
        claim(leaf);
        out.issues.push(
          contained(first)
            ? { path: `${first.path}/${family.manifest}`, message: duplicateUidMessage(first.uid) }
            : placeIssue(first, family.manifest, family.kind),
        );
      }
      if (!contained(leaf)) refuse(leaf, family.manifest, family.kind);
    }

    // A uid the reader gave to no file: only files in a directory the
    // engine holds are left to claim it. One it gave to a file of
    // another kind is that entity's — a uid is one entity's across the
    // whole tree — and what is left here stays skipped.
    if (rivals.size === 0) continue;
    const given = givenUids();
    for (const [uid, files] of rivals) {
      if (given.has(uid)) continue;
      given.add(uid);
      const own = placeOf.get(uid);
      claim(files.find((file) => file.path === own) ?? files[0]);
    }
  }
}

/** Every uid the reader gave to a file, of any kind. */
function readUids(state: TreeReadResult['state']): Set<string> {
  const lists: readonly (readonly { uid: string }[])[] = [
    state.rules,
    state.collections,
    state.folders,
    state.requests,
    state.grpcRequests,
    state.websocketRequests,
    state.mqttRequests,
    state.graphqlRequests,
    state.requestCollections,
    state.requestFolders,
    state.templates,
    state.templateCollections,
    state.templateFolders,
    state.environments,
    state.specs,
    state.liveWorkflows,
    state.liveVariables,
  ];
  const uids = new Set<string>();
  for (const list of lists) {
    for (const { uid } of list) uids.add(uid);
  }
  return uids;
}

/** The read as the workspace takes it: every folder and leaf it cannot hold refused, each uid at the file that is the entity — the same read when nothing changes. */
export function containTreeRead(read: TreeReadResult, held: HeldTree): TreeReadResult {
  const settlement: Settlement = { refused: new Set(), claims: new Map(), cleared: new Set(), issues: [] };
  // The uids this reading has given to a file — the reader's, and each one claimed here — built where one is asked.
  let given: Set<string> | undefined;
  const givenUids = (): Set<string> => {
    given ??= readUids(read.state);
    return given;
  };
  for (const tree of TREES) settleTree(tree, read, held, settlement, givenUids);
  const { refused, claims, cleared, issues } = settlement;
  if (refused.size === 0 && claims.size === 0) return read;

  const unknowns = new Map(Object.entries(read.unknowns));
  const kept = <T extends { uid: string }>(items: T[]): T[] => items.filter((item) => !refused.has(item.uid));
  const { state, shadowed, uncontained } = read;
  const settled = <T extends PathEntity>(
    items: T[],
    shadows: readonly TreeShadowed<T>[],
    loose: readonly TreeShadowed<T>[],
    key: TreeLeafKey,
  ): T[] => {
    const places = claims.get(key);
    if (places === undefined) return kept(items);
    const skipped = [...shadows, ...loose];
    const taken = (uid: string): T | undefined => {
      const place = places.get(uid);
      const file = skipped.find(({ entity }) => entity.uid === uid && entity.path === place);
      if (file === undefined) return undefined;
      setUnknowns(unknowns, uid, file.unknowns);
      return file.entity;
    };
    const firsts = new Set(items.map((item) => item.uid));
    const out = items.map((item) => taken(item.uid) ?? item);
    for (const uid of places.keys()) {
      const leaf = firsts.has(uid) ? undefined : taken(uid);
      if (leaf !== undefined) out.push(leaf);
    }
    return kept(out);
  };

  const next = {
    ...state,
    rules: settled(state.rules, shadowed.rules, uncontained.rules, 'rules'),
    folders: kept(state.folders),
    requests: settled(state.requests, shadowed.requests, uncontained.requests, 'requests'),
    grpcRequests: settled(state.grpcRequests, shadowed.grpcRequests, uncontained.grpcRequests, 'grpcRequests'),
    websocketRequests: settled(
      state.websocketRequests,
      shadowed.websocketRequests,
      uncontained.websocketRequests,
      'websocketRequests',
    ),
    mqttRequests: settled(state.mqttRequests, shadowed.mqttRequests, uncontained.mqttRequests, 'mqttRequests'),
    graphqlRequests: settled(
      state.graphqlRequests,
      shadowed.graphqlRequests,
      uncontained.graphqlRequests,
      'graphqlRequests',
    ),
    requestFolders: kept(state.requestFolders),
    templates: settled(state.templates, shadowed.templates, uncontained.templates, 'templates'),
    templateFolders: kept(state.templateFolders),
  };
  for (const uid of refused) unknowns.delete(uid);
  return {
    state: next,
    unknowns: Object.fromEntries(unknowns),
    issues: [...read.issues.filter((issue) => !cleared.has(issue.path)), ...issues],
    shadowed,
    uncontained,
  };
}

function setUnknowns(unknowns: Map<string, readonly UnknownField[]>, uid: string, rows: readonly UnknownField[]): void {
  if (rows.length > 0) unknowns.set(uid, rows);
  else unknowns.delete(uid);
}
