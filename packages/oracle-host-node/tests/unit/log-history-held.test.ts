/**
 * A repo's history as the host holds it (`history/repo-history`, the
 * histories' one door): read once and answered from then on; looked at
 * again only after something is said to have moved, and read again only
 * when a ref or the checked-out commit did — whole, in the background,
 * the reading it replaces answering meanwhile; the few lists kept by
 * the name of what was asked; all of it let go when nobody asks. Real
 * git in a scratch repo.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitStreamRunner } from '../../src/git/git-stream';
import {
  createLogHistories,
  type LogAsk,
  type LogHistories,
  type LogList,
  NO_FOLDS,
} from '../../src/workspace-tree/history';
import { logAskName } from '../../src/workspace-tree/history/log-ask';
import { openScratchRepo, run, type ScratchRepo, seedHistory, stream } from './_log-history-repo';

const WS = 'ws-1';

const ask = (over: Partial<LogAsk> = {}): LogAsk => ({
  scope: null,
  topological: false,
  firstParent: false,
  noMerges: false,
  walk: null,
  folds: NO_FOLDS,
  ...over,
});

describe('a history the host holds', () => {
  let repo: ScratchRepo;
  let histories: LogHistories;
  let moved: string[];
  /** Whole-history reads started so far. */
  let reads: number;
  /** Walks that name a filter's commits started so far. */
  let walks: number;
  /** While set, a whole-history read waits for it before it starts. */
  let gate: Promise<void> | null;
  let onMoved: () => void;

  const counted: GitStreamRunner = async (args, options, read) => {
    if (args.includes('--parents')) {
      reads += 1;
      if (gate !== null) await gate;
    }
    if (args.includes('--format=%H')) walks += 1;
    return stream(args, options, read);
  };
  const open = (idleMs = 600_000, maxLists = 4): LogHistories =>
    createLogHistories({
      run,
      stream: counted,
      readTimeoutMs: 20_000,
      walkTimeoutMs: 20_000,
      idleMs,
      maxLists,
      onMoved: (workspaceId) => {
        moved.push(workspaceId);
        onMoved();
      },
    });
  const read = async (over: Partial<LogAsk> = {}): Promise<LogList> => {
    const result = await histories.list(WS, repo.rootDir, ask(over));
    if (!result.ok) throw new Error(`list refused: ${result.reason}`);
    return result.list;
  };
  /** Resolves when the next reading lands. */
  const nextMove = (): Promise<void> =>
    new Promise((resolve) => {
      onMoved = resolve;
    });

  beforeEach(async () => {
    repo = await openScratchRepo('oh-log-history-held-');
    await seedHistory(repo);
    moved = [];
    reads = 0;
    walks = 0;
    gate = null;
    onMoved = () => undefined;
    histories = open();
  });

  afterEach(async () => {
    histories.dispose();
    await repo.remove();
  });

  it('reads the history once and answers the same list to the same ask', async () => {
    const [first, second] = await Promise.all([read(), read()]);
    expect(second).toBe(first);
    expect(await read()).toBe(first);
    expect((await read({ noMerges: true })).generation).toBe(first.generation);
    expect(reads).toBe(1);
    expect(moved).toEqual([]);
  });

  it('keeps its reading while no tip has moved, however often something is said to have', async () => {
    const first = await read();
    histories.stale(WS);
    histories.stale(WS);
    expect(await read()).toBe(first);
    // A file changed and nothing committed: the tips stand.
    await repo.git(['status']);
    histories.stale(WS);
    expect(await read()).toBe(first);
    expect(reads).toBe(1);
    expect(moved).toEqual([]);
  });

  it('does not look at a repo nobody said moved', async () => {
    const first = await read();
    await repo.commit('Unannounced', 'notes.md');
    expect(await read()).toBe(first);
    // Long enough for a read started behind that answer to have landed.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await read()).toBe(first);
    expect(reads).toBe(1);
    expect(moved).toEqual([]);
  });

  it('reads again when a tip moved — the old reading answering until the new one lands', async () => {
    const first = await read();
    await repo.commit('Fix the release notes', 'notes.md');
    histories.stale(WS);

    let release: () => void = () => undefined;
    gate = new Promise((resolve) => {
      release = resolve;
    });
    const landed = nextMove();
    // The look finds the moved tip and starts the read; the answer does not wait for it.
    expect(await read()).toBe(first);
    expect(await read({ noMerges: true })).toHaveProperty('generation', first.generation);
    expect(moved).toEqual([]);

    release();
    await landed;
    expect(moved).toEqual([WS]);
    const second = await read();
    expect(second).not.toBe(first);
    expect(second.generation.id).not.toBe(first.generation.id);
    expect(second.skeleton.count).toBe(first.skeleton.count + 1);
    expect(reads).toBe(2);
  });

  it('reads again for a ref made, moved or deleted, and for a checkout — a tip is every ref and the checked-out commit', async () => {
    let held = await read();
    const moves: string[][] = [
      ['branch', 'spike-2', 'HEAD~2'],
      ['tag', 'v2', 'HEAD~1'],
      ['branch', '-f', 'spike-2', 'HEAD~3'],
      ['branch', '-D', 'spike-2'],
      ['checkout', '-q', 'other'],
      ['checkout', '-q', '--detach', 'HEAD~1'],
    ];
    for (const args of moves) {
      await repo.git(args);
      const landed = nextMove();
      histories.stale(WS);
      await read();
      await landed;
      const next = await read();
      expect(next.generation.id).not.toBe(held.generation.id);
      held = next;
    }
    expect(moved).toHaveLength(moves.length);
  });

  it('keeps the lists longest unasked no longer than its bound', async () => {
    histories.dispose();
    histories = open(600_000, 2);
    const plain = await read();
    const noMerges = await read({ noMerges: true });
    const firstParent = await read({ firstParent: true });
    // Two are kept: the first asked gave way.
    expect(await read({ firstParent: true })).toBe(firstParent);
    expect(await read({ noMerges: true })).toBe(noMerges);
    const again = await read();
    expect(again).not.toBe(plain);
    expect(again.generation).toBe(plain.generation);
    // Asking is what keeps a list: the one just made stays, the one asked before it gives way.
    expect(await read({ noMerges: true })).toBe(noMerges);
    expect(await read({ firstParent: true })).not.toBe(firstParent);
    expect(reads).toBe(1);
  });

  it('lets a history go once nobody has asked for a while, and reads it afresh on the next ask', async () => {
    histories.dispose();
    histories = open(300);
    const first = await read();
    await new Promise((resolve) => setTimeout(resolve, 200));
    // An ask puts the letting go off.
    expect(await read()).toBe(first);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await read()).toBe(first);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const second = await read();
    expect(second.generation.id).not.toBe(first.generation.id);
    expect(reads).toBe(2);
    expect(moved).toEqual([]);
  });

  it('lets a workspace’s history go when told to, and no other’s', async () => {
    const mine = await read();
    const theirs = await histories.list('ws-2', repo.rootDir, ask());
    histories.drop(WS);
    expect((await read()).generation.id).not.toBe(mine.generation.id);
    expect(await histories.list('ws-2', repo.rootDir, ask())).toBe(theirs);
    expect(reads).toBe(3);
  });

  it('refuses a folder that is no repo, and a walk over a ref git does not know', async () => {
    expect(await histories.list('ws-3', '/nowhere/at/all', ask())).toEqual({ ok: false, reason: 'failed' });
    expect(await histories.list(WS, repo.rootDir, ask({ scope: ['nowhere'], walk: { author: 'Jane' } }))).toEqual({
      ok: false,
      reason: 'failed',
    });
    // What could not be made is not kept: the same ask is tried again.
    expect(await histories.list(WS, repo.rootDir, ask({ scope: ['nowhere'], walk: { author: 'Jane' } }))).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(walks).toBe(2);
    // What was made is: the same ask walks once.
    await read({ walk: { author: 'Jane' } });
    await read({ walk: { author: 'Jane' } });
    expect(walks).toBe(3);
  });
});

