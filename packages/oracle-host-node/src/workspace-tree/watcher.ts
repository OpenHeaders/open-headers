/**
 * Filesystem watcher — the live half of §3.1 rung 2. Watches a bound
 * tree recursively and, after a quiescence window, hands control to
 * the owner's sweep scheduler. The watcher itself never touches the
 * engine: classification (external edit vs the materializer's own
 * diff-writes) belongs to the sweep's hashed baseline, which makes a
 * self-notification a guaranteed no-op — so no echo bookkeeping is
 * needed here, only debouncing.
 *
 * `.oh/` (engine sidecar) and `.git/` (a future P3 concern; also where
 * in-progress-op detection will hook per §3.3) never wake the sweep.
 *
 * `fs.watch({ recursive: true })` is native on macOS/Windows and
 * supported on Linux on the Node versions this app ships with; if the
 * platform refuses, the watcher disables itself loudly — the bind-open
 * cold-boot sweep still covers every offline change.
 */

import { type FSWatcher, watch } from 'node:fs';

export interface WorkspaceTreeWatcherOptions {
  rootDir: string;
  /** Called once per quiescent burst of filesystem events. */
  onQuiescence: () => void;
  /** Quiescence window; hand edits are bursty (editor tmp+rename dances). */
  debounceMs?: number;
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

const DEFAULT_DEBOUNCE_MS = 400;

const IGNORED_ROOTS = ['.oh', '.git'];

export class WorkspaceTreeWatcher {
  private readonly options: WorkspaceTreeWatcherOptions;
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(options: WorkspaceTreeWatcherOptions) {
    this.options = options;
  }

  /** Returns false when recursive watching is unavailable on this platform. */
  start(): boolean {
    if (this.disposed || this.watcher) return this.watcher !== null;
    try {
      this.watcher = watch(this.options.rootDir, { recursive: true }, (_event, fileName) => {
        if (fileName !== null && isIgnored(fileName)) return;
        this.bump();
      });
      this.watcher.on('error', (err) => {
        (this.options.log ?? (() => undefined))('warn', `WorkspaceTreeWatcher: ${this.options.rootDir}`, err);
      });
      return true;
    } catch (err) {
      (this.options.log ?? (() => undefined))(
        'warn',
        `WorkspaceTreeWatcher: recursive watch unavailable for ${this.options.rootDir}; live edits reconcile on next bind-open`,
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
      this.options.onQuiescence();
    }, this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }
}

function isIgnored(fileName: string): boolean {
  const normalized = fileName.replaceAll('\\', '/');
  return IGNORED_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}
