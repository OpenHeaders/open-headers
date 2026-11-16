/**
 * The histories the host holds — one per bound repo whose log is open,
 * each with the few lists made from it. Held from the first ask, let go
 * once nobody has asked for a while, and gone with the binding.
 *
 * This is the whole of what a log verb reaches: `list` answers the list
 * an ask names and `rows` a stretch of its rows; everything under them —
 * the reading, its staleness, the derivation, the bound on lists, the
 * git kept open for the rows' commits — is a file of its own here.
 */

import { logger } from '@openheaders/core/utils';
import {
  flagLogTexts,
  type GitObjectBatch,
  type GitObjectBatchOpener,
  type GitRunner,
  type GitStreamRunner,
  LOG_SCOPE_HEAD,
  listCommitsBySha,
  readCommitHeads,
  readNamedRows,
} from '../../git';
import { deriveLogList, type LogList } from './derive-list';
import type { HistoryGeneration } from './generation';
import { createListCache, type ListCache } from './list-cache';
import { type LogAsk, logAskName } from './log-ask';
import { type LogRowsPage, readLogRows } from './log-rows';
import { createRepoHistory, type RepoHistory } from './repo-history';
import { createHistoryTexts, type HistoryTexts } from './texts';

export type { LogFolding, LogList } from './derive-list';
export type { HistoryGeneration } from './generation';
export type { LogRunInfo } from './list-runs';
export { type LocatedLogRow, locateLogRow } from './locate';
export { isSifted, type LogAsk, type LogFolds, logAskName, NO_FOLDS } from './log-ask';
export type { LogRow, LogRowCommit, LogRowEdge, LogRowsPage } from './log-rows';
export type { HistoryTexts, LogTexts, LogTextsResult } from './texts';

const SCOPE = 'workspace-tree-history';

export interface LogHistoriesOptions {
  run: GitRunner;
  stream: GitStreamRunner;
  /** Opens the git a repo's commits are read through while its log is open. */
  objects: GitObjectBatchOpener;
  /** The longest one read of a whole history may take. */
  readTimeoutMs: number;
  /** The longest the walk that names a filter's commits may take. */
  walkTimeoutMs: number;
  /** The longest one read of a history's texts may take. */
  textsTimeoutMs: number;
  /** The longest a pattern may run over a history's texts. */
  patternDeadlineMs: number;
  /** A history nobody has asked of for this long is let go. */
  idleMs: number;
  /** Lists kept per workspace. */
  maxLists: number;
  /** A workspace's history was read anew: its lists are gone, and whoever shows one asks again. */
  onMoved(workspaceId: string): void;
}

type LogListRefusal =
  /** `invalid-text`: the ask's text is nothing a history is searched for. `pattern-timeout`: its pattern ran past the deadline. */
  | { ok: false; reason: 'invalid-scope' | 'invalid-text' | 'timeout' | 'pattern-timeout' | 'closed' | 'failed' }
  /** The scope names refs the history does not hold. */
  | { ok: false; reason: 'unknown-ref'; unknownRefs: string[] };

export type LogListResult = { ok: true; list: LogList } | LogListRefusal;

/** The history's rows a part of an ask leaves listed, a flag per row — null for an ask without that part. */
type RowFlags = { ok: true; flags: Uint8Array | null } | LogListRefusal;

/** Flags that stand where both do. */
function both(one: Uint8Array | null, other: Uint8Array | null): Uint8Array | null {
  if (one === null || other === null) return one ?? other;
  for (let row = 0; row < one.length; row += 1) one[row] &= other[row];
  return one;
}

/** The members of an ask's scope a reading holds no row for — the checked-out commit is always a member. */
function unheldRefs(generation: HistoryGeneration, ask: LogAsk): string[] {
  return (ask.scope ?? []).filter((name) => name !== LOG_SCOPE_HEAD && !generation.refRows.has(name));
}

export interface LogHistories {
  /** The list `ask` names in the repo at `rootDir` — made once, kept while its history stands. */
  list(workspaceId: string, rootDir: string, ask: LogAsk): Promise<LogListResult>;
  /**
   * Rows `[from, from + count)` of a list this workspace's history
   * answered — fewer where it ends. Each commit comes off its own
   * object, through the git kept open for the repo; `files` asks for
   * its changed paths too, which is a git process and a diff a commit.
   * Null when git cannot read the commits, or the history is let go.
   */
  rows(workspaceId: string, list: LogList, from: number, count: number, files: boolean): Promise<LogRowsPage | null>;
  /** Something moved in the workspace's repo — its history is looked at before it next answers. */
  stale(workspaceId: string): void;
  /** The workspace's history and lists are let go; a read in flight ends. */
  drop(workspaceId: string): void;
  /** Every history is let go — the host is going away. */
  dispose(): void;
}

interface Held {
  rootDir: string;
  history: RepoHistory;
  /** Every commit's subject and author — read once the history is, behind whoever opened the log. */
  texts: HistoryTexts;
  /** The git the rows' commits are read through — started by the first read. */
  commits: GitObjectBatch;
  lists: ListCache<LogListResult>;
  /** Aborted when the workspace's history is let go. */
  closing: AbortController;
  /** Asks not yet answered. */
  asking: number;
  /** Counts down to the letting go; null while an ask is waited for. */
  idle: NodeJS.Timeout | null;
}

