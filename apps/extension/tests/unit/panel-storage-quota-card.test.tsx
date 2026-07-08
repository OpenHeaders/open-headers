// @vitest-environment jsdom
/**
 * StorageQuotaCard — usage-vs-quota totals with the per-type breakdown
 * when the CDP tier answered, a capability hint when it didn't, and the
 * explanatory empty state for an unreadable scope (non-secure context /
 * frame gone) instead of an error.
 */

import { StorageQuotaCard } from '@openheaders/ui/panel/components/storage/StorageQuotaCard';
import type { StorageQuotaState } from '@openheaders/ui/panel/data/storage/use-storage-quota';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

function makeQuota(overrides: Partial<StorageQuotaState> = {}): StorageQuotaState {
  return {
    quota: { usage: 4096, quota: 120 * 1024 * 1024 },
    loading: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('StorageQuotaCard', () => {
  it('renders the usage-vs-quota totals', () => {
    render(<StorageQuotaCard quota={makeQuota()} />);
    expect(screen.getByText('4.0 kB used')).toBeDefined();
    expect(screen.getByText(/of 120\.0 MB/)).toBeDefined();
  });

  it('renders per-type rows for the breakdown, dropping zero-usage types', () => {
    const quota = makeQuota({
      quota: {
        usage: 4096,
        quota: 120 * 1024 * 1024,
        breakdown: [
          { storageType: 'indexeddb', usage: 3072 },
          { storageType: 'cache_storage', usage: 1024 },
          { storageType: 'service_workers', usage: 0 },
        ],
      },
    });
    render(<StorageQuotaCard quota={quota} />);

    expect(screen.getByText('IndexedDB')).toBeDefined();
    expect(screen.getByText('Cache Storage')).toBeDefined();
    expect(screen.queryByText('Service workers')).toBeNull();
  });

  it('hints at the Debug-mode upgrade when no breakdown arrived', () => {
    render(<StorageQuotaCard quota={makeQuota()} />);
    expect(screen.getByText('Enable Debug mode to see the per-type breakdown.')).toBeDefined();
  });

  it('renders the secure-context empty state when the scope is unreadable', () => {
    render(<StorageQuotaCard quota={makeQuota({ quota: null })} />);
    expect(screen.getByText('Usage can’t be read')).toBeDefined();
  });

  it('renders a loading note while the first read is in flight', () => {
    render(<StorageQuotaCard quota={makeQuota({ quota: null, loading: true })} />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });
});
