// @vitest-environment jsdom
/**
 * `RollbackChangesModal` — the Commit window's Rollback Changes dialog:
 * it opens with the gesture's files checked and no other, more can be
 * checked there, the count follows what is checked, Rollback sends ONE
 * host call with exactly the checked files (and the delete of added
 * files when its box is on) and closes — nothing asks again; with
 * nothing checked Rollback is held; a refusal is said in the dialog,
 * which stays as it was; a change that appears while it is open arrives
 * unchecked.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { __resetBackgroundTasksForTests } from '@openheaders/ui/shared/background-tasks';
import RollbackChangesModal, {
  type RollbackChangesModalProps,
} from '@openheaders/ui/workbench/components/panels/git/commit/RollbackChangesModal';
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

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  if (typeof Element.prototype.scrollIntoView !== 'function') Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  mockCall.mockReset();
  __resetBackgroundTasksForTests();
});

afterEach(cleanup);

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

const ROWS = [
  row({ path: 'docs/guide.md' }),
  row({ path: 'docs/new.md', status: 'A' }),
  row({ path: 'notes.md', status: 'D' }),
];

function mount(overrides: Partial<RollbackChangesModalProps> = {}) {
  const onClose = vi.fn();
  const onRolledBack = vi.fn();
  const props: RollbackChangesModalProps = {
    workspaceId: 'ws1',
    paths: ['docs/guide.md'],
    rows: ROWS,
    groupByWorkspace: false,
    groupByDirectory: false,
    rootLabel: 'ws',
    headSha: null,
    onClose,
    onRolledBack,
    ...overrides,
  };
  const view = render(
    <AntApp>
      <RollbackChangesModal {...props} />
    </AntApp>,
  );
  const again = (next: Partial<RollbackChangesModalProps>): void =>
    view.rerender(
      <AntApp>
        <RollbackChangesModal {...props} {...next} />
      </AntApp>,
    );
  return { onClose, onRolledBack, again };
}

const fileRow = (path: string): Element =>
  [...document.querySelectorAll('[data-testid="commit-rollback-tree"] [data-testid="commit-tool-file"]')].find(
    (line) => line.getAttribute('data-path') === path,
  ) as Element;
const box = (path: string): HTMLInputElement =>
  fileRow(path).querySelector('input[type="checkbox"]') as HTMLInputElement;
const confirm = (): HTMLButtonElement => screen.getByTestId('commit-rollback-confirm') as HTMLButtonElement;

describe('RollbackChangesModal', () => {
  it('opens with the gesture’s files checked and no other; the count follows what is checked', () => {
    mount();
    expect([box('docs/guide.md').checked, box('docs/new.md').checked, box('notes.md').checked]).toEqual([
      true,
      false,
      false,
    ]);
    expect(screen.getByTestId('commit-rollback-counter').textContent).toBe('1 modified');
    fireEvent.click(box('docs/new.md'));
    fireEvent.click(box('notes.md'));
    expect(screen.getByTestId('commit-rollback-counter').textContent).toBe('1 modified, 1 added, 1 deleted');
  });

  it('Rollback sends one call with exactly the checked files and closes — nothing asks again', async () => {
    mockCall.mockResolvedValue({ ok: true, rolledBack: 2 });
    const { onClose, onRolledBack } = mount();
    fireEvent.click(box('notes.md'));
    fireEvent.click(confirm());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.rollbackPaths', { workspaceId: 'ws1', paths: ['docs/guide.md', 'notes.md'] }],
    ]);
    expect(onRolledBack).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ant-modal-confirm')).toBeNull();
  });

  it('the delete of added files rides the same call when its box is on', async () => {
    mockCall.mockResolvedValue({ ok: true, rolledBack: 1 });
    const { onClose } = mount({ paths: ['docs/new.md'] });
    fireEvent.click(screen.getByTestId('commit-rollback-delete-added'));
    fireEvent.click(confirm());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.rollbackPaths', {
      workspaceId: 'ws1',
      paths: ['docs/new.md'],
      deleteAdded: true,
    });
  });

  it('with nothing checked Rollback is held and sends nothing', () => {
    mount({ paths: [] });
    expect(confirm().disabled).toBe(true);
    fireEvent.click(confirm());
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('a refusal is said in the dialog, which stays open with its boxes as they were', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'index-locked', detail: 'held' });
    const { onClose, onRolledBack } = mount();
    fireEvent.click(confirm());
    expect((await screen.findByTestId('commit-rollback-error')).textContent).toMatch(/another git process/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(onRolledBack).not.toHaveBeenCalled();
    expect(box('docs/guide.md').checked).toBe(true);
  });

  it('a change that appears while the dialog is open arrives unchecked', () => {
    const { again } = mount();
    again({ rows: [...ROWS, row({ path: 'late.md' })] });
    expect(box('late.md').checked).toBe(false);
    expect(box('docs/guide.md').checked).toBe(true);
  });
});
