/**
 * Working-tree materializer — engine snapshot → YAML tree on disk
 * (the git-sync plan §3.1 rung 1: inside a live session the engine is truth
 * and the tree follows; §3.2: materialize is continuous, debounced,
 * always on).
 *
 * Write discipline:
 *   - plan via `planWorkspaceDocuments` (deterministic bytes), then
 *     diff against disk — only changed files are written (atomic
 *     tmp+rename), so mtimes and git's dirty state never churn on
 *     no-op materializations;
 *   - every path goes through the folder's boundary (`git/tree-boundary.ts`)
 *     before anything is done at it: a planned file it refuses is not
 *     read, not written, and stands as it was with its entry kept; a
 *     baseline path it refuses is not the materializer's to remove —
 *     its entry goes and the disk stands. A link standing at a file's
 *     own name is refused the same two ways (`tree-file.ts`): it is the
 *     user's, never read through, replaced or removed. What a pass did not write for
 *     the boundary, and the documents the plan left out for their
 *     paths, are the pass's rows; the planned text of each file the
 *     boundary refused is answered beside them, for a commit that
 *     records what the engine holds;
 *   - deletions come from the `.oh/` materialized index, never from a
 *     directory sweep: the materializer removes only paths it wrote in
 *     a previous pass, so files the user hand-added (and any file
 *     outside the plan) are never destroyed;
 *   - `.gitignore` and `.gitattributes` are kept by the hygiene pass
 *     (`hygiene.ts`), not by the plan: authored when absent, a missing
 *     ignore entry appended, the user's own lines never rewritten —
 *     and never part of the baseline; the pass looks for git's writes
 *     like every write below, and what it could not write is a row of
 *     the pass too;
 *   - no file is written or removed while git writes the tree: git
 *     replaces a file by removing it and writing it anew, and creates
 *     one after looking that it is not there — a write of ours between
 *     its look and its write lands over git's, and a folder of ours made
 *     under its look fails its command. Such a file stands as it was (or
 *     stays unwritten), its entry kept, and the owner takes the pass
 *     again;
 *   - a file that stands and would not be read (`tree-file.ts`) is not
 *     known to be the engine's write: it is neither written over nor
 *     removed, its entry kept. One another program holds for now
 *     (Windows' sharing violation) is counted held like a file under
 *     git's writing, and the owner takes the pass again;
 *   - runs are chained — a materialize never interleaves with another
 *     (§8 single actor per tree).
 */

