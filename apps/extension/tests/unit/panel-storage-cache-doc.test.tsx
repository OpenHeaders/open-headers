// @vitest-environment jsdom
/**
 * CacheEntryEditorTab — a Cache Storage entry's stored response opened
 * as a read-only editor-tab document. One-shot fetch over the host
 * seam; status line + filterable response headers + Monaco body
 * (mocked) with the language derived from content-type; inline image
 * for stored images, honest notes for other binaries / empty /
 * truncated bodies; armed Delete; live-sync adoption with no draft to
 * protect; Reveal-in-Storage back-link.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { CacheEntryEditorTab, cacheBodyLanguage } from '@openheaders/ui/panel/components/storage/CacheEntryEditorTab';
import { buildCacheEntryTab } from '@openheaders/ui/panel/data/inspector-tab';
import type { CacheEntryDocument, StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { formatBody } from '@openheaders/ui/shared/body-format';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/panel/components/detail/CodeViewer', () => ({
  default: ({ value, language, readOnly }: { value: string; language: string; readOnly?: boolean }) => (
    <textarea data-testid="code-viewer" data-language={language} readOnly={readOnly !== false} value={value} />
  ),
}));

const NAV: HostNavigation = {
  switchViewMode: () => Promise.resolve({ opened: false }),
  currentWindowId: () => Promise.resolve(undefined),
  activeTabUrl: () => Promise.resolve(undefined),
  openUrl: () => {},
  openShortcutSettings: () => {},
  getActiveTab: () => Promise.resolve(null),
  observeActiveTabContext: () => () => {},
  inspectedTabId: () => 42,
  reloadInspectedTab: () => {},
  getInspectedHar: () => Promise.resolve(null),
  openResource: () => {},
};

function installHost(
  readCacheEntryDocument: StorageInspectorHost['readCacheEntryDocument'],
  deleteCacheEntry: StorageInspectorHost['deleteCacheEntry'] = vi.fn(() => Promise.resolve(false)),
  subscribeStorageInvalidations: StorageInspectorHost['subscribeStorageInvalidations'] = () => () => {},
) {
  const host: StorageInspectorHost = {
    listScopes: vi.fn(() => Promise.resolve(null)),
    readDomStorage: vi.fn(() => Promise.resolve(null)),
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(false)),
    renameDomStorage: vi.fn(() => Promise.resolve({ ok: false })),
    removeDomStorage: vi.fn(() => Promise.resolve(false)),
    clearDomStorage: vi.fn(() => Promise.resolve(false)),
    listIndexedDb: vi.fn(() => Promise.resolve(null)),
    readIndexedDbRecords: vi.fn(() => Promise.resolve(null)),
    readIndexedDbRecordDocument: vi.fn(() => Promise.resolve(null)),
    writeIndexedDbRecord: vi.fn(() => Promise.resolve({ ok: false })),
    deleteIndexedDbRecord: vi.fn(() => Promise.resolve(false)),
    clearIndexedDbStore: vi.fn(() => Promise.resolve(false)),
    deleteIndexedDbDatabase: vi.fn(() => Promise.resolve(false)),
    listCaches: vi.fn(() => Promise.resolve(null)),
    readCacheEntries: vi.fn(() => Promise.resolve(null)),
    readCacheEntryDocument,
    readQuota: vi.fn(() => Promise.resolve(null)),
    clearSiteData: vi.fn(() => Promise.resolve(false)),
    setQuotaOverride: vi.fn(() => Promise.resolve(false)),
    deleteCache: vi.fn(() => Promise.resolve(false)),
    deleteCacheEntry,
    subscribeStorageInvalidations,
  };
  setStorageInspectorHost(host);
}

const TAB = buildCacheEntryTab({
  frameId: 0,
  cache: 'oh-api-v2',
  url: 'https://openheaders.io/api/data',
  method: 'GET',
  timestamp: 1_770_000_000_000,
});

const JSON_DOC: CacheEntryDocument = {
  status: 200,
  statusText: 'OK',
  headers: [
    { name: 'content-type', value: 'application/json' },
    { name: 'cache-control', value: 'max-age=3600' },
  ],
  body: '{"a":1}',
  bodyLength: 7,
};

beforeEach(() => {
  setHostNavigation(NAV);
});

afterEach(() => {
  cleanup();
});

describe('cacheBodyLanguage', () => {
  it('maps content types onto CodeViewer languages, XML/SVG onto the HTML grammar', () => {
    expect(cacheBodyLanguage('application/json; charset=utf-8')).toBe('json');
    expect(cacheBodyLanguage('text/javascript')).toBe('javascript');
    expect(cacheBodyLanguage('text/html')).toBe('html');
    expect(cacheBodyLanguage('application/xml')).toBe('html');
    expect(cacheBodyLanguage('image/svg+xml')).toBe('html');
    expect(cacheBodyLanguage('text/css')).toBe('css');
    expect(cacheBodyLanguage('text/plain')).toBe('plaintext');
    expect(cacheBodyLanguage('')).toBe('plaintext');
  });
});

describe('CacheEntryEditorTab', () => {
  it('fetches the document with the tab coordinates and renders status, headers and body', async () => {
    const read = vi.fn(() => Promise.resolve<CacheEntryDocument | null>(JSON_DOC));
    installHost(read);
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = await screen.findByTestId('code-viewer');
    expect(read).toHaveBeenCalledWith(42, 0, 'oh-api-v2', 'https://openheaders.io/api/data', 'GET');
    // A JSON-shaped body opens in the view-only Formatted mode.
    expect((viewer as HTMLTextAreaElement).value).toBe(formatBody('{"a":1}'));
    expect(viewer.getAttribute('data-language')).toBe('json');
    expect(viewer).toHaveProperty('readOnly', true);
    expect(screen.getByText(/200 OK/)).toBeTruthy();
    expect(screen.getByText('Response headers (2)')).toBeTruthy();
    expect(screen.getByText('cache-control')).toBeTruthy();
    expect(screen.getByText('max-age=3600')).toBeTruthy();
  });

  it('filters the header rows through the always-on filter', async () => {
    installHost(vi.fn(() => Promise.resolve<CacheEntryDocument | null>(JSON_DOC)));
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    fireEvent.change(screen.getByLabelText('Filter response headers'), { target: { value: 'cache-' } });
    expect(screen.getByText('cache-control')).toBeTruthy();
    expect(screen.queryByText('content-type')).toBeNull();

    fireEvent.change(screen.getByLabelText('Filter response headers'), { target: { value: 'zzz' } });
    expect(screen.getByText('No headers match your filter.')).toBeTruthy();
  });

  it('notes a truncated body', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          ...JSON_DOC,
          body: '{"a"',
          bodyTruncated: true,
          bodyLength: 20_000,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText(/Body truncated at the size cap/)).toBeTruthy();
  });

  it('renders a stored image inline through a data: URI', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'content-type', value: 'image/gif' }],
          body: 'R0lGODlh',
          bodyBase64: true,
          bodyLength: 6,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const img = (await screen.findByAltText(/Stored response body/)) as HTMLImageElement;
    expect(img.src).toBe('data:image/gif;base64,R0lGODlh');
    expect(screen.queryByTestId('code-viewer')).toBeNull();
  });

  it('renders an honest note for a non-image binary and for an empty body', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          status: 200,
          statusText: '',
          headers: [{ name: 'content-type', value: 'application/octet-stream' }],
          body: 'AAEC',
          bodyBase64: true,
          bodyLength: 3,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText(/Binary body/)).toBeTruthy();
    expect(screen.queryByTestId('code-viewer')).toBeNull();
    expect(screen.queryByAltText(/Stored response body/)).toBeNull();
    cleanup();

    installHost(vi.fn(() => Promise.resolve<CacheEntryDocument | null>({ ...JSON_DOC, body: '', bodyLength: 0 })));
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText('Empty body.')).toBeTruthy();
  });

  it('a truncated image never renders from broken bytes — the honest note shows instead', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'content-type', value: 'image/png' }],
          body: 'AAEC',
          bodyBase64: true,
          bodyLength: 5_000_000,
          bodyTruncated: true,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText(/Binary body/)).toBeTruthy();
    expect(screen.queryByAltText(/Stored response body/)).toBeNull();
  });

  it('degrades to the honest empty state when the entry is gone, and Refresh retries', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(JSON_DOC as CacheEntryDocument | null);
    installHost(read);
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText('Cache entry no longer available')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Refresh cache entry'));
    expect(await screen.findByTestId('code-viewer')).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('deletes only on the armed confirm, through the seam, then falls to unavailable', async () => {
    const del = vi.fn(() => Promise.resolve(true));
    installHost(
      vi.fn(() => Promise.resolve<CacheEntryDocument | null>(JSON_DOC)),
      del,
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    fireEvent.click(screen.getByLabelText('Delete cache entry'));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Delete cache entry — click again to confirm'));
    expect(del).toHaveBeenCalledWith(42, 0, 'oh-api-v2', 'https://openheaders.io/api/data', 'GET');
    expect(await screen.findByText('Cache entry no longer available')).toBeTruthy();
  });

  it('a failed delete notes the failure and re-checks through the read path', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(JSON_DOC as CacheEntryDocument | null)
      .mockResolvedValue(null as CacheEntryDocument | null);
    const del = vi.fn(() => Promise.resolve(false));
    installHost(read, del);
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    fireEvent.click(screen.getByLabelText('Delete cache entry'));
    fireEvent.click(screen.getByLabelText('Delete cache entry — click again to confirm'));

    expect(await screen.findByText(/Delete failed/)).toBeTruthy();
    // The re-check found the entry gone — honest empty state follows.
    expect(await screen.findByText('Cache entry no longer available')).toBeTruthy();
  });

  it('silently adopts an external change on a host invalidation push', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(JSON_DOC as CacheEntryDocument | null)
      .mockResolvedValue({ ...JSON_DOC, body: '{"a":2}' } as CacheEntryDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (tabId, kind, listener) => {
      expect(tabId).toBe(42);
      expect(kind).toBe('cachestorage');
      captured.invalidate = listener;
      return () => {};
    });
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.value).toBe(formatBody('{"a":1}'));
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    await waitFor(() => expect(viewer.value).toBe(formatBody('{"a":2}')));
  });

  it('falls to unavailable when the entry vanishes underneath — no draft to protect', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(JSON_DOC as CacheEntryDocument | null)
      .mockResolvedValue(null as CacheEntryDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    expect(await screen.findByText('Cache entry no longer available')).toBeTruthy();
  });

  it('the Raw toggle shows the stored bytes exactly — the format plane is view-only', async () => {
    installHost(vi.fn(() => Promise.resolve<CacheEntryDocument | null>(JSON_DOC)));
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.value).toBe(formatBody('{"a":1}'));
    expect((screen.getByRole('radio', { name: 'Formatted' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{"a":1}');

    fireEvent.click(screen.getByRole('radio', { name: 'Formatted' }));
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe(formatBody('{"a":1}'));
  });

  it('a non-JSON text body stays Raw with Formatted disabled; a truncated body fails open the same way', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          ...JSON_DOC,
          headers: [{ name: 'content-type', value: 'text/html' }],
          body: '<p>hi</p>',
          bodyLength: 9,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.value).toBe('<p>hi</p>');
    expect((screen.getByRole('radio', { name: 'Formatted' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    // A body cut at the size cap no longer tokenizes — Raw, honestly.
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          ...JSON_DOC,
          body: '{"a"',
          bodyTruncated: true,
          bodyLength: 20_000,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    const truncated = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(truncated.value).toBe('{"a"');
    expect((screen.getByRole('radio', { name: 'Formatted' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('binary and empty bodies carry no format toggle', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<CacheEntryDocument | null>({
          status: 200,
          statusText: '',
          headers: [{ name: 'content-type', value: 'application/octet-stream' }],
          body: 'AAEC',
          bodyBase64: true,
          bodyLength: 3,
        }),
      ),
    );
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText(/Binary body/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Formatted' })).toBeNull();
    cleanup();

    installHost(vi.fn(() => Promise.resolve<CacheEntryDocument | null>({ ...JSON_DOC, body: '', bodyLength: 0 })));
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText('Empty body.')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Formatted' })).toBeNull();
  });

  it('routes Reveal in Storage back to the originating cache', async () => {
    installHost(vi.fn(() => Promise.resolve<CacheEntryDocument | null>(JSON_DOC)));
    const onReveal = vi.fn();
    render(<CacheEntryEditorTab tab={TAB} onRevealInStorage={onReveal} />);

    await screen.findByTestId('code-viewer');
    fireEvent.click(screen.getByText('Reveal in Storage'));
    expect(onReveal).toHaveBeenCalledWith('oh-api-v2');
  });
});