describe('an ask’s name', () => {
  it('is one for two asks that list the same, and another for any that does not', () => {
    const name = logAskName(ask({ scope: ['main', 'HEAD'], walk: { authors: ['John', 'Jane'], paths: ['b', 'a'] } }));
    expect(
      logAskName(ask({ scope: ['HEAD', 'main', 'main'], walk: { authors: ['Jane', 'John'], paths: ['a', 'b'] } })),
    ).toBe(name);
    expect(logAskName(ask({ walk: { author: 'Jane' } }))).toBe(logAskName(ask({ walk: { authors: ['Jane'] } })));
    expect(logAskName(ask({ folds: { all: false, runs: ['b', 'a'] } }))).toBe(
      logAskName(ask({ folds: { all: false, runs: ['a', 'b', 'a'] } })),
    );
    // A sifted list folds nothing, so what it is asked to fold names no other list.
    expect(logAskName(ask({ noMerges: true, folds: { all: true, runs: [] } }))).toBe(
      logAskName(ask({ noMerges: true })),
    );

    const others: Array<Partial<LogAsk>> = [
      { scope: ['main'] },
      { scope: [] },
      { topological: true },
      { firstParent: true },
      { noMerges: true },
      { walk: {} },
      { walk: { author: 'Jane' } },
      { walk: { since: '2026-01-01' } },
      { walk: { until: '2026-01-01' } },
      { walk: { paths: ['a'] } },
      { folds: { all: true, runs: [] } },
      { folds: { all: false, runs: ['a'] } },
      { folds: { all: true, runs: ['a'] } },
    ];
    const names = new Set([logAskName(ask()), ...others.map((over) => logAskName(ask(over)))]);
    expect(names.size).toBe(others.length + 1);
  });
});