import { setTimeout as delay } from 'node:timers/promises';
import {
  planWorkspaceDocuments,
  type TreeIssue,
  type TreeUnknownFields,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import {
  INDEX_BUSY_WAITS_MS,
  isBusy,
  TreeBoundary,
  type TreeRefusal,
  type TreeWritesWatch,
  treeRefusalIssue,
} from '../git';
import { ensureTreeHygiene, TREE_HYGIENE_FILES } from './hygiene';
import { hashTreeContent, type MaterializedIndex, readMaterializedIndex, writeMaterializedIndex } from './sidecar';
import { readWrittenFile } from './tree-file';

export interface MaterializeSnapshot {
  state: WorkspaceTreeState;
  unknowns?: TreeUnknownFields;
}

export interface MaterializeResult {
  written: string[];
  deleted: string[];
  unchanged: number;
  /**
   * Files the pass would have written or removed while git wrote the
   * tree, and files another program held as the pass came to them. Set,
   * they stand as they were with their entries kept — one the tree
   * never held stays unwritten, with no entry.
   */
  held?: number;
  /**
   * The rows of what the pass did not write: a document the plan left
   * out for a path no tree can hold, what the folder's boundary
   * refused — one row a cause, a directory once however much lies
   * beneath it — and a hygiene file whose name something that is no
   * file stands at. Empty when everything could be written.
   */
  unwritten: TreeIssue[];
  /**
   * The documents the folder's boundary kept the pass from writing, each
   * as planned: what the engine holds there and the disk does not. A pass
   * that records the tree lays them into its commit (`pass-writes.ts`).
   */
  refused: Map<string, string>;
  /**
   * Where the boundary stopped the pass: a directory on a document's way
   * that is a link or a file, a document's own name a link stands at —
   * each once, however much lies beneath it. What git reads there is the
   * link and the documents gone; a commit of the whole tree leaves each
   * as HEAD has it (`commitWorkspaceTree`).
   */
  refusedAt: string[];
}

export interface WorkspaceTreeMaterializerOptions {
  /** Absolute path of the bound workspace tree. */
  rootDir: string;
  /** Snapshot provider — called once per materialize pass. */
  readSnapshot: () => Promise<MaterializeSnapshot>;
  /** Quiescence window for {@link WorkspaceTreeMaterializer.schedule}. */
  debounceMs?: number;
  /**
   * Opens a watch of git's writes to the tree before a pass writes.
   * Absent (no git plane), nothing ever writes.
   */
  watchTreeWrites?: () => Promise<TreeWritesWatch>;
  /** A pass left `held` files to git — the owner takes the pass again. */
  onHeld?: (held: number) => void;
  /** Every pass's `unwritten` rows, as it ends — the owner's rows of the pass before are those no longer. */
  onUnwritten?: (rows: TreeIssue[]) => void;
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

const DEFAULT_DEBOUNCE_MS = 500;

/** What a pass that records the tree answers, as `index-locked`, when git's writing held the flush before it. */
export const TREE_HELD_DETAIL = 'another git process is writing the working tree';

export class WorkspaceTreeMaterializer {
  private readonly rootDir: string;
  private readonly readSnapshot: () => Promise<MaterializeSnapshot>;
  private readonly debounceMs: number;
  private readonly watchTreeWrites: (() => Promise<TreeWritesWatch>) | undefined;
  private readonly onHeld: ((held: number) => void) | undefined;
  private readonly onUnwritten: ((rows: TreeIssue[]) => void) | undefined;
  private readonly log: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
  private timer: NodeJS.Timeout | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(options: WorkspaceTreeMaterializerOptions) {
    this.rootDir = options.rootDir;
    this.readSnapshot = options.readSnapshot;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.watchTreeWrites = options.watchTreeWrites;
    this.onHeld = options.onHeld;
    this.onUnwritten = options.onUnwritten;
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

  /**
   * A pass for a caller that records the tree next — a commit, an
   * integration, a rollback. What git's writing held is not on disk, and
   * a tree recorded then is recorded without it: the pass is taken again
   * on the waits a busy index lock is given, and answers `held` only
   * when git never let go — the caller refuses as for that lock. What it
   * answers as written and deleted is every attempt's, not the last's;
   * what the boundary refused is the last's — the folder as it stands.
   */
  async flushCurrent(): Promise<MaterializeResult> {
    const written = new Set<string>();
    const deleted = new Set<string>();
    for (let attempt = 0; ; attempt += 1) {
      const pass = await this.flush();
      for (const filePath of pass.written) written.add(filePath);
      for (const filePath of pass.deleted) deleted.add(filePath);
      if (pass.held === undefined || attempt >= INDEX_BUSY_WAITS_MS.length) {
        return { ...pass, written: [...written], deleted: [...deleted] };
      }
      await delay(INDEX_BUSY_WAITS_MS[attempt]);
    }
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
    const plan = planWorkspaceDocuments(snapshot.state, snapshot.unknowns ?? {});
    const previous = await readMaterializedIndex(this.rootDir);
    const boundary = new TreeBoundary(this.rootDir);
    const unwritten = new Map(plan.unheld.map((row) => [row.path, row] as const));
    const kept = new Map<string, string>();
    const stops = new Set<string>();
    const refused = (filePath: string, refusal: TreeRefusal, text: string): void => {
      kept.set(filePath, text);
      if (refusal.kind === 'way') stops.add(refusal.dir);
      else if (refusal.kind === 'place') stops.add(filePath);
      const row = treeRefusalIssue(filePath, refusal);
      if (!unwritten.has(row.path)) unwritten.set(row.path, row);
    };

    // Git holds its writing to the end of its command, and the index it
    // leaves stays new: once met, met for the rest of the pass.
    const treeWrites = await this.watchTreeWrites?.();
    let gitWrote = false;
    const gitWrites = async (): Promise<boolean> => {
      gitWrote ||= (await treeWrites?.met()) === true;
      return gitWrote;
    };

    const hygiene = await ensureTreeHygiene(this.rootDir, gitWrites);
    for (const row of hygiene.unwritten) unwritten.set(row.path, row);
    const written: string[] = hygiene.written;
    let held = hygiene.held;
    let unchanged = 0;
    const planned: MaterializedIndex = {};

    for (const file of plan.files) {
      const baseline = previous[file.path];
      const placed = await boundary.locate(file.path);
      if (!placed.ok) {
        if (baseline !== undefined) planned[file.path] = baseline;
        refused(file.path, placed.refusal, file.content);
        continue;
      }
      const existing = await readWrittenFile(placed.place.file);
      if (existing.kind === 'link') {
        if (baseline !== undefined) planned[file.path] = baseline;
        refused(file.path, { kind: 'place', stands: 'link' }, file.content);
        continue;
      }
      if (existing.kind === 'text' && existing.content === file.content) {
        planned[file.path] = hashTreeContent(file.content);
        unchanged += 1;
        continue;
      }
      if (existing.kind === 'unread') {
        if (baseline !== undefined) planned[file.path] = baseline;
        if (isBusy(existing.code)) held += 1;
        continue;
      }
      // Rung-2 guard: bytes that moved off the baseline (or a file the
      // engine never wrote) are pending EXTERNAL input — overwriting
      // them would destroy a hand edit the sweep hasn't ingested yet.
      // Leave the file alone and keep its baseline entry (if any) so
      // the sweep still classifies it as externally changed. A file the
      // baseline lists and the disk no longer holds is the same input —
      // a hand delete, or git between removing a file and writing it
      // anew, where a write here would land over git's.
      const pendingExternal =
        existing.kind === 'absent'
          ? baseline !== undefined
          : baseline === undefined || hashTreeContent(existing.content) !== baseline;
      if (pendingExternal) {
        if (baseline !== undefined) planned[file.path] = baseline;
        continue;
      }
      // Any file is one git may be replacing, or creating where the
      // tree never held it. Looked for before the folder and the temp
      // file, so a lock held long leaves nothing behind pass after
      // pass; and again before the rename, for a command that began
      // while the temp file was written.
      if (await gitWrites()) {
        if (baseline !== undefined) planned[file.path] = baseline;
        held += 1;
        continue;
      }
      const staging = await boundary.stage(placed.place, file.content);
      if (!staging.ok) {
        if (baseline !== undefined) planned[file.path] = baseline;
        refused(file.path, staging.refusal, file.content);
        continue;
      }
      if (await gitWrites()) {
        await staging.staged.discard();
        if (baseline !== undefined) planned[file.path] = baseline;
        held += 1;
        continue;
      }
      await staging.staged.land();
      planned[file.path] = hashTreeContent(file.content);
      written.push(file.path);
    }

    const deleted: string[] = [];
    for (const stale of Object.keys(previous)) {
      if (stale in planned) continue;
      // An index written while the plan still held the hygiene files
      // lists them: they leave the baseline here, never the disk.
      if (TREE_HYGIENE_FILES.has(stale)) continue;
      // A baseline is a file on disk like any other, and a link may
      // stand on the way since the entry was made: a path the boundary
      // refuses is not ours to remove. Its entry goes; the disk stands.
      const placed = await boundary.locate(stale);
      if (!placed.ok) continue;
      // Same rung-2 guard on the delete side: only sweep away bytes
      // this materializer wrote. A file that changed since is external
      // input — drop it from the baseline (it is no longer ours) and
      // let the sweep decide what it means.
      const existing = await readWrittenFile(placed.place.file);
      // A link at the name is no write of ours, like a path the boundary refuses.
      if (existing.kind === 'link') continue;
      if (existing.kind === 'text' && hashTreeContent(existing.content) !== previous[stale]) continue;
      if (existing.kind === 'unread') {
        planned[stale] = previous[stale];
        if (isBusy(existing.code)) held += 1;
        continue;
      }
      // The same file git may be replacing: a removal here would take
      // the one git has just written.
      if (await gitWrites()) {
        planned[stale] = previous[stale];
        held += 1;
        continue;
      }
      await boundary.remove(placed.place);
      deleted.push(stale);
    }

    await writeMaterializedIndex(this.rootDir, planned);
    const rows = [...unwritten.values()];
    this.onUnwritten?.(rows);
    const refusedAt = [...stops];
    if (held === 0) return { written, deleted, unchanged, unwritten: rows, refused: kept, refusedAt };
    this.onHeld?.(held);
    return { written, deleted, unchanged, held, unwritten: rows, refused: kept, refusedAt };
  }
}
