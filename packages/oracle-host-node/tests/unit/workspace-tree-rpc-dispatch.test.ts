/**
 * The dispatcher's reading of a pass's answers — what a pull, a merge
 * and a pick or revert carry on the call that follows a question: the
 * `resolution` (an answer per file, or one side for all, with the token
 * it was made against) and the `commitLocal` word. What is no answer is
 * refused before the runtime is asked; what is one is handed on in the
 * shape the pass reads, in that verb's own argument.
 */

import { describe, expect, it, vi } from 'vitest';
import { dispatchWorkspaceTreeRpc } from '../../src/workspace-tree/rpc-dispatch';
import type { WorkspaceTreeRuntime } from '../../src/workspace-tree/runtime';

/** Every member a spy: the interface growing is a type error here. */
function runtime(): WorkspaceTreeRuntime {
  return {
    start: vi.fn(),
    onSyncEvent: vi.fn(),
    bind: vi.fn(),
    adopt: vi.fn(),
    unbind: vi.fn(),
    probe: vi.fn(),
    list: vi.fn(),
    openCount: vi.fn(),
    commit: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    pushNewBranch: vi.fn(),
    setAutoPushOnCommit: vi.fn(),
    resolveForcePush: vi.fn(),
    switchBranch: vi.fn(),
    createBranch: vi.fn(),
    createTag: vi.fn(),
    abortOperation: vi.fn(),
    deleteBranch: vi.fn(),
    updateBranch: vi.fn(),
    fetch: vi.fn(),
    mergeBranch: vi.fn(),
    applyCommit: vi.fn(),
    notifyAppFocus: vi.fn(),
    gitStatus: vi.fn(),
    log: vi.fn(),
    logRows: vi.fn(),
    locateLogRow: vi.fn(),
    changes: vi.fn(),
    workingFileDiff: vi.fn(),
    userCommit: vi.fn(),
    ignorePath: vi.fn(),
    unignorePath: vi.fn(),
    addToVcs: vi.fn(),
    rollbackPaths: vi.fn(),
    deletePaths: vi.fn(),
    fileLog: vi.fn(),
    entityAtPath: vi.fn(),
    entitiesAtCommit: vi.fn(),
    listRefs: vi.fn(),
    listRemotes: vi.fn(),
    checkRemoteUrl: vi.fn(),
    addRemote: vi.fn(),
    updateRemote: vi.fn(),
    removeRemote: vi.fn(),
    compareRefs: vi.fn(),
    fileDiff: vi.fn(),
    commitParentChanges: vi.fn(),
    commitSignatures: vi.fn(),
    treeFiles: vi.fn(),
    commitPatch: vi.fn(),
    gitConsole: vi.fn(),
    setCommitCadence: vi.fn(),
    setBypassHooks: vi.fn(),
    notifyAppBlur: vi.fn(),
    issues: vi.fn(),
    headStamp: vi.fn(),
    dispose: vi.fn(),
  };
}

const WORKSPACE = 'ws-dispatch';
const SHA = 'a'.repeat(40);

interface Pass {
  type: string;
  /** The call's own fields, beside the answers. */
  fields: Record<string, unknown>;
  method: 'pull' | 'mergeBranch' | 'applyCommit';
  /** The runtime call for the answers the dispatcher read — each verb takes them in its own places. */
  called: (resolution: unknown, commitLocal: unknown) => unknown[];
}

const PASSES: Pass[] = [
  {
    type: 'oh.workspaceTree.pull',
    fields: {},
    method: 'pull',
    called: (resolution, commitLocal) => [WORKSPACE, commitLocal, resolution],
  },
  {
    type: 'oh.workspaceTree.mergeBranch',
    fields: { ref: 'origin/main' },
    method: 'mergeBranch',
    called: (resolution, commitLocal) => [WORKSPACE, 'origin/main', commitLocal, resolution],
  },
  {
    type: 'oh.workspaceTree.applyCommit',
    fields: { sha: SHA, mode: 'revert' },
    method: 'applyCommit',
    called: (resolution, commitLocal) => [WORKSPACE, SHA, 'revert', resolution, commitLocal],
  },
];

const MALFORMED: [string, unknown][] = [
  ['a text', 'theirs'],
  ['null', null],
  ['a list', [{ token: 't', side: 'theirs' }]],
  ['no token', { side: 'theirs' }],
  ['a token that is no text', { token: 7, side: 'theirs' }],
  ['a token alone', { token: 't' }],
  ['a side that is neither', { token: 't', side: 'ours' }],
  ['a side beside files', { token: 't', side: 'mine', files: [] }],
  ['files that are no list', { token: 't', files: { path: 'a.yaml', content: '' } }],
  ['a file that is a path alone', { token: 't', files: ['a.yaml'] }],
  ['a file with no content', { token: 't', files: [{ path: 'a.yaml' }] }],
  ['a file whose path is no text', { token: 't', files: [{ path: 3, content: '' }] }],
  [
    'more files than a resolution may carry',
    { token: 't', files: Array.from({ length: 2_001 }, (_, index) => ({ path: `f${index}.yaml`, content: '' })) },
  ],
];

