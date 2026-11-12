/**
 * commit-entities — the entities a commit's files belonged to, read
 * from the commit itself: what names a changed file when the workspace
 * no longer holds the entity it was part of (deleted since, or living
 * on another branch). Core classifies each path and names the manifest
 * that identifies it; this half reads that manifest out of the commit's
 * tree — or, for a path the commit removes, out of its first parent's —
 * and then the folder and collection manifests of the directories above
 * it, so the surface can place the entity where it sat.
 *
 * A pure read: two tree listings at most and one blob per manifest,
 * each read once however many paths share it.
 */

import {
  classifyTreePath,
  containerCandidatesAbove,
  entityRefOfManifest,
  type TreePathManifestCandidate,
  type WorkspaceTreeEntityRef,
} from '@openheaders/core/workspace-tree';
import type { GitRunner } from '../git/git-exec';
import { listTreeEntries, readTreeEntryText } from '../git/tree-ops';

/** A manifest larger than this names nothing — no codec writes one near it. */
const MANIFEST_MAX_BYTES = 262_144;

export interface CommitFileEntity {
  path: string;
  entity: WorkspaceTreeEntityRef;
  /** The collection and the folders that held it, outermost first. */
  containers: WorkspaceTreeEntityRef[];
}

interface Named {
  entity: WorkspaceTreeEntityRef;
  candidate: TreePathManifestCandidate;
}

/**
 * Each path's entity as `sha` — or its first parent — names it; a path
 * that belongs to none (the user's own file, a root file, a directory
 * with no readable manifest) is left out. Null when `sha` is no commit.
 */
export async function readCommitEntities(
  run: GitRunner,
  rootDir: string,
  sha: string,
  paths: readonly string[],
): Promise<CommitFileEntity[] | null> {
  const held = await listTreeEntries(run, rootDir, sha);
  if (held === null) return null;
  let before: Promise<Map<string, string>> | null = null;
  // A root commit has no parent: nothing was held before it.
  const heldBefore = (): Promise<Map<string, string>> => {
    before ??= listTreeEntries(run, rootDir, `${sha}^`).then((entries) => entries ?? new Map<string, string>());
    return before;
  };

  const manifests = new Map<string, Promise<string | null>>();
  const manifestAt = (manifestPath: string): Promise<string | null> => {
    let read = manifests.get(manifestPath);
    if (read === undefined) {
      read = (async () => {
        const entry = held.get(manifestPath) ?? (await heldBefore()).get(manifestPath);
        const file = await readTreeEntryText(run, rootDir, entry, MANIFEST_MAX_BYTES);
        return file.kind === 'text' ? file.text : null;
      })();
      manifests.set(manifestPath, read);
    }
    return read;
  };

  /** The first of the candidates whose manifest is there and names an entity. */
  const named = async (candidates: readonly TreePathManifestCandidate[]): Promise<Named | null> => {
    for (const candidate of candidates) {
      const yaml = await manifestAt(candidate.manifestPath);
      const entity = yaml === null ? null : entityRefOfManifest(candidate, yaml);
      if (entity !== null) return { entity, candidate };
    }
    return null;
  };

  const out: CommitFileEntity[] = [];
  for (const path of new Set(paths)) {
    const classified = classifyTreePath(path);
    if (classified.kind === 'none') continue;
    const own = await named(classified.kind === 'manifest' ? [classified.candidate] : classified.candidates);
    if (own === null) continue;
    const containers: WorkspaceTreeEntityRef[] = [];
    for (const above of containerCandidatesAbove(own.candidate)) {
      const container = await named(above);
      if (container !== null) containers.unshift(container.entity);
    }
    out.push({ path, entity: own.entity, containers });
  }
  return out;
}
