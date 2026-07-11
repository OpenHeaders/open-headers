// @vitest-environment jsdom
/**
 * StorageQuotaCard — usage-vs-quota totals with the per-type breakdown
 * when the CDP tier answered, a capability hint when it didn't, and the
 * explanatory empty state for an unreadable scope (non-secure context /
 * frame gone) instead of an error. The clear gesture lives in the scope
 * bar's ClearSiteDataControl, parameterized by the card's checkboxes —
 * the harness below mirrors the panel's shared-state wiring.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { ClearSiteDataControl, StorageQuotaCard } from '@openheaders/ui/panel/components/storage/StorageQuotaCard';
import type { SiteDataType } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import type { StorageQuotaState } from '@openheaders/ui/panel/data/storage/use-storage-quota';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
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
    clearSucceeded: false,
    clearSiteData: vi.fn(),
    overrideFailed: false,
    setQuotaOverride: vi.fn(),
    ...overrides,
  };
}

/** The attached posture: a breakdown arrived (simulation renders). */
function makeAttachedQuota(
  overrides: Partial<StorageQuotaState> = {},
  quotaOverrides: Partial<NonNullable<StorageQuotaState['quota']>> = {},
): StorageQuotaState {
  return makeQuota({
    quota: {
      usage: 4096,
      quota: 120 * 1024 * 1024,
      breakdown: [{ storageType: 'indexeddb', usage: 4096 }],
      ...quotaOverrides,
    },
    ...overrides,
  });
}

/** The panel's wiring: the checkbox selection is shared between the
 *  scope bar's control and the card. */
function Harness({ quota }: { quota: StorageQuotaState }) {
  const [excluded, setExcluded] = useState<ReadonlySet<SiteDataType>>(new Set());
  const [hovered, setHovered] = useState(false);
  const toggle = (type: SiteDataType) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  return (
    <>
      <ClearSiteDataControl quota={quota} excluded={excluded} onHoverChange={setHovered} />
      <StorageQuotaCard quota={quota} excluded={excluded} onToggleType={toggle} highlightTargets={hovered} />
    </>
  );
}

