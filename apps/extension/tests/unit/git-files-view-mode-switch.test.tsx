// @vitest-environment jsdom
/**
 * The View Mode switch — mounted pins: the pair holds the mode in force
 * pressed and a press of the other one asks for it; in the Commit
 * window's band and the changes pane's it stands with the View
 * Options eye as one group between two rules, after the verbs, and a
 * narrow dock folds the tree's tail first; the
 * Compare pane's inline header carries whatever tools the pane hands
 * the tree, a rule between them and its own pair. A button that opens
 * a menu of options — the eye, the branches rail's gear — wears the
 * corner mark and says so to assistive tech; no other button does.
 */

import CommitToolbar from '@openheaders/ui/workbench/components/panels/git/commit/CommitToolbar';
import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import type { FilesViewMode } from '@openheaders/ui/workbench/components/panels/git/files-view-mode';
import { DEFAULT_GIT_LOG_VIEW_PREFS } from '@openheaders/ui/workbench/components/panels/git/git-log-view-prefs';
import GitRailActivityBar from '@openheaders/ui/workbench/components/panels/git/rail/GitRailActivityBar';
import FilesViewModeSwitch from '@openheaders/ui/workbench/components/panels/git/toolbar/FilesViewModeSwitch';
import GitDetailsToolbar from '@openheaders/ui/workbench/components/panels/git/toolbar/GitDetailsToolbar';
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

/** A band left to right: each button by its testid, a rule as `|`, the gap that pushes the rest to the far edge as `…`. */
function bandShape(testid: string): string[] {
  return [...screen.getByTestId(testid).children].flatMap((entry) => {
    const buttons = [...entry.querySelectorAll('button')].map((button) => button.getAttribute('data-testid') ?? '');
    if (buttons.length > 0) return buttons;
    return entry instanceof HTMLElement && entry.style.width === '1px' ? ['|'] : ['…'];
  });
}

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

  it('sets the switch and the eye apart as one group: the verbs, a rule, the group, a rule, the tree’s tools', () => {
    bandWidth(600, { 'view-mode': 48 });
    commitToolbar('items');
    expect(bandShape('commit-tool-toolbar')).toEqual([
      'commit-tool-refresh',
      'commit-tool-rollback',
      'commit-tool-shelve',
      '|',
      'commit-tool-view-mode-items',
      'commit-tool-view-mode-files',
      'commit-tool-view-options',
      '|',
      'commit-tool-select-opened',
      'commit-tool-expand-all',
      'commit-tool-collapse-all',
    ]);
  });

  it('marks the eye as a button with a menu behind it, and no other', () => {
    bandWidth(600, { 'view-mode': 48 });
    commitToolbar('items');
    expect(screen.getByTestId('commit-tool-view-options').getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.getByTestId('commit-tool-view-options-menu-mark')).toBeTruthy();
    expect(screen.getByTestId('commit-tool-refresh').getAttribute('aria-haspopup')).toBeNull();
    expect(screen.queryByTestId('commit-tool-refresh-menu-mark')).toBeNull();
  });

  it('folds the tree’s tail before the group at a narrow dock', () => {
    // 16px padding + refresh, rollback, shelve, a 9px rule, the 48px switch, the eye and the chevron, 2px apart.
    bandWidth(16 + 24 + 2 + 24 + 2 + 24 + 2 + 9 + 2 + 48 + 2 + 24 + 2 + 24, { 'view-mode': 48 });
    commitToolbar('items');
    expect(screen.getByTestId('commit-tool-view-mode')).toBeTruthy();
    expect(screen.getByTestId('commit-tool-view-options')).toBeTruthy();
    expect(screen.getByTestId('commit-tool-toolbar-more-button')).toBeTruthy();
    expect(screen.queryByTestId('commit-tool-select-opened')).toBeNull();
    expect(screen.queryByTestId('commit-tool-expand-all')).toBeNull();
  });
});

describe('the branches rail’s bar', () => {
  it('marks the Branches Pane Settings gear as a button with a menu behind it, and no other', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
    render(
      <GitRailActivityBar
        onHide={vi.fn()}
        onNewBranch={vi.fn()}
        onUpdateSelected={vi.fn()}
        updateSelectedEnabled={false}
        updateSelectedBusy={false}
        onDeleteBranch={vi.fn()}
        deleteEnabled={false}
        onCompareWithCurrent={vi.fn()}
        compareEnabled={false}
        onFetch={vi.fn()}
        fetchBusy={false}
        onToggleFavorite={vi.fn()}
        favoriteEnabled={false}
        onNavigateToHead={vi.fn()}
        navigateEnabled={false}
        singleClick="filter"
        onSingleClickChange={vi.fn()}
        showTags
        onShowTagsChange={vi.fn()}
        groupByDirectory
        onGroupByDirectoryChange={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('git-tool-rail-settings-button').getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.getByTestId('git-tool-rail-settings-button-menu-mark')).toBeTruthy();
    expect(screen.getByTestId('git-tool-rail-fetch').getAttribute('aria-haspopup')).toBeNull();
    expect(screen.queryByTestId('git-tool-rail-fetch-menu-mark')).toBeNull();
  });
});

describe('the changes pane’s band', () => {
  it('lists the file’s verbs, a rule, the group — no rule against the open space — then the tree’s tools at the far edge', () => {
    bandWidth(600, { 'view-mode': 48 });
    render(
      <GitDetailsToolbar
        canShowDiff={false}
        onShowDiff={vi.fn()}
        onJumpToSource={vi.fn()}
        viewMode="items"
        onViewModeChange={vi.fn()}
        prefs={DEFAULT_GIT_LOG_VIEW_PREFS}
        onPatchPrefs={vi.fn()}
        hasFiles
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    );
    expect(bandShape('git-tool-details-toolbar')).toEqual([
      'git-tool-details-diff',
      'git-tool-details-revert',
      'git-tool-details-jump',
      '|',
      'git-tool-details-view-mode-items',
      'git-tool-details-view-mode-files',
      'git-tool-details-view-options',
      '…',
      'git-tool-files-expand-all',
      'git-tool-files-collapse-all',
    ]);
  });
});

describe('a changed-files tree’s inline header', () => {
  it('carries the pane’s tools ahead of Expand All, a rule between', () => {
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
    expect(tools.nextElementSibling?.getAttribute('aria-hidden')).toBe('true');
    expect(tools.nextElementSibling?.nextElementSibling).toBe(expandAll);
  });
});
