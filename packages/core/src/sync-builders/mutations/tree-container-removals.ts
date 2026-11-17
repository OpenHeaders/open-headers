/**
 * The containers of one tree a reading removes.
 *
 * A container leaves only when nothing the engine holds is left beneath
 * it — the rule a change laid over the branch keeps (`commit-change.ts`,
 * `not-empty`), asked here of a reading of the tree itself: a manifest
 * gone while a folder or a leaf of its container stays is not a
 * deletion. The container is kept, and the flush that follows writes
 * the manifest again.
 *
 * Judged deepest first, by what is left: a leaf leaves with its own
 * manifest, a folder with its manifest once nothing is left in it. What
 * the reading read at another place has moved there and is left at that
 * place, not at the one the engine holds.
 */

import { COLLECTION_MANIFEST_FILE, FOLDER_MANIFEST_FILE } from '@openheaders/core/workspace-tree';

export interface TreePathEntity {
  uid: string;
  path: string;
}

/** One tree as the engine holds it. */
export interface ContainerTree {
  collections: readonly TreePathEntity[];
  folders: readonly TreePathEntity[];
  /** The tree's leaf families, each with its manifest's file name. */
  leaves: ReadonlyArray<{ manifest: string; items: readonly TreePathEntity[] }>;
}

/** What a reading says of the entities the engine holds. */
export interface TreeReading {
  /** Whether the reading read an entity under this uid. */
  read: (uid: string) => boolean;
  /** Where the reading read it. */
  pathOf: (uid: string) => string | undefined;
  /** Whether the file is one the reading finds removed. */
  removed: (path: string) => boolean;
}

export interface ContainerRemovals {
  /** Uids of the collections and folders that leave. */
  gone: ReadonlySet<string>;
  /** Manifests the reading finds removed whose container stays, something left beneath it. */
  kept: string[];
}

const depthOf = (path: string): number => path.split('/').length;

export function planContainerRemovals(tree: ContainerTree, reading: TreeReading): ContainerRemovals {
  const leaves = (entity: TreePathEntity, manifest: string): boolean =>
    !reading.read(entity.uid) && reading.removed(`${entity.path}/${manifest}`);

  // Where each thing left of the tree stands after the reading.
  const left: string[] = [];
  const stays = (entity: TreePathEntity): void => {
    left.push(reading.pathOf(entity.uid) ?? entity.path);
  };
  const occupied = (dir: string): boolean => left.some((path) => path.startsWith(`${dir}/`));

  for (const family of tree.leaves) {
    for (const leaf of family.items) {
      if (!leaves(leaf, family.manifest)) stays(leaf);
    }
  }

  const gone = new Set<string>();
  const kept: string[] = [];
  const judge = (container: TreePathEntity, manifest: string): void => {
    if (!leaves(container, manifest)) {
      stays(container);
    } else if (occupied(container.path)) {
      kept.push(`${container.path}/${manifest}`);
      stays(container);
    } else {
      gone.add(container.uid);
    }
  };
  for (const folder of [...tree.folders].sort((a, b) => depthOf(b.path) - depthOf(a.path))) {
    judge(folder, FOLDER_MANIFEST_FILE);
  }
  for (const collection of tree.collections) judge(collection, COLLECTION_MANIFEST_FILE);
  return { gone, kept };
}
