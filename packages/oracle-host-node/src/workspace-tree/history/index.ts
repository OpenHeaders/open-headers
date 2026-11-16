/**
 * The histories the host holds — one per bound repo whose log is open,
 * each with the few lists made from it. Held from the first ask, let go
 * once nobody has asked for a while, and gone with the binding.
 *
 * This is the whole of what a log verb reaches: `list` answers the list
 * an ask names; everything under it — the reading, its staleness, the
 * derivation, the bound on lists — is a file of its own here.
 */

import { logger } from '@openheaders/core/utils';
import { type GitRunner, type GitStreamRunner, LOG_SCOPE_HEAD, readNamedRows } from '../../git';
import { deriveLogList, type LogList } from './derive-list';
import type { HistoryGeneration } from './generation';
import { createListCache, type ListCache } from './list-cache';
import { type LogAsk, logAskName } from './log-ask';
import { createRepoHistory, type RepoHistory } from './repo-history';
import { createHistoryTexts, type HistoryTexts } from './texts';

export type { LogFolding, LogList } from './derive-list';
export type { HistoryGeneration } from './generation';
export type { LogRunInfo } from './list-runs';
export { type LocatedLogRow, locateLogRow } from './locate';
export { isSifted, type LogAsk, type LogFolds, logAskName, NO_FOLDS } from './log-ask';
export { type LogRow, type LogRowEdge, type LogRowsPage, readLogRows } from './log-rows';
export type { HistoryTexts, LogTexts, LogTextsResult } from './texts';

const SCOPE = 'workspace-tree-history';

export interface LogHistoriesOptions {
  run: GitRunner;
  stream: GitStreamRunner;
  /** The longest one read of a whole history may take. */
  readTimeoutMs: number;
  /** The longest the walk that names a filter's commits may take. */
  walkTimeoutMs: number;
  /** The longest one read of a history's texts may take. */
  textsTimeoutMs: number;
  /** A history nobody has asked of for this long is let go. */
  idleMs: number;
  /** Lists kept per workspace. */
  maxLists: number;
  /** A workspace's history was read anew: its lists are gone, and whoever shows one asks again. */
  onMoved(workspaceId: string): void;
}

export type LogListResult =
  | { ok: true; list: LogList }
  | { ok: false; reason: 'invalid-scope' | 'timeout' | 'closed' | 'failed' }
  /** The scope names refs the history does not hold. */
  | { ok: false; reason: 'unknown-ref'; unknownRefs: string[] };

/** The members of an ask's scope a reading holds no row for — the checked-out commit is always a member. */
function unheldRefs(generation: HistoryGeneration, ask: LogAsk): string[] {
  return (ask.scope ?? []).filter((name) => name !== LOG_SCOPE_HEAD && !generation.refRows.has(name));
}

export interface LogHistories {
  /** The list `ask` names in the repo at `rootDir` — made once, kept while its history stands. */
  list(workspaceId: string, rootDir: string, ask: LogAsk): Promise<LogListResult>;
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

  const make = async (entry: Held, generation: HistoryGeneration, ask: LogAsk): Promise<LogListResult> => {
    let named: Uint8Array | null = null;
    if (ask.walk !== null) {
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
      named = walked.named;
    }
    return { ok: true, list: await deriveLogList(generation, ask, named) };
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
    stale(workspaceId) {
      held.get(workspaceId)?.history.stale();
    },
    drop,
    dispose() {
      for (const workspaceId of [...held.keys()]) drop(workspaceId);
    },
  };
}
