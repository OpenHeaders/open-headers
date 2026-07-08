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
    readEntryResponse: vi.fn(() => Promise.resolve(null)),
    mutationFailed: false,
    deleteCache: vi.fn(),
    deleteEntry: vi.fn(),
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

  it('deletes a cache only on the second (armed) click, and blur disarms', () => {
    const cache = makeCache();
    render(<CacheStorageSection cache={cache} filter="" />);

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
    render(<CacheStorageSection cache={cache} filter="" />);

    expect(screen.getByText('Size')).toBeDefined();
    expect(screen.getByText('Time')).toBeDefined();
    expect(screen.getByText('20.0 kB')).toBeDefined();
    expect(screen.getByText(new Date(storedAt).toLocaleString())).toBeDefined();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('deletes an entry single-click through the hover lane', () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/api/data', method: 'POST' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter="" />);

    fireEvent.click(screen.getByLabelText('Delete entry https://openheaders.io/api/data'));
    expect(cache.deleteEntry).toHaveBeenCalledWith('https://openheaders.io/api/data', 'POST');
  });

  it('expands a stored-response preview through the lazy fetch and collapses on the second click', async () => {
    const readEntryResponse = vi.fn(() =>
      Promise.resolve({
        status: 200,
        statusText: 'OK',
        headersPreview: 'content-type: application/json',
        bodyPreview: '{"a":1}',
        bodyLength: 7,
      }),
    );
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      readEntryResponse,
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/api/data', method: 'GET' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter="" />);

    const eye = screen.getByLabelText('Preview response for https://openheaders.io/api/data');
    fireEvent.click(eye);
    expect(readEntryResponse).toHaveBeenCalledWith('https://openheaders.io/api/data', 'GET');
    expect(await screen.findByText('{"a":1}')).toBeDefined();
    expect(screen.getByText(/200 OK/)).toBeDefined();
    expect(screen.getByText('content-type: application/json')).toBeDefined();

    fireEvent.click(eye);
    expect(screen.queryByText('{"a":1}')).toBeNull();
  });

  it('renders a binary body as a note and a failed fetch as unreadable', async () => {
    const cache = makeCache({
      selectedCache: 'oh-assets-v1',
      readEntryResponse: vi.fn(() =>
        Promise.resolve({ status: 200, statusText: '', bodyPreview: 'AAEC', bodyBase64: true, bodyLength: 3 }),
      ),
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/img.png', method: 'GET' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={cache} filter="" />);
    fireEvent.click(screen.getByLabelText('Preview response for https://openheaders.io/img.png'));
    expect(await screen.findByText(/Binary body/)).toBeDefined();
    cleanup();

    const failing = makeCache({
      selectedCache: 'oh-assets-v1',
      readEntryResponse: vi.fn(() => Promise.resolve(null)),
      entriesPage: {
        entries: [{ url: 'https://openheaders.io/gone.js', method: 'GET' }],
        truncated: false,
      },
    });
    render(<CacheStorageSection cache={failing} filter="" />);
    fireEvent.click(screen.getByLabelText('Preview response for https://openheaders.io/gone.js'));
    expect(await screen.findByText(/can’t be read/)).toBeDefined();
  });

  it('filters entries across URL, method and the headers preview', () => {
    const entriesPage = {
      entries: [
        { url: 'https://openheaders.io/asset-0.js', method: 'GET', headersPreview: 'accept: text/javascript' },
        { url: 'https://openheaders.io/api/data', method: 'POST' },
      ],
      truncated: false,
    };

    render(<CacheStorageSection cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })} filter="api" />);
    expect(screen.queryByText('https://openheaders.io/asset-0.js')).toBeNull();
    expect(screen.getByText('https://openheaders.io/api/data')).toBeDefined();
    cleanup();

    render(<CacheStorageSection cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })} filter="post" />);
    expect(screen.queryByText('https://openheaders.io/asset-0.js')).toBeNull();
    expect(screen.getByText('https://openheaders.io/api/data')).toBeDefined();
    cleanup();

    render(
      <CacheStorageSection cache={makeCache({ selectedCache: 'oh-assets-v1', entriesPage })} filter="javascript" />,
    );
    expect(screen.getByText('https://openheaders.io/asset-0.js')).toBeDefined();
    expect(screen.queryByText('https://openheaders.io/api/data')).toBeNull();
  });
});
