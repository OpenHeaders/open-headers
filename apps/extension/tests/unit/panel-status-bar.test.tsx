/**
 * PanelStatusBar footer — `subset / total` rendering.
 *
 * The browser's summary bar switches the request / transferred / resource
 * chips to `subset / total` whenever a filter hides at least one row, and
 * stays on single totals otherwise. The footer takes a `subset` prop (set by
 * the panel only when rows are hidden) and must render accordingly.
 */

import '@openheaders/ui/workbench/settings/schema';
import PanelStatusBar from '@openheaders/ui/panel/components/PanelStatusBar';
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
});

const BASE = {
  requestCount: 14,
  transferredSize: '0.4 kB',
  resourceSize: '0.5 kB',
  finishTime: '',
  tabCount: 0,
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
