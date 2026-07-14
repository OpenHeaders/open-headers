/**
 * PanelStatusBar footer — `subset / total` rendering and the
 * focused-tool summary scope.
 *
 * The browser's summary bar switches the request / transferred / resource
 * chips to `subset / total` whenever a filter hides at least one row, and
 * stays on single totals otherwise. The footer takes a `subset` prop (set by
 * the panel only when rows are hidden) and must render accordingly.
 *
 * Under the default `footerScope: focused`, the left side follows the
 * focused dock's active tool window: Storage / Console render the lines
 * they publish through the footer-status store, Search its session
 * summary, and a tool with nothing to say falls back to the Network line.
 */

import '@openheaders/ui/workbench/settings/schema';
import PanelStatusBar from '@openheaders/ui/panel/components/PanelStatusBar';
import type { SearchFooterStatus } from '@openheaders/ui/panel/data/footer-status';
import { setFocusedDock, setFocusedRegion } from '@openheaders/ui/panel/data/stores/focus-store';
import { setConsoleFooterStatus, setStorageFooterStatus } from '@openheaders/ui/panel/data/stores/footer-status-store';
import type { PanelToolWindowId } from '@openheaders/ui/panel/data/tool-windows';
import type { FocusedToolLayout } from '@openheaders/ui/panel/data/use-focused-tool-window';
import type { DockSlot } from '@openheaders/ui/shared/dock-layout';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
  setFocusedRegion(null);
  setStorageFooterStatus(null);
  setConsoleFooterStatus(null);
});

const ALL_SLOTS: readonly DockSlot[] = [
  'left-top',
  'left-bottom',
  'right-top',
  'right-bottom',
  'bottom-left',
  'bottom-right',
];

/** Minimal focused-tool layout: each slot's active window as given. */
function makeTl(activeBySlot: Partial<Record<DockSlot, PanelToolWindowId>>): FocusedToolLayout {
  const docks = Object.fromEntries(ALL_SLOTS.map((slot) => [slot, { active: activeBySlot[slot] ?? null }])) as Record<
    DockSlot,
    { active: PanelToolWindowId | null }
  >;
  return {
    state: { docks },
    dockOf: (id) => ALL_SLOTS.find((slot) => docks[slot].active === id) ?? null,
  };
}

const IDLE_SEARCH: SearchFooterStatus = { status: 'idle', done: 0, total: 0, matches: 0, files: 0, elapsedMs: 0 };

const BASE = {
  requestCount: 14,
  transferredSize: '0.4 kB',
  resourceSize: '0.5 kB',
  finishTime: '',
  tabCount: 0,
  tl: makeTl({ 'left-top': 'network' }),
  searchStatus: IDLE_SEARCH,
};

describe('PanelStatusBar subset / total', () => {
  it('shows single totals when no filter subset is given', () => {
    render(<PanelStatusBar {...BASE} />);
    expect(screen.getByText('14 requests')).toBeTruthy();
    expect(screen.getByText('0.4 kB transferred / 0.5 kB resources')).toBeTruthy();
    expect(screen.queryByText(/\/ 14 requests/)).toBeNull();
  });

  it('shows subset / total in kB for requests, transferred and resources when a subset is given', () => {
    // Both byte sides stay in kB (browser parity — the subset/total form never
    // rolls to MB the way the single-total form does).
    render(
      <PanelStatusBar
        {...BASE}
        subset={{
          requestCount: 1,
          transferredSize: '0.0 kB',
          resourceSize: '0.0 kB',
          totalTransferredSize: '11,078 kB',
          totalResourceSize: '99,067 kB',
        }}
      />,
    );
    expect(screen.getByText('1 / 14 requests')).toBeTruthy();
    expect(screen.getByText('0.0 kB / 11,078 kB transferred')).toBeTruthy();
    expect(screen.getByText('0.0 kB / 99,067 kB resources')).toBeTruthy();
    // The single-total form must be gone.
    expect(screen.queryByText('14 requests')).toBeNull();
  });
});

describe('PanelStatusBar focused-tool scope', () => {
  it('renders the published Storage line while the Storage window has focus', () => {
    setStorageFooterStatus({ summary: '12 of 64 items', matches: '3 sections match', alert: 'write failed' });
    setFocusedRegion('left');
    setFocusedDock('left-bottom');
    render(<PanelStatusBar {...BASE} tl={makeTl({ 'left-top': 'network', 'left-bottom': 'storage' })} />);
    expect(screen.getByText('12 of 64 items')).toBeTruthy();
    expect(screen.getByText('3 sections match')).toBeTruthy();
    expect(screen.getByText('write failed')).toBeTruthy();
    expect(screen.queryByText('14 requests')).toBeNull();
  });

  it('renders the published Console counts while the Console window has focus', () => {
    setConsoleFooterStatus({ visibleCount: 45, totalCount: 284, errorCount: 3, warningCount: 12 });
    setFocusedRegion('left');
    setFocusedDock('left-bottom');
    render(<PanelStatusBar {...BASE} tl={makeTl({ 'left-top': 'network', 'left-bottom': 'console' })} />);
    expect(screen.getByText('45 of 284 messages')).toBeTruthy();
    expect(screen.getByText('3 errors')).toBeTruthy();
    expect(screen.getByText('12 warnings')).toBeTruthy();
  });

  it('renders the search summary while the Search window has focus and a run finished', () => {
    setFocusedRegion('left');
    setFocusedDock('left-bottom');
    render(
      <PanelStatusBar
        {...BASE}
        tl={makeTl({ 'left-top': 'network', 'left-bottom': 'search' })}
        searchStatus={{ status: 'done', done: 14, total: 14, matches: 17, files: 5, elapsedMs: 42 }}
      />,
    );
    expect(screen.getByText('Found 17 matches in 5 files · 42 ms')).toBeTruthy();
    expect(screen.queryByText('14 requests')).toBeNull();
  });

  it('falls back to the Network line when the focused tool has published nothing', () => {
    setFocusedRegion('left');
    setFocusedDock('left-bottom');
    render(<PanelStatusBar {...BASE} tl={makeTl({ 'left-top': 'network', 'left-bottom': 'storage' })} />);
    expect(screen.getByText('14 requests')).toBeTruthy();
  });
});
