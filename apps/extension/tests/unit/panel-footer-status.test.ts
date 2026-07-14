/**
 * Focused-tool footer status — the pure summary builders
 * (`footer-status.ts`) and the publish/subscribe store's identity
 * discipline (`footer-status-store.ts`).
 *
 * The status bar renders exactly these strings, so the wording is
 * asserted literally; the store test pins the identity-churn law — an
 * equal republish must not mint a new snapshot.
 */

import {
  buildStorageFooterStatus,
  countConsoleLevels,
  type StorageFooterInput,
  searchFooterLine,
} from '@openheaders/ui/panel/data/footer-status';
import {
  getConsoleFooterStatus,
  getStorageFooterStatus,
  setConsoleFooterStatus,
  setStorageFooterStatus,
} from '@openheaders/ui/panel/data/stores/footer-status-store';
import { afterEach, describe, expect, it } from 'vitest';

function storageInput(overrides: Partial<StorageFooterInput> = {}): StorageFooterInput {
  return {
    section: 'local',
    filteredCount: 64,
    totalCount: 64,
    filterActive: false,
    matchingSections: 0,
    writeFailed: false,
    deleteFailed: false,
    readFailed: false,
    quotaUsage: null,
    quotaTotal: null,
    ...overrides,
  };
}

describe('buildStorageFooterStatus', () => {
  it('shows the plain total while no filter is typed', () => {
    const status = buildStorageFooterStatus(storageInput());
    expect(status.summary).toBe('64 items');
    expect(status.matches).toBe('');
    expect(status.alert).toBe('');
  });

  it('shows `x of y` plus the cross-section match note while filtering', () => {
    const status = buildStorageFooterStatus(
      storageInput({ filteredCount: 12, filterActive: true, matchingSections: 3 }),
    );
    expect(status.summary).toBe('12 of 64 items');
    expect(status.matches).toBe('3 sections match');
  });

  it('singularizes nouns and the match note', () => {
    const status = buildStorageFooterStatus(
      storageInput({ section: 'cookies', filteredCount: 1, totalCount: 1, filterActive: true, matchingSections: 1 }),
    );
    expect(status.summary).toBe('1 of 1 cookie');
    expect(status.matches).toBe('1 section matches');
  });

  it('keeps the top-level noun total for sections that filter below it', () => {
    const status = buildStorageFooterStatus(
      storageInput({
        section: 'indexeddb',
        filteredCount: null,
        totalCount: 3,
        filterActive: true,
        matchingSections: 2,
      }),
    );
    expect(status.summary).toBe('3 databases');
    expect(status.matches).toBe('2 sections match');
  });

  it('renders the Usage section as a quota line without a match note', () => {
    const status = buildStorageFooterStatus(
      storageInput({ section: 'quota', quotaUsage: 4_200_000, quotaTotal: 10_000_000, filterActive: true }),
    );
    expect(status.summary).toBe('4.2 MB of 10.0 MB used');
    expect(status.matches).toBe('');
  });

  it('rolls quota bytes through B / kB / GB tiers', () => {
    const status = buildStorageFooterStatus(
      storageInput({ section: 'quota', quotaUsage: 512, quotaTotal: 2_000_000_000 }),
    );
    expect(status.summary).toBe('512 B of 2.0 GB used');
  });

  it('surfaces write / delete failures and lets read failures win', () => {
    expect(buildStorageFooterStatus(storageInput({ writeFailed: true })).alert).toBe('write failed');
    expect(
      buildStorageFooterStatus(storageInput({ section: 'cachestorage', filteredCount: null, deleteFailed: true }))
        .alert,
    ).toBe('delete failed');
    expect(buildStorageFooterStatus(storageInput({ readFailed: true, writeFailed: true })).alert).toBe(
      'read failed — showing last data',
    );
  });
});

describe('countConsoleLevels', () => {
  it('tallies errors and warnings, ignoring the other levels', () => {
    const counts = countConsoleLevels(['log', 'error', 'warning', 'info', 'error', 'debug']);
    expect(counts).toEqual({ errors: 2, warnings: 1 });
  });

  it('is all-zero on an empty log', () => {
    expect(countConsoleLevels([])).toEqual({ errors: 0, warnings: 0 });
  });
});

describe('searchFooterLine', () => {
  it('is empty while idle so the footer falls back to the Network line', () => {
    expect(searchFooterLine({ status: 'idle', done: 0, total: 0, matches: 0, files: 0, elapsedMs: 0 })).toBe('');
  });

  it('reports scan progress while running', () => {
    expect(searchFooterLine({ status: 'running', done: 12, total: 40, matches: 3, files: 2, elapsedMs: 150 })).toBe(
      'Searching… 12 / 40',
    );
  });

  it('mirrors the panel summary when done', () => {
    expect(searchFooterLine({ status: 'done', done: 40, total: 40, matches: 17, files: 5, elapsedMs: 342 })).toBe(
      'Found 17 matches in 5 files · 342 ms',
    );
    expect(searchFooterLine({ status: 'done', done: 40, total: 40, matches: 1, files: 1, elapsedMs: 1500 })).toBe(
      'Found 1 match in 1 file · 1.50 s',
    );
    expect(searchFooterLine({ status: 'done', done: 40, total: 40, matches: 0, files: 0, elapsedMs: 90 })).toBe(
      'No results · 90 ms',
    );
  });
});

describe('footer-status-store', () => {
  afterEach(() => {
    setStorageFooterStatus(null);
    setConsoleFooterStatus(null);
  });

  it('keeps the snapshot identity when an equal status is republished', () => {
    setStorageFooterStatus({ summary: '64 items', matches: '', alert: '' });
    const first = getStorageFooterStatus();
    setStorageFooterStatus({ summary: '64 items', matches: '', alert: '' });
    expect(getStorageFooterStatus()).toBe(first);
  });

  it('swaps the snapshot when a field changes and clears to null', () => {
    setConsoleFooterStatus({ visibleCount: 10, totalCount: 10, errorCount: 0, warningCount: 0 });
    const first = getConsoleFooterStatus();
    setConsoleFooterStatus({ visibleCount: 8, totalCount: 10, errorCount: 1, warningCount: 0 });
    expect(getConsoleFooterStatus()).not.toBe(first);
    expect(getConsoleFooterStatus()?.visibleCount).toBe(8);
    setConsoleFooterStatus(null);
    expect(getConsoleFooterStatus()).toBeNull();
  });
});
