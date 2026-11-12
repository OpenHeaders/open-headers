/**
 * useFormerFiles — what a commit's files belonged to there, for the
 * files the workspace holds no entity for (deleted since, or living on
 * another branch): the host reads the commit's own manifests
 * (`oh.workspaceTree.entitiesAtCommit`) and the named file tree lists
 * them by that. Asked lazily — only for what the listing could not
 * name, once per commit: a commit never changes, so an answer is kept
 * for the session and a commit seen before is named on its first paint.
 * A host without the read leaves those files where they were, under
 * Files.
 */

import { hostBridge, type WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import type { FormerEntity, FormerFile, FormerFiles } from '@openheaders/ui/shared/workspace-files';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

/** A file and the commit that changed it. */
export interface CommitFile {
  path: string;
  sha: string;
}

/** By workspace and commit, then by path: what the file belonged to there — null, to nothing. */
const answers = new Map<string, Map<string, FormerFile | null>>();
/** The asks in flight, as `<workspace and commit> <path>`. */
const asked = new Set<string>();
/** Counts the answers that have landed — what a mounted tree re-reads on. */
let landed = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Commits kept — past it the oldest answer goes. */
const KEPT_COMMITS = 256;

const commitKey = (workspaceId: string, sha: string): string => `${workspaceId}:${sha}`;

function answersOf(key: string): Map<string, FormerFile | null> {
  let known = answers.get(key);
  if (known === undefined) {
    if (answers.size >= KEPT_COMMITS) {
      const [oldest] = answers.keys();
      answers.delete(oldest);
    }
    known = new Map();
    answers.set(key, known);
  }
  return known;
}

/** The wire's entity as the listing takes it; the workspace's one-file pages are never former. */
function formerEntityOf(ref: WorkspaceTreeEntityRefWire): FormerEntity | null {
  if (ref.kind === 'workspace-variables' || ref.kind === 'vault') return null;
  return {
    kind: ref.kind,
    uid: ref.uid,
    name: ref.name,
    ...(ref.method !== undefined ? { method: ref.method } : {}),
  };
}

async function ask(workspaceId: string, sha: string, paths: readonly string[]): Promise<void> {
  const key = commitKey(workspaceId, sha);
  for (const path of paths) asked.add(`${key} ${path}`);
  try {
    const result = await hostBridge.call('oh.workspaceTree.entitiesAtCommit', { workspaceId, sha, paths: [...paths] });
    if (!result?.ok) return;
    const known = answersOf(key);
    for (const path of paths) known.set(path, null);
    for (const file of result.entities) {
      const entity = formerEntityOf(file.entity);
      if (entity === null) continue;
      const containers = file.containers.flatMap((container) => formerEntityOf(container) ?? []);
      known.set(file.path, { entity, containers });
    }
    landed += 1;
    for (const listener of listeners) listener();
  } catch {
    // A host that cannot answer leaves the files where the listing put them.
  } finally {
    for (const path of paths) asked.delete(`${key} ${path}`);
  }
}

/** Forget every answer — a test starts from none. */
export function resetFormerFiles(): void {
  answers.clear();
  asked.clear();
  landed = 0;
}

export function useFormerFiles(workspaceId: string | undefined, files: readonly CommitFile[]): FormerFiles {
  const arrived = useSyncExternalStore(subscribe, () => landed);

  useEffect(() => {
    if (workspaceId === undefined) return;
    const bySha = new Map<string, string[]>();
    for (const { path, sha } of files) {
      const key = commitKey(workspaceId, sha);
      if (answers.get(key)?.has(path) === true || asked.has(`${key} ${path}`)) continue;
      const paths = bySha.get(sha);
      if (paths) paths.push(path);
      else bySha.set(sha, [path]);
    }
    for (const [sha, paths] of bySha) void ask(workspaceId, sha, paths);
  }, [workspaceId, files]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `arrived` re-reads the answers kept outside React
  return useMemo(() => {
    const named = new Map<string, FormerFile>();
    if (workspaceId === undefined) return named;
    for (const { path, sha } of files) {
      const answer = answers.get(commitKey(workspaceId, sha))?.get(path);
      if (answer !== undefined && answer !== null) named.set(path, answer);
    }
    return named;
  }, [workspaceId, files, arrived]);
}
