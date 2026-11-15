// @vitest-environment jsdom
/**
 * Where a list is entered (`panels/git/log-entrance`,
 * `use-log-entrance`), over a mocked bridge whose answers are held: the
 * row of the tab's commit is asked the moment another listing is asked;
 * a listing is entered once — a fold and another commit after enter
 * nothing; a list with no commit to stand on, one that leaves it out
 * and a host that does not answer are entered at the top.
 */

import type { WorkspaceTreeLocateLogRowWire } from '@openheaders/core/bridge';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/bridge')>()),
  hostBridge: { call: mockCall, subscribe: vi.fn(), broadcast: vi.fn(), presence: vi.fn() },
}));

import { logEntranceAtTop, logEntranceFound } from '@openheaders/ui/workbench/components/panels/git/log-entrance';
import type { LogRowsAsk } from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import { useLogEntrance } from '@openheaders/ui/workbench/components/panels/git/use-log-entrance';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const FOLDED: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, foldAll: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

interface Asked {
  request: LogRowsAsk & { target: string };
  resolve: (answer: WorkspaceTreeLocateLogRowWire) => void;
  reject: (fault: Error) => void;
}

/** The asks in the order they were sent, each answered by hand. */
let asked: Asked[] = [];

interface Props {
  ask: LogRowsAsk | null;
  commit: string | null;
}

const mount = (ask: LogRowsAsk | null, commit: string | null) =>
  renderHook((props: Props) => useLogEntrance(props.ask, props.commit), { initialProps: { ask, commit } });

const settle = async (step: () => void = () => undefined): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const found = (row: number, list = 'g1'): WorkspaceTreeLocateLogRowWire => ({ ok: true, list, row });

beforeEach(() => {
  asked = [];
  mockCall.mockReset();
  mockCall.mockImplementation(
    (_type: string, request: LogRowsAsk & { target: string }) =>
      new Promise<WorkspaceTreeLocateLogRowWire>((resolve, reject) => {
        asked.push({ request, resolve, reject });
      }),
  );
});

describe('a list’s entrance, from the host’s answer', () => {
  it('is on the row the commit was found on, in the reading the host names', () => {
    expect(logEntranceFound(ASK, sha(7), found(120, 'g3'))).toEqual({ ask: ASK, row: 120, list: 'g3', sha: sha(7) });
  });

  it('is at the top where the list leaves the commit out, the history holds none such, or the host cannot say', () => {
    for (const reason of ['not-listed', 'not-found', 'superseded', 'log-failed'] as const) {
      expect(logEntranceFound(ASK, sha(7), { ok: false, reason })).toEqual(logEntranceAtTop(ASK));
    }
    expect(logEntranceAtTop(ASK)).toEqual({ ask: ASK, row: null });
  });
});

describe('useLogEntrance', () => {
  it('enters nothing while there is nothing to list', async () => {
    const hook = mount(null, sha(7));
    await settle();
    expect(hook.result.current).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('asks where the tab’s commit sits in the list asked — being found from its first draw', async () => {
    const hook = mount(ASK, sha(7));
    expect(hook.result.current).toBe('finding');
    await settle();
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.locateLogRow', { ...ASK, target: sha(7) });
    expect(hook.result.current).toBe('finding');

    await settle(() => asked[0].resolve(found(120)));
    expect(hook.result.current).toEqual({ ask: ASK, row: 120, list: 'g1', sha: sha(7) });
    expect(asked).toHaveLength(1);
  });

  it('enters at the top with no commit to stand on, and asks the host nothing', async () => {
    const hook = mount(ASK, null);
    await settle();
    expect(hook.result.current).toEqual({ ask: ASK, row: null });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('enters at the top where the list leaves the commit out, or the host is gone', async () => {
    const leftOut = mount(ASK, sha(7));
    await settle();
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-listed' }));
    expect(leftOut.result.current).toEqual({ ask: ASK, row: null });

    const gone = mount(ASK, sha(7));
    await settle();
    await settle(() => asked[1].reject(new Error('bridge closed')));
    expect(gone.result.current).toEqual({ ask: ASK, row: null });
  });

  it('enters a listing once: a fold of it, and another commit after, ask nothing and leave the entrance standing', async () => {
    const hook = mount(ASK, sha(7));
    await settle();
    await settle(() => asked[0].resolve(found(120)));
    const entered = hook.result.current;

    await settle(() => hook.rerender({ ask: FOLDED, commit: sha(7) }));
    expect(hook.result.current).toBe(entered);
    await settle(() => hook.rerender({ ask: FOLDED, commit: sha(9) }));
    expect(hook.result.current).toBe(entered);
    expect(asked).toHaveLength(1);
  });

  it('enters another listing anew, and the one before again when it is asked back', async () => {
    const hook = mount(ASK, sha(7));
    await settle();
    await settle(() => asked[0].resolve(found(120)));

    await settle(() => hook.rerender({ ask: OTHER, commit: sha(7) }));
    expect(hook.result.current).toBe('finding');
    expect(asked[1].request).toEqual({ ...OTHER, target: sha(7) });
    await settle(() => asked[1].resolve(found(60)));
    expect(hook.result.current).toEqual({ ask: OTHER, row: 60, list: 'g1', sha: sha(7) });

    await settle(() => hook.rerender({ ask: ASK, commit: sha(7) }));
    expect(hook.result.current).toBe('finding');
    expect(asked).toHaveLength(3);
  });

  it('asks again while the row is being found: for another commit, and under a newer ask of the listing', async () => {
    const hook = mount(ASK, sha(7));
    await settle();
    await settle(() => hook.rerender({ ask: ASK, commit: sha(9) }));
    expect(asked[1].request).toEqual({ ...ASK, target: sha(9) });
    await settle(() => hook.rerender({ ask: FOLDED, commit: sha(9) }));
    expect(asked[2].request).toEqual({ ...FOLDED, target: sha(9) });

    // Only the newest ask's answer enters the list.
    await settle(() => asked[0].resolve(found(7)));
    await settle(() => asked[1].resolve(found(9)));
    expect(hook.result.current).toBe('finding');
    await settle(() => asked[2].resolve(found(4)));
    expect(hook.result.current).toEqual({ ask: FOLDED, row: 4, list: 'g1', sha: sha(9) });
  });

  it('lets an entrance go when there is nothing to list, and enters again after', async () => {
    const hook = mount(ASK, sha(7));
    await settle();
    await settle(() => asked[0].resolve(found(120)));
    await settle(() => hook.rerender({ ask: null, commit: sha(7) }));
    expect(hook.result.current).toBeNull();
    await settle(() => hook.rerender({ ask: ASK, commit: sha(7) }));
    expect(hook.result.current).toBe('finding');
    expect(asked).toHaveLength(2);
  });
});
