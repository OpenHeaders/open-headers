// @vitest-environment jsdom
/**
 * `useLogSearch` over a mocked bridge whose answers are held: the read
 * is keyed on its request and on what its answer stands on. A new
 * request drops the answer it replaces at once; a moved basis asks
 * again while the answer stands; the newest read's answer is the tab's;
 * a host that cannot search answers nothing and says nothing; only a
 * read the person pressed for counts as asked.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeSearchLogWire } from '@openheaders/core/bridge';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/bridge')>()),
  hostBridge: { call: mockCall, subscribe: vi.fn(), broadcast: vi.fn(), presence: vi.fn() },
}));

import type { LogSearchRequest } from '@openheaders/ui/workbench/components/panels/git/log-search';
import { useLogSearch } from '@openheaders/ui/workbench/components/panels/git/use-log-search';

function entry(sha: string): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: [],
  };
}

const page = (shas: string[], more = false): WorkspaceTreeSearchLogWire => ({
  ok: true,
  entries: shas.map(entry),
  more,
});

const PROBE: LogSearchRequest = { workspaceId: 'ws-1', key: 'log:1', text: 'probe', limit: 200, allRefs: true };
const OTHER: LogSearchRequest = { workspaceId: 'ws-1', key: 'log:1', text: 'other', limit: 200, allRefs: true };

interface Held {
  request: LogSearchRequest;
  resolve: (answer: WorkspaceTreeSearchLogWire) => void;
  reject: (fault: Error) => void;
}

/** The searches in the order they were sent, each answered by hand. */
let held: Held[] = [];

const settle = async (step: () => void): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

interface Props {
  request: LogSearchRequest | null;
  basis: string;
  press: string;
}

const mount = (initial: Props) =>
  renderHook(({ request, basis, press }: Props) => useLogSearch(request, basis, press), { initialProps: initial });

beforeEach(() => {
  held = [];
  mockCall.mockReset();
  mockCall.mockImplementation(
    (_type: string, request: LogSearchRequest) =>
      new Promise<WorkspaceTreeSearchLogWire>((resolve, reject) => {
        held.push({ request, resolve, reject });
      }),
  );
});

describe('useLogSearch', () => {
  it('asks the host nothing while there is no request', () => {
    const hook = mount({ request: null, basis: 'a', press: 'p' });
    expect(mockCall).not.toHaveBeenCalled();
    expect(hook.result.current).toEqual({ answer: null, asked: false });
  });

  it('asks once for a request and takes the host’s page', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.searchLog', PROBE);
    expect(hook.result.current.answer).toBeNull();

    await settle(() => held[0].resolve(page(['c1', 'c2'], true)));
    expect(hook.result.current.answer).toEqual({ kind: 'page', entries: ['c1', 'c2'].map(entry), more: true });

    hook.rerender({ request: PROBE, basis: 'a', press: 'p' });
    expect(held).toHaveLength(1);
  });

  it('asks again when the basis moves, the answer it has standing until the new one lands', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page(['c1'])));

    hook.rerender({ request: PROBE, basis: 'b', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(2));
    expect(hook.result.current.answer).toEqual({ kind: 'page', entries: [entry('c1')], more: false });

    await settle(() => held[1].resolve(page(['c0', 'c1'])));
    expect(hook.result.current.answer).toEqual({ kind: 'page', entries: ['c0', 'c1'].map(entry), more: false });
  });

  it('drops the answer at once when the request changes', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page(['c1'])));

    hook.rerender({ request: OTHER, basis: 'a', press: 'p2' });
    expect(hook.result.current.answer).toBeNull();
    await waitFor(() => expect(held).toHaveLength(2));
    expect(held[1].request).toBe(OTHER);

    await settle(() => held[1].resolve(page(['o1'])));
    expect(hook.result.current.answer).toEqual({ kind: 'page', entries: [entry('o1')], more: false });
  });

  it('keeps its newest read’s answer when an older read answers last', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    hook.rerender({ request: PROBE, basis: 'b', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(2));

    await settle(() => held[1].resolve(page(['new1'])));
    await settle(() => held[0].resolve(page(['old1'])));
    expect(hook.result.current.answer).toEqual({ kind: 'page', entries: [entry('new1')], more: false });
  });

  it('answers nothing once the request is gone, and takes no answer that lands after', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    hook.rerender({ request: null, basis: 'a', press: 'p' });
    await settle(() => held[0].resolve(page(['c1'])));
    expect(hook.result.current.answer).toBeNull();
  });

  it('says a search that timed out', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'search-timeout' }));
    expect(hook.result.current.answer).toEqual({ kind: 'timeout' });
  });

  it.each(['superseded', 'invalid-filter', 'log-failed', 'unknown-ref', 'not-bound'] as const)(
    'answers nothing for a search refused %s',
    async (reason) => {
      const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
      await waitFor(() => expect(held).toHaveLength(1));
      await settle(() => held[0].resolve({ ok: false, reason }));
      expect(hook.result.current).toEqual({ answer: null, asked: false });
    },
  );

  it('answers nothing, silently, for a host that predates the verb', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].reject(new Error("host: RPC 'oh.workspaceTree.searchLog' is not implemented")));
    expect(hook.result.current).toEqual({ answer: null, asked: false });
  });

  it('drops the answer it had when a newer read is refused', async () => {
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page(['c1'])));
    hook.rerender({ request: PROBE, basis: 'b', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(2));
    await settle(() => held[1].resolve({ ok: false, reason: 'superseded' }));
    expect(hook.result.current.answer).toBeNull();
  });

  it('counts as asked only a read the person pressed for, for as long as it is out', async () => {
    // The tab's own first read — a restored text — is no press.
    const hook = mount({ request: PROBE, basis: 'a', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(1));
    expect(hook.result.current.asked).toBe(false);
    await settle(() => held[0].resolve(page(['c1'])));

    // A frame moved the refs: the tab follows along.
    hook.rerender({ request: PROBE, basis: 'b', press: 'p' });
    await waitFor(() => expect(held).toHaveLength(2));
    expect(hook.result.current.asked).toBe(false);
    await settle(() => held[1].resolve(page(['c1'])));

    // Enter applied another text.
    hook.rerender({ request: OTHER, basis: 'b', press: 'p2' });
    await waitFor(() => expect(held).toHaveLength(3));
    expect(hook.result.current.asked).toBe(true);
    await settle(() => held[2].resolve(page(['o1'])));
    expect(hook.result.current.asked).toBe(false);
  });

  it('counts a press with nothing to ask as no read, and the next frame’s read as none of the person’s', async () => {
    const hook = mount({ request: null, basis: 'a', press: 'p' });
    hook.rerender({ request: null, basis: 'a', press: 'p2' });
    expect(hook.result.current.asked).toBe(false);
    hook.rerender({ request: PROBE, basis: 'a', press: 'p2' });
    await waitFor(() => expect(held).toHaveLength(1));
    expect(hook.result.current.asked).toBe(false);
  });
});
