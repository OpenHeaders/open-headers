// @vitest-environment jsdom
/**
 * The Git Remotes dialog (S41): the pure form model (what a draft is
 * missing, which fields an edit changes) and the mounted dialog over
 * a mocked bridge — the list reads on open, Add opens the Define
 * Remote form and sends the draft through `addRemote`, a typed
 * refusal reads inline, Edit sends only the changed field through
 * `updateRemote`, Remove confirms then calls `removeRemote`.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

import RemotesModal from '@openheaders/ui/workbench/components/panels/git/remotes/RemotesModal';
import {
  isValidRemoteName,
  remoteDraftIssue,
  remoteUpdatePatch,
} from '@openheaders/ui/workbench/components/panels/git/remotes/remote-form-model';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(cleanup);

describe('remote-form-model', () => {
  it('names follow the host gate', () => {
    expect(isValidRemoteName('origin')).toBe(true);
    expect(isValidRemoteName('up.stream_2-x')).toBe(true);
    expect(isValidRemoteName('-x')).toBe(false);
    expect(isValidRemoteName('a b')).toBe(false);
    expect(isValidRemoteName('a..b')).toBe(false);
    expect(isValidRemoteName('x.lock')).toBe(false);
  });

  it('names the first thing missing from a draft, in field order', () => {
    expect(remoteDraftIssue({ name: '', url: '' })).toBe('name-empty');
    expect(remoteDraftIssue({ name: 'a b', url: '' })).toBe('name-invalid');
    expect(remoteDraftIssue({ name: 'origin', url: '  ' })).toBe('url-empty');
    expect(remoteDraftIssue({ name: 'origin', url: '--upload-pack=x' })).toBe('url-invalid');
    expect(remoteDraftIssue({ name: ' origin ', url: ' https://openheaders.io/r.git ' })).toBeNull();
  });

  it('an edit patch carries only what changed and is null when nothing did', () => {
    const row = { name: 'origin', url: 'https://openheaders.io/one.git' };
    expect(remoteUpdatePatch(row, { name: 'origin', url: 'https://openheaders.io/one.git' })).toBeNull();
    expect(remoteUpdatePatch(row, { name: 'upstream', url: 'https://openheaders.io/one.git' })).toEqual({
      newName: 'upstream',
    });
    expect(remoteUpdatePatch(row, { name: 'origin ', url: ' https://openheaders.io/two.git' })).toEqual({
      url: 'https://openheaders.io/two.git',
    });
    expect(remoteUpdatePatch(row, { name: 'u', url: 'x' })).toEqual({ newName: 'u', url: 'x' });
  });
});

const ORIGIN = { name: 'origin', url: 'https://openheaders.io/one.git', pushUrl: null };

function mount(): void {
  render(
    <AntApp>
      <RemotesModal workspaceId="ws-1" open onClose={() => undefined} />
    </AntApp>,
  );
}

type Call = [string, Record<string, unknown>];
const callsOf = (type: string): Call[] => (mockCall.mock.calls as Call[]).filter(([t]) => t === type);

describe('RemotesModal (mounted)', () => {
  beforeEach(() => {
    mockCall.mockReset();
    mockCall.mockImplementation(async (type: string) => {
      if (type === 'oh.workspaceTree.listRemotes') return { ok: true, remotes: [ORIGIN] };
      return { ok: true };
    });
  });

  it('reads the list on open and renders a row per remote', async () => {
    mount();
    const row = await screen.findByTestId('git-remotes-row');
    expect(row.getAttribute('data-remote')).toBe('origin');
    expect(row.textContent).toContain('https://openheaders.io/one.git');
    expect(callsOf('oh.workspaceTree.listRemotes')).toHaveLength(1);
    expect((screen.getByTestId('git-remotes-edit') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('git-remotes-remove') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Add opens the form, holds OK until the draft is sendable, then sends addRemote and re-reads', async () => {
    mount();
    await screen.findByTestId('git-remotes-row');
    fireEvent.click(screen.getByTestId('git-remotes-add'));
    const ok = (await screen.findByTestId('git-remote-form-ok')) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('git-remote-form-name'), { target: { value: 'upstream' } });
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('git-remote-form-url'), { target: { value: 'https://openheaders.io/up.git' } });
    await waitFor(() => expect(ok.disabled).toBe(false));
    fireEvent.click(ok);
    await waitFor(() => expect(callsOf('oh.workspaceTree.addRemote')).toHaveLength(1));
    expect(callsOf('oh.workspaceTree.addRemote')[0][1]).toEqual({
      workspaceId: 'ws-1',
      name: 'upstream',
      url: 'https://openheaders.io/up.git',
    });
    await waitFor(() => expect(callsOf('oh.workspaceTree.listRemotes')).toHaveLength(2));
  });

  it('a typed refusal reads inline under the form', async () => {
    mockCall.mockImplementation(async (type: string) => {
      if (type === 'oh.workspaceTree.listRemotes') return { ok: true, remotes: [ORIGIN] };
      return { ok: false, reason: 'exists' };
    });
    mount();
    await screen.findByTestId('git-remotes-row');
    fireEvent.click(screen.getByTestId('git-remotes-add'));
    fireEvent.change(await screen.findByTestId('git-remote-form-name'), { target: { value: 'origin' } });
    fireEvent.change(screen.getByTestId('git-remote-form-url'), { target: { value: 'https://openheaders.io/x.git' } });
    const ok = screen.getByTestId('git-remote-form-ok') as HTMLButtonElement;
    await waitFor(() => expect(ok.disabled).toBe(false));
    fireEvent.click(ok);
    const error = await screen.findByTestId('git-remote-form-error');
    expect(error.textContent).toContain('origin');
    expect(callsOf('oh.workspaceTree.listRemotes')).toHaveLength(1);
  });

  it('Edit on the selected row sends only the changed field through updateRemote', async () => {
    mount();
    const row = await screen.findByTestId('git-remotes-row');
    fireEvent.click(row);
    const edit = screen.getByTestId('git-remotes-edit') as HTMLButtonElement;
    await waitFor(() => expect(edit.disabled).toBe(false));
    fireEvent.click(edit);
    const name = (await screen.findByTestId('git-remote-form-name')) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('origin'));
    fireEvent.change(screen.getByTestId('git-remote-form-url'), {
      target: { value: 'https://openheaders.io/two.git' },
    });
    fireEvent.click(screen.getByTestId('git-remote-form-ok'));
    await waitFor(() => expect(callsOf('oh.workspaceTree.updateRemote')).toHaveLength(1));
    expect(callsOf('oh.workspaceTree.updateRemote')[0][1]).toEqual({
      workspaceId: 'ws-1',
      name: 'origin',
      url: 'https://openheaders.io/two.git',
    });
  });

  it('Remove confirms, then calls removeRemote and re-reads', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('git-remotes-row'));
    const remove = screen.getByTestId('git-remotes-remove') as HTMLButtonElement;
    await waitFor(() => expect(remove.disabled).toBe(false));
    fireEvent.click(remove);
    fireEvent.click(await screen.findByTestId('git-remotes-remove-ok'));
    await waitFor(() => expect(callsOf('oh.workspaceTree.removeRemote')).toHaveLength(1));
    expect(callsOf('oh.workspaceTree.removeRemote')[0][1]).toEqual({ workspaceId: 'ws-1', name: 'origin' });
    await waitFor(() => expect(callsOf('oh.workspaceTree.listRemotes')).toHaveLength(2));
  });
});