describe.each(PASSES)('$type — the answers', (pass) => {
  const send = async (host: WorkspaceTreeRuntime, answers: Record<string, unknown>): Promise<unknown> =>
    dispatchWorkspaceTreeRpc(host, pass.type, { workspaceId: WORKSPACE, ...pass.fields, ...answers });

  it('a first call carries none', async () => {
    const host = runtime();
    await send(host, {});
    expect(host[pass.method]).toHaveBeenCalledTimes(1);
    expect(host[pass.method]).toHaveBeenCalledWith(...pass.called(undefined, undefined));
  });

  it('an answer per file travels as the token and each file’s path and content — nothing else of it', async () => {
    const host = runtime();
    await send(host, {
      resolution: {
        token: 'tok-1',
        files: [
          { path: 'requests/git-pass/status/request.yaml', content: 'name: Status\n', theirs: 'left on the wire' },
          { path: 'notes/orders.md', content: '' },
        ],
        extra: true,
      },
    });
    expect(host[pass.method]).toHaveBeenCalledWith(
      ...pass.called(
        {
          token: 'tok-1',
          files: [
            { path: 'requests/git-pass/status/request.yaml', content: 'name: Status\n' },
            { path: 'notes/orders.md', content: '' },
          ],
        },
        undefined,
      ),
    );
  });

  it('a list of no files is still an answer — the pass rules on it', async () => {
    const host = runtime();
    await send(host, { resolution: { token: 'tok-1', files: [] } });
    expect(host[pass.method]).toHaveBeenCalledWith(...pass.called({ token: 'tok-1', files: [] }, undefined));
  });

  it.each(['theirs', 'mine'])('one side for all travels as the token and the side: %s', async (side) => {
    const host = runtime();
    await send(host, { resolution: { token: 'tok-2', side, files: undefined } });
    expect(host[pass.method]).toHaveBeenCalledWith(...pass.called({ token: 'tok-2', side }, undefined));
  });

  it.each(MALFORMED)('what is no answer is refused before the runtime is asked: %s', async (_what, resolution) => {
    const host = runtime();
    expect(await send(host, { resolution })).toEqual({
      ok: false,
      reason: 'resolution-invalid',
      detail: 'malformed resolution',
    });
    expect(host[pass.method]).not.toHaveBeenCalled();
  });

  it('the word to commit local work first travels trimmed, beside the answers', async () => {
    const host = runtime();
    await send(host, {
      commitLocal: { message: '  update the probe header \n' },
      resolution: { token: 't', side: 'mine' },
    });
    expect(host[pass.method]).toHaveBeenCalledWith(
      ...pass.called({ token: 't', side: 'mine' }, { message: 'update the probe header' }),
    );
  });

  it.each([
    ['no message', {}],
    ['a blank message', { message: '  \n' }],
    ['a text', 'commit it'],
  ])('a word that carries no message is refused: %s', async (_what, commitLocal) => {
    const host = runtime();
    expect(await send(host, { commitLocal })).toEqual({
      ok: false,
      reason: 'commit-failed',
      detail: 'empty commit message',
    });
    expect(host[pass.method]).not.toHaveBeenCalled();
  });
});

describe('a pass with no host behind it', () => {
  it.each(PASSES)('$type answers not-bound whatever it carries', async (pass) => {
    expect(
      await dispatchWorkspaceTreeRpc(null, pass.type, { workspaceId: WORKSPACE, ...pass.fields, resolution: 'nope' }),
    ).toEqual({ ok: false, reason: 'not-bound' });
  });
});

describe('oh.workspaceTree.searchLog — a verb this host no longer has', () => {
  it('answers as any verb it does not implement — a text rides the list’s ask', async () => {
    const host = runtime();
    expect(
      await dispatchWorkspaceTreeRpc(host, 'oh.workspaceTree.searchLog', { workspaceId: WORKSPACE, text: 'orders' }),
    ).toEqual({
      __error: "host: RPC 'oh.workspaceTree.searchLog' is not implemented",
    });
  });
});