describe('StorageQuotaCard', () => {
  it('renders the usage-vs-quota totals', () => {
    render(<Harness quota={makeQuota()} />);
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
    const { container } = render(<Harness quota={quota} />);

    // Scoped to the breakdown grid — the clear checkboxes reuse the labels.
    const rows = container.querySelector('.dt-storage-quota-rows') as HTMLElement;
    expect(rows).not.toBeNull();
    expect(within(rows).getByText('IndexedDB')).toBeDefined();
    expect(within(rows).getByText('Cache Storage')).toBeDefined();
    expect(within(rows).queryByText('Service workers')).toBeNull();
  });

  it('hints at the Debug-mode upgrade when no breakdown arrived', () => {
    render(<Harness quota={makeQuota()} />);
    expect(screen.getByText('Enable Debug mode to see the per-type breakdown.')).toBeDefined();
  });

  it('renders the secure-context empty state when the scope is unreadable', () => {
    render(<Harness quota={makeQuota({ quota: null })} />);
    expect(screen.getByText('Usage can’t be read')).toBeDefined();
    // The scope bar's control drops with the unreadable snapshot.
    expect(screen.queryByText('Clear everything')).toBeNull();
  });

  it('renders a loading note while the first read is in flight', () => {
    render(<Harness quota={makeQuota({ quota: null, loading: true })} />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('clears site data only on the second (armed) click, and blur disarms', () => {
    const quota = makeQuota();
    render(<Harness quota={quota} />);

    const clear = screen.getByText('Clear everything');
    fireEvent.click(clear);
    expect(quota.clearSiteData).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm clear?')).toBeDefined();

    fireEvent.blur(clear);
    fireEvent.click(clear);
    expect(quota.clearSiteData).not.toHaveBeenCalled();

    fireEvent.click(clear);
    expect(quota.clearSiteData).toHaveBeenCalledTimes(1);
    // Default all-on selection ⇒ types absent (the all-five clear).
    expect(quota.clearSiteData).toHaveBeenCalledWith(undefined);
  });

  it('renders the five type checkboxes all-on and narrows the clear to the checked subset', () => {
    const quota = makeQuota();
    render(<Harness quota={quota} />);

    for (const label of ['Cookies', 'Local storage', 'IndexedDB', 'Cache Storage', 'Service workers']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(true);
    }

    fireEvent.click(screen.getByLabelText('Cookies'));
    fireEvent.click(screen.getByLabelText('Service workers'));
    const clear = screen.getByText('Clear everything');
    fireEvent.click(clear);
    fireEvent.click(clear);
    expect(quota.clearSiteData).toHaveBeenCalledWith(['localStorage', 'indexedDB', 'cacheStorage']);
  });

  it('disables the clear gesture when every type is unchecked', () => {
    const quota = makeQuota();
    render(<Harness quota={quota} />);

    for (const label of ['Cookies', 'Local storage', 'IndexedDB', 'Cache Storage', 'Service workers']) {
      fireEvent.click(screen.getByLabelText(label));
    }
    const clear = screen.getByText('Clear everything') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    fireEvent.click(clear);
    fireEvent.click(clear);
    expect(quota.clearSiteData).not.toHaveBeenCalled();
  });

  it('notes a failed clear', () => {
    render(<Harness quota={makeQuota({ clearFailed: true })} />);
    expect(screen.getByText('clear failed')).toBeDefined();
  });

  it('notes a successful clear — the one clear without vanishing rows', () => {
    render(<Harness quota={makeQuota({ clearSucceeded: true })} />);
    expect(screen.getByText('✓ cleared')).toBeDefined();
  });

  it('hovering Clear everything lights up exactly the checked (covered) type rows', () => {
    render(<Harness quota={makeQuota()} />);

    fireEvent.click(screen.getByLabelText('Cookies'));
    const button = screen.getByText('Clear everything');
    fireEvent.mouseEnter(button);
    expect(screen.getByLabelText('IndexedDB').closest('label')?.className).toContain('--targeted');
    expect(screen.getByLabelText('Cookies').closest('label')?.className).not.toContain('--targeted');

    fireEvent.mouseLeave(button);
    expect(screen.getByLabelText('IndexedDB').closest('label')?.className).not.toContain('--targeted');
  });

  it('drops the Debug-mode hint on hosts without CDP capability', () => {
    unregisterCapability('cdpInspection');
    render(<Harness quota={makeQuota()} />);
    expect(screen.queryByText('Enable Debug mode to see the per-type breakdown.')).toBeNull();
  });

  it('hides the clear gesture on hosts without origin-clearing capability', () => {
    unregisterCapability('originDataClearing');
    render(<Harness quota={makeQuota()} />);
    expect(screen.queryByText('Clear everything')).toBeNull();
    expect(screen.queryByLabelText('Cookies')).toBeNull();
  });

  it('renders the simulation control only while the breakdown is present (attached)', () => {
    render(<Harness quota={makeQuota()} />);
    expect(screen.queryByLabelText('Simulate custom quota')).toBeNull();
    cleanup();

    render(<Harness quota={makeAttachedQuota()} />);
    expect(screen.getByLabelText('Simulate custom quota')).toBeDefined();
  });

  it('commits an MB value on Enter (decimal MB, like the usage figures)', () => {
    const quota = makeAttachedQuota();
    render(<Harness quota={quota} />);

    const input = screen.getByLabelText('Simulate custom quota');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(quota.setQuotaOverride).toHaveBeenCalledWith(20_000_000);
  });

  it('commits via Save and abandons the pending edit via Cancel', () => {
    const quota = makeAttachedQuota();
    render(<Harness quota={quota} />);

    const input = screen.getByLabelText('Simulate custom quota') as HTMLInputElement;
    // Buttons appear only with a pending edit.
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(input.value).toBe('');
    expect(quota.setQuotaOverride).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.click(screen.getByText('Save'));
    expect(quota.setQuotaOverride).toHaveBeenCalledWith(20_000_000);
    expect(input.value).toBe('');
  });

  it('clears the simulation via Reset', () => {
    const quota = makeAttachedQuota({}, { overrideActive: true });
    render(<Harness quota={quota} />);

    fireEvent.click(screen.getByText('Reset'));
    expect(quota.setQuotaOverride).toHaveBeenCalledTimes(1);
    expect(quota.setQuotaOverride).toHaveBeenLastCalledWith(null);
  });

  it('shows Reset only while an override is active', () => {
    render(<Harness quota={makeAttachedQuota()} />);
    expect(screen.queryByText('Reset')).toBeNull();
  });

  it('rejects malformed and out-of-range MB values without committing', () => {
    const quota = makeAttachedQuota();
    render(<Harness quota={quota} />);

    // 120 MiB real quota ⇒ a 125 MB decimal ceiling.
    const input = screen.getByLabelText('Simulate custom quota');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(quota.setQuotaOverride).not.toHaveBeenCalled();
    expect(screen.getByText('enter 0–125 MB')).toBeDefined();

    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(quota.setQuotaOverride).not.toHaveBeenCalled();
    expect(screen.getByText('enter 0–125 MB')).toBeDefined();
  });

  it('notes a failed simulation', () => {
    render(<Harness quota={makeAttachedQuota({ overrideFailed: true })} />);
    expect(screen.getByText('simulation failed')).toBeDefined();
  });
});
