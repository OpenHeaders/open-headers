// @vitest-environment jsdom
/**
 * The View Mode switch — mounted pins: the pair holds the mode in force
 * pressed and a press of the other one asks for it; in the Commit
 * window's band it stands with the View Options eye ahead of the
 * placeholders, so a narrow dock folds those first; the Compare pane's
 * inline header carries whatever tools the pane hands the tree.
 */

import CommitToolbar from '@openheaders/ui/workbench/components/panels/git/commit/CommitToolbar';
import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import type { FilesViewMode } from '@openheaders/ui/workbench/components/panels/git/files-view-mode';
import FilesViewModeSwitch from '@openheaders/ui/workbench/components/panels/git/toolbar/FilesViewModeSwitch';
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

/** jsdom lays nothing out — the band's width and its entries' are pinned per test. */
function bandWidth(width: number, entries: Record<string, number> = {}): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return entries[this.dataset.overflowKey ?? ''] ?? 0;
    },
  });
}

const pressed = (testid: string): string | null => screen.getByTestId(testid).getAttribute('aria-pressed');

function commitToolbar(viewMode: FilesViewMode, onViewModeChange = vi.fn()) {
  render(
    <CommitToolbar
      onRefresh={vi.fn()}
      canRollback={false}
      rollbackPaths={[]}
      onRollback={vi.fn()}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      prefs={{ groupByDirectory: false, showIgnored: false, signOff: false, runGitHooks: null, draft: '' }}
      onPatchPrefs={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
    />,
  );
  return onViewModeChange;
}

describe('FilesViewModeSwitch', () => {
  it('holds the mode in force pressed, and a press of the other asks for it', () => {
    const onChange = vi.fn();
    render(<FilesViewModeSwitch mode="items" onChange={onChange} testid="switch" />);
    expect(screen.getByTestId('switch').getAttribute('data-mode')).toBe('items');
    expect([pressed('switch-items'), pressed('switch-files')]).toEqual(['true', 'false']);
    fireEvent.click(screen.getByTestId('switch-files'));
    expect(onChange).toHaveBeenCalledWith('files');
  });
});

describe('the Commit window’s band', () => {
  it('carries the switch, and a press reaches the window', () => {
    bandWidth(600, { 'view-mode': 48 });
    const onViewModeChange = commitToolbar('files');
    expect([pressed('commit-tool-view-mode-items'), pressed('commit-tool-view-mode-files')]).toEqual(['false', 'true']);
    fireEvent.click(screen.getByTestId('commit-tool-view-mode-items'));
    expect(onViewModeChange).toHaveBeenCalledWith('items');
  });

  it('folds the placeholders before the switch and the eye at a narrow dock', () => {
    // 16px padding + refresh, rollback, the 48px switch, the eye and the chevron, 2px apart.
    bandWidth(16 + 24 + 2 + 24 + 2 + 48 + 2 + 24 + 2 + 24, { 'view-mode': 48 });
    commitToolbar('items');
    expect(screen.getByTestId('commit-tool-view-mode')).toBeTruthy();
    expect(screen.getByTestId('commit-tool-view-options')).toBeTruthy();
    expect(screen.getByTestId('commit-tool-toolbar-more-button')).toBeTruthy();
    expect(screen.queryByTestId('commit-tool-shelve')).toBeNull();
    expect(screen.queryByTestId('commit-tool-select-opened')).toBeNull();
  });
});

describe('a changed-files tree’s inline header', () => {
  it('carries the pane’s tools ahead of Expand All', () => {
    render(
      <FileTreeView
        files={[{ path: 'docs/guide.md', status: 'M' }]}
        loadingPath={null}
        onOpenFile={vi.fn()}
        showHeader
        headerTools={<FilesViewModeSwitch mode="files" onChange={vi.fn()} testid="header-switch" />}
      />,
    );
    const tools = screen.getByTestId('header-switch');
    const expandAll = screen.getByTestId('git-tool-files-expand-all');
    expect(tools.compareDocumentPosition(expandAll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
