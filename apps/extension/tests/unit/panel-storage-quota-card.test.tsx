// @vitest-environment jsdom
/**
 * StorageQuotaCard — usage-vs-quota totals with the per-type breakdown
 * when the CDP tier answered, a capability hint when it didn't, and the
 * explanatory empty state for an unreadable scope (non-secure context /
 * frame gone) instead of an error.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { StorageQuotaCard } from '@openheaders/ui/panel/components/storage/StorageQuotaCard';
import type { StorageQuotaState } from '@openheaders/ui/panel/data/storage/use-storage-quota';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  // The Chromium-family posture; capability-gate tests drop these.
  registerCapability('cdpInspection', () => true);
  registerCapability('originDataClearing', () => true);
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  unregisterCapability('originDataClearing');
});

function makeQuota(overrides: Partial<StorageQuotaState> = {}): StorageQuotaState {
  return {
    quota: { usage: 4096, quota: 120 * 1024 * 1024 },
    loading: false,
    refresh: vi.fn(),
    clearFailed: false,
    clearSiteData: vi.fn(),
    ...overrides,
  };
}

describe('StorageQuotaCard', () => {
  it('renders the usage-vs-quota totals', () => {
    render(<StorageQuotaCard quota={makeQuota()} />);
    expect(screen.getByText('4.1 kB used')).toBeDefined();
    expect(screen.getByText(/of 126 MB/)).toBeDefined();
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

  it('clears site data only on the second (armed) click, and blur disarms', () => {
    const quota = makeQuota();
    render(<StorageQuotaCard quota={quota} />);

    const clear = screen.getByText('Clear site data');
    fireEvent.click(clear);
    expect(quota.clearSiteData).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm clear?')).toBeDefined();

    fireEvent.blur(clear);
    fireEvent.click(clear);
    expect(quota.clearSiteData).not.toHaveBeenCalled();

    fireEvent.click(clear);
    expect(quota.clearSiteData).toHaveBeenCalledTimes(1);
  });

  it('notes a failed clear', () => {
    render(<StorageQuotaCard quota={makeQuota({ clearFailed: true })} />);
    expect(screen.getByText('clear failed')).toBeDefined();
  });

  it('drops the Debug-mode hint on hosts without CDP capability', () => {
    unregisterCapability('cdpInspection');
    render(<StorageQuotaCard quota={makeQuota()} />);
    expect(screen.queryByText('Enable Debug mode to see the per-type breakdown.')).toBeNull();
  });

  it('hides the clear gesture on hosts without origin-clearing capability', () => {
    unregisterCapability('originDataClearing');
    render(<StorageQuotaCard quota={makeQuota()} />);
    expect(screen.queryByText('Clear site data')).toBeNull();
  });
});
