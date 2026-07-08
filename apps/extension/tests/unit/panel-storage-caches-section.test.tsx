// @vitest-environment jsdom
/**
 * CacheStorageSection — the cache list drills into a read-only paged
 * entry grid, and an unreadable scope (non-secure context / frame gone)
 * renders the explanatory empty state instead of an error.
 */

import { CacheStorageSection } from '@openheaders/ui/panel/components/storage/CacheStorageSection';
import type { CacheBrowserState } from '@openheaders/ui/panel/data/storage/use-cache-browser';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

function makeCache(overrides: Partial<CacheBrowserState> = {}): CacheBrowserState {
  return {
    caches: [{ name: 'oh-assets-v1' }],
    loading: false,
    selectedCache: null,
    selectCache: vi.fn(),
    closeCache: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    entriesPage: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('CacheStorageSection cache list', () => {
  it('opens a cache through the selection callback', () => {
    const cache = makeCache();
    render(<CacheStorageSection cache={cache} filter="" />);

    fireEvent.click(screen.getByText('oh-assets-v1'));
    expect(cache.selectCache).toHaveBeenCalledWith('oh-assets-v1');
  });

  it('renders the secure-context empty state when the scope is unreadable', () => {
    render(<CacheStorageSection cache={makeCache({ caches: null })} filter="" />);
    expect(screen.getByText('Cache Storage can’t be read')).toBeDefined();
  });
});

describe('CacheStorageSection entries view', () => {
  it('renders the paged grid with the pager gated on truncation', () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [
          { url: 'https://openheaders.io/asset-0.js', method: 'GET', headersPreview: 'accept: */*' },
          { url: 'https://openheaders.io/api/data', method: 'POST' },
        ],
        truncated: true,
      },
    });
    render(<CacheStorageSection cache={cache} filter="" />);

    expect(screen.getByText('https://openheaders.io/asset-0.js')).toBeDefined();
    expect(screen.getByText('POST')).toBeDefined();

    const prev = screen.getByLabelText('Previous page') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(cache.setPage).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('Back to caches'));
    expect(cache.closeCache).toHaveBeenCalled();
  });

  it('filters entries by URL', () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [
          { url: 'https://openheaders.io/asset-0.js', method: 'GET' },
          { url: 'https://openheaders.io/api/data', method: 'GET' },
        ],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter="api" />);

    expect(screen.queryByText('https://openheaders.io/asset-0.js')).toBeNull();
    expect(screen.getByText('https://openheaders.io/api/data')).toBeDefined();
  });
});
