/**
 * Tree plumbing for the passes that carry files between a commit and
 * the working tree without a checkout of the branch: the listing of a
 * commit's blobs, and a paths checkout out of a commit that never
 * touches the user's real index. Same discipline as `branch-ops.ts`:
 * explicit repo addressing, the injected {@link GitRunner} seam, typed
 * failures with git's own stderr.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GitRunner } from './git-exec';
import { type BranchOpResult, failureDetail, repoArgs } from './repo';

/** Paths per `checkout` invocation — keeps the arg vector under every platform's limit. */
const CHECKOUT_PATHS_PER_CALL = 100;

/**
 * Every blob of a commit's tree as `path → "<mode> <sha>"` (files and
 * symbolic links; a submodule entry is not a blob and is left out).
 * Two commits hold the same file at a path exactly when the values are
 * equal. Null when the ref is unknown.
 */
export async function listTreeEntries(
  run: GitRunner,
  rootDir: string,
  ref: string,
): Promise<Map<string, string> | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const entries = new Map<string, string>();
  for (const record of listing.stdout.split('\0')) {
    const tab = record.indexOf('\t');
    if (tab === -1) continue;
    const [mode, type, sha] = record.slice(0, tab).split(' ');
    if (type !== 'blob') continue;
    entries.set(record.slice(tab + 1), `${mode} ${sha}`);
  }
  return entries;
}

/**
 * Write `paths` as `sourceRef` holds them into the working tree —
 * bytes, the executable bit, symbolic links. The checkout rides a
 * throwaway index outside the work tree, so the user's real index is
 * never read or written (§3.3); the paths are literal, never patterns.
 * Every path must exist in `sourceRef`. The caller owns the decision
 * that the bytes on disk may be replaced.
 */
export async function checkoutPathsFromCommit(
  run: GitRunner,
  rootDir: string,
  sourceRef: string,
  paths: readonly string[],
): Promise<BranchOpResult> {
  if (paths.length === 0) return { ok: true };
  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-checkout-index-'));
  try {
    const env = { GIT_INDEX_FILE: path.join(indexDir, 'index') };
    for (let start = 0; start < paths.length; start += CHECKOUT_PATHS_PER_CALL) {
      const chunk = paths.slice(start, start + CHECKOUT_PATHS_PER_CALL);
      const result = await run([...repoArgs(rootDir), '--literal-pathspecs', 'checkout', sourceRef, '--', ...chunk], {
        cwd: rootDir,
        env,
      });
      if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
    }
    return { ok: true };
  } finally {
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
