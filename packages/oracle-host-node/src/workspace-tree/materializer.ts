/**
 * Working-tree materializer — engine snapshot → YAML tree on disk
 * (GIT_PLAN.md §3.1 rung 1: inside a live session the engine is truth
 * and the tree follows; §3.2: materialize is continuous, debounced,
 * always on).
 *
 * Write discipline:
 *   - plan via `planWorkspaceTree` (deterministic bytes), then diff
 *     against disk — only changed files are written (atomic
 *     tmp+rename), so mtimes and git's dirty state never churn on
 *     no-op materializations;
 *   - deletions come from the `.oh/` materialized index, never from a
 *     directory sweep: the materializer removes only paths it wrote in
 *     a previous pass, so files the user hand-added (and any file
 *     outside the plan) are never destroyed;
 *   - runs are chained — a materialize never interleaves with another
 *     (§8 single actor per tree).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { planWorkspaceTree, type TreeUnknownFields, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { readMaterializedIndex, writeMaterializedIndex } from './sidecar';

export interface MaterializeSnapshot {
  state: WorkspaceTreeState;
  unknowns?: TreeUnknownFields;
}

export interface MaterializeResult {
  written: string[];
  deleted: string[];
  unchanged: number;
}

export interface WorkspaceTreeMaterializerOptions {
  /** Absolute path of the bound workspace tree. */
  rootDir: string;
  /** Snapshot provider — called once per materialize pass. */
  readSnapshot: () => Promise<MaterializeSnapshot>;
  /** Quiescence window for {@link WorkspaceTreeMaterializer.schedule}. */
  debounceMs?: number;
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

const DEFAULT_DEBOUNCE_MS = 500;

export class WorkspaceTreeMaterializer {
  private readonly rootDir: string;
  private readonly readSnapshot: () => Promise<MaterializeSnapshot>;
  private readonly debounceMs: number;
  private readonly log: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
  private timer: NodeJS.Timeout | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(options: WorkspaceTreeMaterializerOptions) {
    this.rootDir = options.rootDir;
    this.readSnapshot = options.readSnapshot;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.log = options.log ?? (() => undefined);
  }

  /** Debounced materialize — call on every applied batch. */
  schedule(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch((err) => {
        this.log('error', `WorkspaceTreeMaterializer: materialize failed for ${this.rootDir}`, err);
      });
    }, this.debounceMs);
  }

  /** Run a materialize pass now (awaiting any in-flight pass first). */
  flush(): Promise<MaterializeResult> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const run = this.chain.then(
      () => this.materializeOnce(),
      () => this.materializeOnce(),
    );
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Cancel any pending pass; subsequent schedules are ignored. */
  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async materializeOnce(): Promise<MaterializeResult> {
    const snapshot = await this.readSnapshot();
    const files = planWorkspaceTree(snapshot.state, snapshot.unknowns ?? {});
    const previous = await readMaterializedIndex(this.rootDir);

    const written: string[] = [];
    let unchanged = 0;
    const planned = new Set<string>();
    for (const file of files) {
      planned.add(file.path);
      const target = path.join(this.rootDir, ...file.path.split('/'));
      const existing = await readFileOrNull(target);
      if (existing === file.content) {
        unchanged += 1;
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      await fs.writeFile(tmp, file.content, 'utf-8');
      await fs.rename(tmp, target);
      written.push(file.path);
    }

    const deleted: string[] = [];
    for (const stale of previous) {
      if (planned.has(stale)) continue;
      const target = path.join(this.rootDir, ...stale.split('/'));
      await fs.rm(target, { force: true });
      await this.pruneEmptyDirs(path.dirname(target));
      deleted.push(stale);
    }

    await writeMaterializedIndex(this.rootDir, [...planned]);
    return { written, deleted, unchanged };
  }

  /** Remove now-empty directories left behind by a deletion, up to the tree root. */
  private async pruneEmptyDirs(dir: string): Promise<void> {
    let current = dir;
    const root = path.resolve(this.rootDir);
    while (path.resolve(current) !== root && path.resolve(current).startsWith(root)) {
      try {
        await fs.rmdir(current);
      } catch {
        return;
      }
      current = path.dirname(current);
    }
  }
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}