export function createLogHistories(options: LogHistoriesOptions): LogHistories {
  const held = new Map<string, Held>();

  const drop = (workspaceId: string): void => {
    const entry = held.get(workspaceId);
    if (entry === undefined) return;
    held.delete(workspaceId);
    if (entry.idle !== null) clearTimeout(entry.idle);
    entry.closing.abort();
    entry.history.close();
    entry.texts.close();
    entry.commits.close();
    entry.lists.clear();
  };

  /** The letting go is put off: it counts from the last ask answered, never under one still waited for. */
  const putOff = (workspaceId: string, entry: Held): void => {
    if (held.get(workspaceId) !== entry) return;
    if (entry.idle !== null) clearTimeout(entry.idle);
    entry.idle = setTimeout(() => drop(workspaceId), options.idleMs);
    entry.idle.unref();
  };

  /** The workspace's entry, made on the first ask. */
  const holding = (workspaceId: string, rootDir: string): Held => {
    if (held.get(workspaceId)?.rootDir !== rootDir) drop(workspaceId);
    let entry = held.get(workspaceId);
    if (entry === undefined) {
      const lists = createListCache<LogListResult>(options.maxLists);
      entry = {
        rootDir,
        lists,
        closing: new AbortController(),
        asking: 0,
        idle: null,
        commits: options.objects({ cwd: rootDir }),
        texts: createHistoryTexts({
          run: options.run,
          stream: options.stream,
          rootDir,
          readTimeoutMs: options.textsTimeoutMs,
        }),
        history: createRepoHistory({
          run: options.run,
          stream: options.stream,
          rootDir,
          readTimeoutMs: options.readTimeoutMs,
          onMoved: () => {
            lists.clear();
            options.onMoved(workspaceId);
          },
        }),
      };
      held.set(workspaceId, entry);
    }
    if (entry.idle !== null) clearTimeout(entry.idle);
    entry.idle = null;
    return entry;
  };

  /** The rows git names under the ask's User, Date and Paths. */
  const walkedRows = async (entry: Held, generation: HistoryGeneration, ask: LogAsk): Promise<RowFlags> => {
    if (ask.walk === null) return { ok: true, flags: null };
    // Under First Parent git names what ITS first-parent walk lists — a path's change a merge brought in is the merge's.
    const walked = await readNamedRows(options.stream, options.run, entry.rootDir, generation.history, {
      ...(ask.scope !== null ? { scope: ask.scope } : {}),
      filters: {
        ...ask.walk,
        ...(ask.firstParent ? { firstParent: true } : {}),
        ...(ask.scope === null ? { allRefs: true } : {}),
      },
      timeoutMs: options.walkTimeoutMs,
      signal: entry.closing.signal,
    });
    if (!walked.ok) return { ok: false, reason: walked.reason === 'aborted' ? 'closed' : walked.reason };
    return { ok: true, flags: walked.named };
  };

  /** The rows the ask's text matches — once the history's texts are read, however long ago they were asked for. */
  const matchedRows = async (entry: Held, generation: HistoryGeneration, ask: LogAsk): Promise<RowFlags> => {
    if (ask.text === null) return { ok: true, flags: null };
    const laid = await entry.texts.of(generation);
    if (!laid.ok) return laid;
    const { hashes, width } = generation.history;
    const matched = await flagLogTexts({ ...laid.texts, hashes, width }, ask.text, {
      signal: entry.closing.signal,
      patternDeadlineMs: options.patternDeadlineMs,
    });
    if (matched.ok) return matched;
    if (matched.reason === 'aborted') return { ok: false, reason: 'closed' };
    return { ok: false, reason: matched.reason === 'timeout' ? 'pattern-timeout' : 'invalid-text' };
  };

  const make = async (entry: Held, generation: HistoryGeneration, ask: LogAsk): Promise<LogListResult> => {
    // The walk first: the texts are being read behind the log that opened while git walks.
    const walked = await walkedRows(entry, generation, ask);
    if (!walked.ok) return walked;
    const matched = await matchedRows(entry, generation, ask);
    if (!matched.ok) return matched;
    return { ok: true, list: await deriveLogList(generation, ask, both(walked.flags, matched.flags)) };
  };

  return {
    async list(workspaceId, rootDir, ask) {
      const entry = holding(workspaceId, rootDir);
      entry.asking += 1;
      try {
        let opened = await entry.history.open();
        if (opened.ok && unheldRefs(opened.generation, ask).length > 0) {
          // A ref the held reading lacks may be one the reading in flight is being read for.
          const next = await entry.history.landing();
          if (next?.ok === true) opened = next;
        }
        if (!opened.ok) return opened;
        const { generation } = opened;
        // The texts are read behind the log that opened: a search finds them held, or waits for this read.
        void entry.texts.of(generation);
        const unknownRefs = unheldRefs(generation, ask);
        if (unknownRefs.length > 0) return { ok: false, reason: 'unknown-ref', unknownRefs };
        return await entry.lists.take(
          logAskName(ask),
          () => make(entry, generation, ask),
          (answer) => answer.ok,
        );
      } catch (fault) {
        logger.warn(SCOPE, `log list failed for ${rootDir}`, fault);
        return { ok: false, reason: 'failed' };
      } finally {
        entry.asking -= 1;
        if (entry.asking === 0) putOff(workspaceId, entry);
      }
    },
    rows(workspaceId, list, from, count, files) {
      const entry = held.get(workspaceId);
      if (entry === undefined) return Promise.resolve(null);
      const { rootDir, commits } = entry;
      return readLogRows(
        (shas) =>
          files
            ? listCommitsBySha(options.run, rootDir, shas, true)
            : readCommitHeads(commits, options.run, rootDir, shas),
        list,
        from,
        count,
      );
    },
    stale(workspaceId) {
      held.get(workspaceId)?.history.stale();
    },
    drop,
    dispose() {
      for (const workspaceId of [...held.keys()]) drop(workspaceId);
    },
  };
}
