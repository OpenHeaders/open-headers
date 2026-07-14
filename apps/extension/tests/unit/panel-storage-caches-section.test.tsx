// @vitest-environment jsdom
/**
 * CacheStorageSection — the cache list drills into a read-only paged
 * entry grid, and an unreadable scope (non-secure context / frame gone)
 * renders the explanatory empty state instead of an error.
 */

import { CacheStorageSection } from '@openheaders/ui/panel/components/storage/CacheStorageSection';
import type { CacheBrowserState } from '@openheaders/ui/panel/data/storage/use-cache-browser';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const filterOf = (text: string) => buildTextPredicate(text, DEFAULT_TEXT_MATCH_CONFIG);

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
    mutationFailed: false,
    deleteCache: vi.fn(),
    deleteEntry: vi.fn(),
    ...overrides,
  };
}

describe('CacheStorageSection cache list', () => {
  it('opens a cache through the selection callback', () => {
    const cache = makeCache();
    render(<CacheStorageSection cache={cache} filter={filterOf('')} />);

    fireEvent.click(screen.getByText('oh-assets-v1'));
    expect(cache.selectCache).toHaveBeenCalledWith('oh-assets-v1');
  });

  it('renders the secure-context empty state when the scope is unreadable', () => {
    render(<CacheStorageSection cache={makeCache({ caches: null })} filter={filterOf('')} />);
    expect(screen.getByText('Cache Storage can’t be read')).toBeDefined();
  });

  it('deletes a cache only on the second (armed) click, and blur disarms', () => {
    const cache = makeCache();
    render(<CacheStorageSection cache={cache} filter={filterOf('')} />);

    const del = screen.getByLabelText('Delete cache oh-assets-v1');
    fireEvent.click(del);
    expect(cache.deleteCache).not.toHaveBeenCalled();

    fireEvent.blur(del);
    fireEvent.click(del);
    expect(cache.deleteCache).not.toHaveBeenCalled();

    fireEvent.click(del);
    expect(cache.deleteCache).toHaveBeenCalledWith('oh-assets-v1');
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
    render(<CacheStorageSection cache={cache} filter={filterOf('')} />);

    expect(screen.getByText('https://openheaders.io/asset-0.js')).toBeDefined();
    expect(screen.getByText('POST')).toBeDefined();

    const prev = screen.getByLabelText('Previous page') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(cache.setPage).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('Back to caches'));
    expect(cache.closeCache).toHaveBeenCalled();
  });

  it('renders size and time columns from the response metadata, em-dash when absent', () => {
    const storedAt = 1_770_000_000_500;
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [
          { url: 'https://openheaders.io/asset-0.js', method: 'GET', contentLength: 20_000, responseTimeMs: storedAt },
          { url: 'https://openheaders.io/api/data', method: 'POST' },
        ],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter={filterOf('')} />);

    expect(screen.getByText('Size')).toBeDefined();
    expect(screen.getByText('Time')).toBeDefined();
    expect(screen.getByText('20.0 kB')).toBeDefined();
    expect(screen.getByText(new Date(storedAt).toLocaleString())).toBeDefined();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('deletes an entry only on the second (armed) click, and blur disarms', () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/api/data', method: 'POST' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter={filterOf('')} />);

    const del = screen.getByLabelText('Delete entry https://openheaders.io/api/data');
    fireEvent.click(del);
    expect(cache.deleteEntry).not.toHaveBeenCalled();

    fireEvent.blur(del);
    fireEvent.click(del);
    expect(cache.deleteEntry).not.toHaveBeenCalled();

    fireEvent.click(del);
    expect(cache.deleteEntry).toHaveBeenCalledWith('https://openheaders.io/api/data', 'POST');
  });

  it('opens an entry as an editor document on row click; the delete lane never also opens', () => {
    const onOpenEntry = vi.fn();
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/api/data', method: 'POST' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter={filterOf('')} onOpenEntry={onOpenEntry} />);

    fireEvent.click(screen.getByText('https://openheaders.io/api/data'));
    expect(onOpenEntry).toHaveBeenCalledWith('https://openheaders.io/api/data', 'POST');

    onOpenEntry.mockClear();
    const del = screen.getByLabelText('Delete entry https://openheaders.io/api/data');
    fireEvent.click(del);
    fireEvent.click(del);
    expect(onOpenEntry).not.toHaveBeenCalled();
    expect(cache.deleteEntry).toHaveBeenCalled();
  });

  it('highlights exactly the row whose document is the active editor tab', () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [
          { url: 'https://openheaders.io/a.js', method: 'GET' },
          { url: 'https://openheaders.io/b.js', method: 'GET' },
        ],
        truncated: false,
      },
    });
    const { container } = render(
      <CacheStorageSection
        cache={cache}
        filter={filterOf('')}
        isEntryActive={(url) => url === 'https://openheaders.io/a.js'}
      />,
    );

    const active = container.querySelectorAll('.dt-storage-row--active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain('https://openheaders.io/a.js');
  });

  it('filters entries across URL, method and the headers preview', () => {
    const entriesPage = {
      entries: [
        { url: 'https://openheaders.io/asset-0.js', method: 'GET', headersPreview: 'accept: text/javascript' },
        { url: 'https://openheaders.io/api/data', method: 'POST' },
      ],
      truncated: false,
    };

    render(
      <CacheStorageSection
        cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })}
        filter={filterOf('api')}
      />,
    );
    expect(screen.queryByText('https://openheaders.io/asset-0.js')).toBeNull();
    expect(screen.getByText('https://openheaders.io/api/data')).toBeDefined();
    cleanup();

    render(
      <CacheStorageSection
        cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })}
        filter={filterOf('post')}
      />,
    );
    expect(screen.queryByText('https://openheaders.io/asset-0.js')).toBeNull();
    expect(screen.getByText('https://openheaders.io/api/data')).toBeDefined();
    cleanup();

    render(
      <CacheStorageSection
        cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })}
        filter={filterOf('javascript')}
      />,
    );
    expect(screen.getByText('https://openheaders.io/asset-0.js')).toBeDefined();
    expect(screen.queryByText('https://openheaders.io/api/data')).toBeNull();
  });
});
