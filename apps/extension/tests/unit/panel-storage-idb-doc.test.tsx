// @vitest-environment jsdom
/**
 * IdbRecordEditorTab — an IndexedDB record opened as a full editor-tab
 * document. One-shot fetch over the host seam, Source (Monaco, mocked
 * here) vs Preview (JSON tree) modes gated on exact-JSON documents,
 * read-only notes for JSON-ish/truncated content, honest empty state
 * with a Refresh retry, and the Reveal-in-Storage back-link.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { IdbRecordEditorTab } from '@openheaders/ui/panel/components/storage/IdbRecordEditorTab';
import { buildIdbRecordTab } from '@openheaders/ui/panel/data/inspector-tab';
import type { IdbRecordDocument, StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/panel/components/detail/CodeViewer', () => ({
  default: ({
    value,
    language,
    readOnly,
    onChange,
  }: {
    value: string;
    language: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      data-testid="code-viewer"
      data-language={language}
      readOnly={readOnly !== false}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
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
  readIndexedDbRecordDocument: StorageInspectorHost['readIndexedDbRecordDocument'],
  writeIndexedDbRecord: StorageInspectorHost['writeIndexedDbRecord'] = vi.fn(() => Promise.resolve({ ok: false })),
) {
  const host: StorageInspectorHost = {
    listScopes: vi.fn(() => Promise.resolve(null)),
    readDomStorage: vi.fn(() => Promise.resolve(null)),
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(false)),
    removeDomStorage: vi.fn(() => Promise.resolve(false)),
    clearDomStorage: vi.fn(() => Promise.resolve(false)),
    listIndexedDb: vi.fn(() => Promise.resolve(null)),
    readIndexedDbRecords: vi.fn(() => Promise.resolve(null)),
    readIndexedDbRecordDocument,
    writeIndexedDbRecord,
    deleteIndexedDbRecord: vi.fn(() => Promise.resolve(false)),
    clearIndexedDbStore: vi.fn(() => Promise.resolve(false)),
    deleteIndexedDbDatabase: vi.fn(() => Promise.resolve(false)),
    listCaches: vi.fn(() => Promise.resolve(null)),
    readCacheEntries: vi.fn(() => Promise.resolve(null)),
    readCacheEntryResponse: vi.fn(() => Promise.resolve(null)),
    readQuota: vi.fn(() => Promise.resolve(null)),
    clearSiteData: vi.fn(() => Promise.resolve(false)),
    setQuotaOverride: vi.fn(() => Promise.resolve(false)),
    deleteCache: vi.fn(() => Promise.resolve(false)),
    deleteCacheEntry: vi.fn(() => Promise.resolve(false)),
    subscribeStorageInvalidations: () => () => {},
  };
  setStorageInspectorHost(host);
}

const TAB = buildIdbRecordTab({
  frameId: 0,
  database: 'oh-store-app',
  store: 'orders',
  primaryKeyWire: '{"a":[{"s":"user-1"},{"n":1}]}',
  keyPreview: '["user-1", 1]',
  timestamp: 1_770_000_000_000,
});

beforeEach(() => {
  setHostNavigation(NAV);
});

afterEach(() => {
  cleanup();
});

describe('IdbRecordEditorTab', () => {
  it('fetches the document with the tab coordinates and renders exact JSON as Source', async () => {
    const doc: IdbRecordDocument = { text: '{\n  "user": "user-1",\n  "seq": 1\n}', editable: true };
    const read = vi.fn(() => Promise.resolve<IdbRecordDocument | null>(doc));
    installHost(read);
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = await screen.findByTestId('code-viewer');
    expect(read).toHaveBeenCalledWith(42, 0, 'oh-store-app', 'orders', '{"a":[{"s":"user-1"},{"n":1}]}');
    expect(viewer.getAttribute('data-language')).toBe('json');
    expect((viewer as HTMLTextAreaElement).value).toBe(doc.text);
    // Exact JSON carries no read-only note.
    expect(screen.queryByText(/read-only/)).toBeNull();
  });

  it('switches to the Preview tree for exact-JSON documents', async () => {
    installHost(vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{"user": "user-1"}', editable: true })));
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const preview = await screen.findByRole('tab', { name: 'Preview' });
    expect(preview.hasAttribute('disabled')).toBe(false);
    fireEvent.click(preview);
    expect(screen.getByLabelText('Record value tree')).toBeTruthy();
    expect(screen.getByText('"user"')).toBeTruthy();
    expect(screen.queryByTestId('code-viewer')).toBeNull();
  });

  it('renders a JSON-ish document read-only: note shown, Preview disabled, non-json language', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<IdbRecordDocument | null>({ text: '{\n  "when": Date("2026-07-08")\n}', editable: false }),
      ),
    );
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = await screen.findByTestId('code-viewer');
    expect(viewer.getAttribute('data-language')).toBe('javascript');
    expect(screen.getByText(/Contains non-JSON types/)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Preview' }).hasAttribute('disabled')).toBe(true);
  });

  it('notes a truncated document', async () => {
    installHost(
      vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{"a"…', editable: false, truncated: true })),
    );
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);
    expect(await screen.findByText(/Truncated at the size cap/)).toBeTruthy();
  });

  it('degrades to the honest empty state when the record is gone, and Refresh retries', async () => {
    const doc: IdbRecordDocument = { text: '1', editable: true };
    const read = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(doc as IdbRecordDocument | null);
    installHost(read);
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText('Record no longer available')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Refresh record'));
    const viewer = await screen.findByTestId('code-viewer');
    expect((viewer as HTMLTextAreaElement).value).toBe('1');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('routes Reveal in Storage back to the originating store', async () => {
    installHost(vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{}', editable: true })));
    const onReveal = vi.fn();
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={onReveal} />);

    await screen.findByTestId('code-viewer');
    fireEvent.click(screen.getByText('Reveal in Storage'));
    expect(onReveal).toHaveBeenCalledWith('oh-store-app', 'orders');
  });

  it('derives dirty from draft-vs-document equality and gates Save on it', async () => {
    installHost(vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{\n  "seq": 1\n}', editable: true })));
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(viewer, { target: { value: '{\n  "seq": 2\n}' } });
    expect(save.hasAttribute('disabled')).toBe(false);

    // Editing back to the canonical text is clean again — dirty derives.
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 1\n}' } });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('never offers Save or an editable buffer for a read-only document', async () => {
    installHost(vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: 'Date("x")', editable: false })));
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('saves the draft through the seam and re-fetches through the read path', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true } as IdbRecordDocument | null)
      .mockResolvedValue({ text: '{\n  "seq": 2\n}', editable: true } as IdbRecordDocument | null);
    const write = vi.fn(() => Promise.resolve({ ok: true }));
    installHost(read, write);
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 2\n}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(write).toHaveBeenCalledWith(42, 0, 'oh-store-app', 'orders', TAB.primaryKeyWire, '{\n  "seq": 2\n}');
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true));
  });

  it('renders the reasoned failure note, keeps the draft, and clears the note on edit', async () => {
    const write = vi.fn(() => Promise.resolve({ ok: false, reason: 'key-changed' as const }));
    installHost(
      vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{\n  "seq": 1\n}', editable: true })),
      write,
    );
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 9\n}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/would create a new record/)).toBeTruthy();
    expect(viewer.value).toBe('{\n  "seq": 9\n}');

    fireEvent.change(viewer, { target: { value: '{\n  "seq": 10\n}' } });
    expect(screen.queryByText(/would create a new record/)).toBeNull();
  });

  it('arms Refresh while dirty — only the confirm discards the draft', async () => {
    const read = vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{\n  "seq": 1\n}', editable: true }));
    installHost(read);
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });

    // First click arms; nothing is re-read and the draft survives.
    fireEvent.click(screen.getByLabelText('Refresh record'));
    expect(read).toHaveBeenCalledTimes(1);
    expect(viewer.value).toBe('{\n  "seq": 5\n}');

    // The confirm click discards the draft through a re-fetch.
    fireEvent.click(screen.getByLabelText('Refresh record — click again to confirm'));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{\n  "seq": 1\n}'),
    );
  });
});