describe('oh.workspaceTree.logRows / locateLogRow — the ask as the runtime is handed it', () => {
  const ROWS = 'oh.workspaceTree.logRows';
  const LOCATE = 'oh.workspaceTree.locateLogRow';
  const FIRST = 'a'.repeat(40);

  it('a stretch alone asks the checked-out commit’s history, with no scope, no fold and no filter', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, ROWS, { workspaceId: WORKSPACE, from: 0, count: 200 });
    expect(host.logRows).toHaveBeenCalledWith(WORKSPACE, { filters: {} }, 0, 200);
  });

  it('the key, the scope, the order, the sifts, the folds, the refresh and the stretch each travel in their own place', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, ROWS, {
      workspaceId: WORKSPACE,
      key: 'log-2',
      from: 700_000,
      count: 400,
      refs: ['main', 'HEAD'],
      authors: ['John Doe'],
      until: '2026-08-01',
      paths: ['requests/orders'],
      topoOrder: true,
      noMerges: true,
      firstParent: true,
      foldAll: true,
      folds: [FIRST],
      refresh: true,
    });
    expect(host.logRows).toHaveBeenCalledWith(
      WORKSPACE,
      {
        key: 'log-2',
        scope: ['main', 'HEAD'],
        filters: {
          authors: ['John Doe'],
          until: '2026-08-01',
          paths: ['requests/orders'],
          noMerges: true,
          firstParent: true,
          topoOrder: true,
        },
        foldAll: true,
        folds: [FIRST],
        refresh: true,
      },
      700_000,
      400,
    );
  });

  it('every ref is a filter of the ask, and a fold or a refresh that is not the word true is left out', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, ROWS, {
      workspaceId: WORKSPACE,
      from: 0,
      count: 1,
      allRefs: true,
      foldAll: 1,
      refresh: 'yes',
    });
    expect(host.logRows).toHaveBeenCalledWith(WORKSPACE, { filters: { allRefs: true } }, 0, 1);
  });

  it('a read that asks for each commit’s changed paths says so in its ask — only the word true does', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, ROWS, { workspaceId: WORKSPACE, from: 7, count: 1, files: true });
    expect(host.logRows).toHaveBeenLastCalledWith(WORKSPACE, { filters: {}, files: true }, 7, 1);
    await dispatchWorkspaceTreeRpc(host, ROWS, { workspaceId: WORKSPACE, from: 7, count: 1, files: 'yes' });
    expect(host.logRows).toHaveBeenLastCalledWith(WORKSPACE, { filters: {} }, 7, 1);
  });

  it('the text field and its toggles travel as sent, beside the filters — a toggle that is not the word true is left out', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, ROWS, {
      workspaceId: WORKSPACE,
      from: 0,
      count: 200,
      text: '  ^orders ',
      regex: true,
      matchCase: true,
      noMerges: true,
    });
    expect(host.logRows).toHaveBeenLastCalledWith(
      WORKSPACE,
      { filters: { noMerges: true }, text: '  ^orders ', regex: true, matchCase: true },
      0,
      200,
    );
    await dispatchWorkspaceTreeRpc(host, ROWS, {
      workspaceId: WORKSPACE,
      from: 0,
      count: 200,
      text: '',
      regex: 'yes',
      matchCase: 1,
    });
    expect(host.logRows).toHaveBeenLastCalledWith(WORKSPACE, { filters: {}, text: '' }, 0, 200);
  });

  it('a target is located under the same ask', async () => {
    const host = runtime();
    await dispatchWorkspaceTreeRpc(host, LOCATE, {
      workspaceId: WORKSPACE,
      key: 'log-2',
      refs: ['main'],
      noMerges: true,
      text: 'orders',
      matchCase: true,
      target: 'HEAD',
    });
    expect(host.locateLogRow).toHaveBeenCalledWith(
      WORKSPACE,
      { key: 'log-2', scope: ['main'], filters: { noMerges: true }, text: 'orders', matchCase: true },
      'HEAD',
    );
  });

  it.each([
    ['no stretch', {}],
    ['a start that is no number', { from: '0', count: 10 }],
    ['a count that is no number', { from: 0, count: '10' }],
    ['a key that is no string', { from: 0, count: 10, key: 7 }],
    ['a scope that is no list of names', { from: 0, count: 10, refs: 'main' }],
    ['a text that is no string', { from: 0, count: 10, text: 7 }],
    ['folds that are no list', { from: 0, count: 10, folds: FIRST }],
    ['a fold that is no name', { from: 0, count: 10, folds: [FIRST, 3] }],
  ])('rows: %s is refused before the runtime is asked', async (_name, fields) => {
    const host = runtime();
    expect(await dispatchWorkspaceTreeRpc(host, ROWS, { workspaceId: WORKSPACE, ...fields })).toEqual({
      ok: false,
      reason: 'invalid-filter',
    });
    expect(host.logRows).not.toHaveBeenCalled();
  });

  it.each([
    ['no target', {}],
    ['a target that is no string', { target: 7 }],
    ['a scope with a member that is no name', { target: 'HEAD', refs: ['main', 3] }],
  ])('locate: %s is refused before the runtime is asked', async (_name, fields) => {
    const host = runtime();
    expect(await dispatchWorkspaceTreeRpc(host, LOCATE, { workspaceId: WORKSPACE, ...fields })).toEqual({
      ok: false,
      reason: 'invalid-filter',
    });
    expect(host.locateLogRow).not.toHaveBeenCalled();
  });

  it('answers not-bound with no workspace or no host behind it', async () => {
    for (const [type, fields] of [
      [ROWS, { from: 0, count: 10 }],
      [LOCATE, { target: 'HEAD' }],
    ] as const) {
      expect(await dispatchWorkspaceTreeRpc(runtime(), type, fields)).toEqual({ ok: false, reason: 'not-bound' });
      expect(await dispatchWorkspaceTreeRpc(null, type, { workspaceId: WORKSPACE, ...fields })).toEqual({
        ok: false,
        reason: 'not-bound',
      });
    }
  });
});
