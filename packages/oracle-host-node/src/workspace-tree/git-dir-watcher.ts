/**
 * Git-directory watcher — what moves in a repo without moving a file of
 * its working tree (the git-sync plan §10 Phase 6). The tree watcher
 * deliberately ignores `.git/`, so two things need their own signal:
 *
 *   - a checkout: a terminal `git checkout` between branches with
 *     identical trees moves nothing BUT `HEAD` — a non-recursive watch on
 *     the per-working-tree git directory filtered to the `HEAD` entry
 *     (git rewrites the file via rename, so watching the directory
 *     survives inode churn where watching the file would not);
 *   - a ref: a branch or a tag made, moved or deleted, a commit on the
 *     checked-out branch, a fetch that brought something — `packed-refs`
 *     and everything under `refs/` in the SHARED directory, which is
 *     where a linked worktree keeps them. A name ending `.lock` is not a
 *     ref (git refuses one) and is not heard: every write of a ref also
 *     touches the ref's own entry or `packed-refs`, and a fetch that
 *     brings nothing still locks the remote's `HEAD`.
 *
 * Both directories are resolved through the gitfile of a linked
 * worktree or submodule checkout (§3.4 layouts), where they are not
 * `<root>/.git` at all. A repo that keeps its refs in a reftable has
 * neither a `HEAD` nor a `refs/` that moves: nothing is heard there.
 *
 * One burst is one call: `onHeadMove` when HEAD moved in it, whatever
 * refs moved with it, `onRefMove` when refs moved alone. Like the tree
 * watcher, this class never touches the engine: the owner (runtime)
 * re-probes the current branch on the §8 chain, flips the §6.3 log
 * pointer, and runs the same rung-2 sweep an in-app switch runs. A
 * checkout that DID change tracked files fires the tree watcher too —
 * the sweep's hashed baseline makes the second pass a no-op, so
 * double-firing is harmless.
 */

import { type FSWatcher, watch } from 'node:fs';
import * as path from 'node:path';
import { resolveGitDirs } from '../git/git-dir';

export interface GitDirWatcherOptions {
  rootDir: string;
  /** Called once per quiescent burst that moved HEAD. */
  onHeadMove: () => void;
  /** Called once per quiescent burst that moved refs and left HEAD where it was. */
  onRefMove: () => void;
  debounceMs?: number;
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

const DEFAULT_DEBOUNCE_MS = 200;

type Moved = 'head' | 'ref';

const packedRefs = (fileName: string | null): Moved | null => (fileName === 'packed-refs' ? 'ref' : null);

export class GitDirWatcher {
  private readonly options: GitDirWatcherOptions;
  private watchers: FSWatcher[] = [];
  private timer: NodeJS.Timeout | null = null;
  private headMoved = false;
  private disposed = false;

  constructor(options: GitDirWatcherOptions) {
    this.options = options;
  }

  /** Returns false when the git directory does not exist (or cannot be watched) yet. */
  async start(): Promise<boolean> {
    if (this.disposed || this.watchers.length > 0) return this.watchers.length > 0;
    const { gitDir, commonDir } = await resolveGitDirs(this.options.rootDir);
    if (this.disposed) return false;
    const shared = commonDir === gitDir;
    if (!this.hear(gitDir, false, (fileName) => (fileName === 'HEAD' ? 'head' : shared ? packedRefs(fileName) : null)))
      return false;
    if (!shared) this.hear(commonDir, false, packedRefs);
    this.hear(path.join(commonDir, 'refs'), true, (fileName) => (fileName?.endsWith('.lock') === true ? null : 'ref'));
    return true;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
  }

  /** Watch one directory; false when it cannot be watched — what it would have said waits for the next pass. */
  private hear(dir: string, recursive: boolean, moved: (fileName: string | null) => Moved | null): boolean {
    const log = this.options.log ?? (() => undefined);
    try {
      const watcher = watch(dir, { recursive }, (_event, fileName) => {
        const what = moved(fileName);
        if (what !== null) this.bump(what);
      });
      watcher.on('error', (err) => log('warn', `GitDirWatcher: ${dir}`, err));
      this.watchers.push(watcher);
      return true;
    } catch (err) {
      log('warn', `GitDirWatcher: ${dir} cannot be watched; what moves there reconciles on the next pass`, err);
      return false;
    }
  }

  private bump(moved: Moved): void {
    if (this.disposed) return;
    if (moved === 'head') this.headMoved = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const headMoved = this.headMoved;
      this.headMoved = false;
      if (headMoved) this.options.onHeadMove();
      else this.options.onRefMove();
    }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }
}
