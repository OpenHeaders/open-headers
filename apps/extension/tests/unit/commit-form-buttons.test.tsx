// @vitest-environment jsdom
/**
 * `CommitForm` — the Commit window's two buttons take a press only while
 * there is something they could send (a message, something to commit, no
 * commit out). Held, they play no spinner of their own — the window's
 * pulse is the one sign that a commit is out — and they are
 * `aria-disabled`, never natively disabled: the press that sends a
 * commit holds its own button, and a natively disabled button drops the
 * focus it holds to the page.
 */

import CommitForm, { type CommitFormProps } from '@openheaders/ui/workbench/components/panels/git/commit/CommitForm';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(cleanup);

function form(overrides: Partial<CommitFormProps> = {}): CommitFormProps {
  return {
    draft: 'probe: tune the header',
    onDraftChange: vi.fn(),
    amend: false,
    onAmendChange: vi.fn(),
    amendAuthor: null,
    counter: { modified: 1, added: 0, deleted: 0, unversioned: 0 },
    history: [],
    onHistoryOpen: vi.fn(),
    signOff: false,
    onSignOffChange: vi.fn(),
    runGitHooks: true,
    onRunGitHooksChange: vi.fn(),
    canCommit: true,
    onCommit: vi.fn(),
    error: null,
    onDismissError: vi.fn(),
    ...overrides,
  };
}

const commit = (): HTMLButtonElement => screen.getByTestId('commit-tool-commit') as HTMLButtonElement;
const commitAndPush = (): HTMLButtonElement => screen.getByTestId('commit-tool-commit-push') as HTMLButtonElement;

describe('CommitForm buttons', () => {
  it('send the commit, with and without the push, while there is one to send', () => {
    const onCommit = vi.fn();
    render(<CommitForm {...form({ onCommit })} />);
    fireEvent.click(commit());
    fireEvent.click(commitAndPush());
    expect(onCommit.mock.calls).toEqual([[false], [true]]);
    expect(commit().getAttribute('aria-disabled')).toBeNull();
  });

  it('keep the focus they hold when their own press holds them', () => {
    const view = render(<CommitForm {...form()} />);
    commit().focus();
    view.rerender(<CommitForm {...form({ canCommit: false })} />);
    expect(document.activeElement).toBe(commit());
  });

  it('are held with no spinner of their own while a commit is out — aria-disabled, never natively', () => {
    const onCommit = vi.fn();
    render(<CommitForm {...form({ canCommit: false, onCommit })} />);
    for (const button of [commit(), commitAndPush()]) {
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(button.classList.contains('ant-btn-disabled')).toBe(true);
    }
    fireEvent.click(commit());
    fireEvent.click(commitAndPush());
    expect(onCommit).not.toHaveBeenCalled();
    expect(document.querySelector('.ant-btn-loading')).toBeNull();
    expect(document.querySelector('.ant-btn-loading-icon')).toBeNull();
  });
});
