/**
 * `.git/HEAD` watcher — the external-checkout trigger (GIT_PLAN.md §10
 * Phase 6). The tree watcher deliberately ignores `.git/`, and a
 * terminal `git checkout` between branches with identical trees moves
 * nothing BUT `HEAD` — so branch moves need their own signal: a
 * non-recursive watch on the `.git` directory filtered to the `HEAD`
 * entry (git rewrites the file via rename, so watching the directory
 * survives inode churn where watching the file would not).
 *
 * Like the tree watcher, this class never touches the engine: the
 * owner (runtime) re-probes the current branch on the §8 chain, flips
 * the §6.3 log pointer, and runs the same rung-2 sweep an in-app
 * switch runs. A checkout that DID change tracked files fires the tree
 * watcher too — the sweep's hashed baseline makes the second pass a
 * no-op, so double-firing is harmless.
 */

import { type FSWatcher, watch } from 'node:fs';
import * as path from 'node:path';

export interface GitHeadWatcherOptions {
  rootDir: string;
  /** Called once per quiescent burst of HEAD moves. */
  onHeadMove: () => void;
  debounceMs?: number;
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

const DEFAULT_DEBOUNCE_MS = 200;

export class GitHeadWatcher {
  private readonly options: GitHeadWatcherOptions;
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(options: GitHeadWatcherOptions) {
    this.options = options;
  }

  /** Returns false when `.git` does not exist (or cannot be watched) yet. */
  start(): boolean {
    if (this.disposed || this.watcher) return this.watcher !== null;
    try {
      this.watcher = watch(path.join(this.options.rootDir, '.git'), (_event, fileName) => {
        if (fileName !== 'HEAD') return;
        this.bump();
      });
      this.watcher.on('error', (err) => {
        (this.options.log ?? (() => undefined))('warn', `GitHeadWatcher: ${this.options.rootDir}`, err);
      });
      return true;
    } catch (err) {
      (this.options.log ?? (() => undefined))(
        'warn',
        `GitHeadWatcher: .git unavailable for ${this.options.rootDir}; external checkouts reconcile on next sweep`,
        err,
      );
      this.watcher = null;
      return false;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.watcher?.close();
    this.watcher = null;
  }

  private bump(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.options.onHeadMove();
    }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }
}
