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
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The conflict chip's resolve popover rides antd Popover →
// rc-resize-observer; jsdom doesn't ship a ResizeObserver.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

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

// The review dialog is a Monaco 3-pane merge — out of scope in jsdom.
// The mock exposes the three pane payloads and drives the same
// onResolveText/onClose seam, so the editor's wiring (pane payloads,
// commit funnel, dismissal) stays under test.
vi.mock('@openheaders/ui/shared/conflicts/EntityConflictDialog', () => ({
  default: ({
    savedText,
    mineText,
    baseText,
    language,
    onResolveText,
    onClose,
  }: {
    savedText: string;
    mineText: string;
    baseText?: string;
    language?: string;
    onResolveText: (text: string) => Promise<void> | void;
    onClose: () => void;
  }) => (
    <div data-testid="merge-dialog" data-language={language}>
      <pre data-testid="merge-saved">{savedText}</pre>
      <pre data-testid="merge-mine">{mineText}</pre>
      <pre data-testid="merge-base">{baseText ?? ''}</pre>
      <textarea aria-label="Merge result" defaultValue={mineText} />
      <button
        type="button"
        onClick={(e) => {
          const result = e.currentTarget.parentElement?.querySelector('textarea')?.value ?? '';
          void Promise.resolve(onResolveText(result)).then(onClose);
        }}
      >
        Complete merge
      </button>
      <button type="button" onClick={onClose}>
        Cancel merge
      </button>
    </div>
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
    readIndexedDbRecordDocument,
    writeIndexedDbRecord,
    deleteIndexedDbRecord: vi.fn(() => Promise.resolve(false)),
    clearIndexedDbStore: vi.fn(() => Promise.resolve(false)),
    deleteIndexedDbDatabase: vi.fn(() => Promise.resolve(false)),
    listCaches: vi.fn(() => Promise.resolve(null)),
    readCacheEntries: vi.fn(() => Promise.resolve(null)),
    readCacheEntryDocument: vi.fn(() => Promise.resolve(null)),
    readQuota: vi.fn(() => Promise.resolve(null)),
    clearSiteData: vi.fn(() => Promise.resolve(false)),
    setQuotaOverride: vi.fn(() => Promise.resolve(false)),
    deleteCache: vi.fn(() => Promise.resolve(false)),
    deleteCacheEntry: vi.fn(() => Promise.resolve(false)),
    subscribeStorageInvalidations,
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

  it('renders a JSON-ish document read-only: note shown, non-json language, Preview disabled without a tree', async () => {
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

  it('previews a JSON-ish document through the host-serialized tree', async () => {
    installHost(
      vi.fn(() =>
        Promise.resolve<IdbRecordDocument | null>({
          text: '{\n  "when": Date("2026-07-08")\n}',
          editable: false,
          preview: {
            kind: 'container',
            label: '{2}',
            entries: [
              { key: '"when": ', node: { kind: 'atom', type: 'tag', text: 'Date("2026-07-08T00:00:00.000Z")' } },
              {
                key: '"lookup": ',
                node: {
                  kind: 'container',
                  label: 'Map(1)',
                  entries: [{ key: '"a" => ', node: { kind: 'atom', type: 'number', text: '1' } }],
                },
              },
            ],
          },
        }),
      ),
    );
    const { container } = render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const preview = await screen.findByRole('tab', { name: 'Preview' });
    expect(preview.hasAttribute('disabled')).toBe(false);
    fireEvent.click(preview);
    expect(screen.getAllByText('Date("2026-07-08T00:00:00.000Z")').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Map(1)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('"a" =>').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('code-viewer')).toBeNull();

    // Browser parity: only the root starts expanded; every container's
    // summary carries an inline first-level preview with unquoted names
    // (CSS hides it while the node is expanded — jsdom keeps it in DOM).
    const details = container.querySelectorAll('details');
    expect(details[0]?.open).toBe(true);
    expect(details[1]?.open).toBe(false);
    const rootSummary = container.querySelector('summary');
    expect(rootSummary?.textContent).toContain('when: Date("2026-07-08T00:00:00.000Z")');
    expect(rootSummary?.textContent).toContain('lookup: Map(1)');
  });

  it('mirrors dirty up through onDirtyChange and registers its save action', async () => {
    const write = vi.fn(() => Promise.resolve({ ok: true }));
    installHost(
      vi.fn(() => Promise.resolve<IdbRecordDocument | null>({ text: '{\n  "seq": 1\n}', editable: true })),
      write,
    );
    const onDirtyChange = vi.fn();
    const saves = new Map<string, () => Promise<boolean>>();
    render(
      <IdbRecordEditorTab
        tab={TAB}
        onRevealInStorage={vi.fn()}
        onDirtyChange={onDirtyChange}
        registerSave={(save) => {
          if (save) saves.set(TAB.id, save);
          else saves.delete(TAB.id);
        }}
      />,
    );

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 2\n}' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // The registered save action commits the draft and reports success.
    const save = saves.get(TAB.id);
    expect(save).toBeDefined();
    const ok = save ? await save() : false;
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledWith(42, 0, 'oh-store-app', 'orders', TAB.primaryKeyWire, '{\n  "seq": 2\n}');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
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

  it('silently adopts an external change on a host invalidation push while pristine', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 2\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (tabId, kind, listener) => {
      expect(tabId).toBe(42);
      expect(kind).toBe('indexeddb');
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.value).toBe('{\n  "seq": 1\n}');
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    await waitFor(() => expect(viewer.value).toBe('{\n  "seq": 2\n}'));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps a touched draft while the canonical underneath advances', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 9\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(viewer.value).toBe('{\n  "seq": 5\n}');
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps a dirty editor with an honest note when the record is deleted underneath', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue(null as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    expect(await screen.findByText(/deleted or changed shape/)).toBeTruthy();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{\n  "seq": 5\n}');
    expect(screen.queryByText('Record no longer available')).toBeNull();
  });

  it('re-seeds a clean editor to the honest empty state when the record is deleted underneath', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue(null as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    expect(await screen.findByText('Record no longer available')).toBeTruthy();
  });

  it('chips a touched draft when the record ALSO changed in the browser — Use saved adopts the live text', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 9\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    const chip = await screen.findByTitle('External change available — click to resolve');
    expect(screen.getByText(/record changed in the browser/)).toBeTruthy();
    fireEvent.click(chip);
    fireEvent.click(await screen.findByRole('button', { name: 'Use saved' }));

    await waitFor(() =>
      expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{\n  "seq": 9\n}'),
    );
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('Keep mine dismisses across syncs of the same canonical', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 9\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    const chip = await screen.findByTitle('External change available — click to resolve');
    fireEvent.click(chip);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(screen.queryByTitle('External change available — click to resolve')).toBeNull());

    // Another sync of the SAME canonical stays dismissed.
    captured.invalidate?.();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
    expect(viewer.value).toBe('{\n  "seq": 5\n}');
  });

  it('Open merge view resolves a record conflict through the 3-pane dialog — the merged text becomes the draft', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 9\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    // The merge commit toasts via App.useApp() — the provider must exist.
    render(
      <AntApp>
        <IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />
      </AntApp>,
    );

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();
    await screen.findByText(/record changed in the browser/);

    fireEvent.click(screen.getByRole('button', { name: 'Open merge view' }));
    const dialog = await screen.findByTestId('merge-dialog');
    expect(dialog.getAttribute('data-language')).toBe('json');
    // The panes carry the REAL texts (base = seed-time baseline,
    // mine = draft, saved = live canonical), never the clipped chips.
    expect(screen.getByTestId('merge-base').textContent).toBe('{\n  "seq": 1\n}');
    expect(screen.getByTestId('merge-mine').textContent).toBe('{\n  "seq": 5\n}');
    expect(screen.getByTestId('merge-saved').textContent).toBe('{\n  "seq": 9\n}');

    fireEvent.change(screen.getByLabelText('Merge result'), { target: { value: '{\n  "seq": 14\n}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete merge' }));

    await waitFor(() => expect(screen.queryByTestId('merge-dialog')).toBeNull());
    expect(await screen.findByText(/Merge applied to the draft/)).toBeTruthy();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{\n  "seq": 14\n}');
    // The merge lands in the DRAFT — Save still commits to the record —
    // and the conflict is dismissed until the next divergence.
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/record changed in the browser/)).toBeNull();
  });

  it('cancelling the merge dialog is inert — the draft and the conflict note stay', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue({ text: '{\n  "seq": 9\n}', editable: true } as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();
    await screen.findByText(/record changed in the browser/);

    fireEvent.click(screen.getByRole('button', { name: 'Open merge view' }));
    await screen.findByTestId('merge-dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel merge' }));

    expect(screen.queryByTestId('merge-dialog')).toBeNull();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('{\n  "seq": 5\n}');
    expect(screen.getByText(/record changed in the browser/)).toBeTruthy();
  });

  it('deleted-under-you: Discard my edits drops the draft to the honest empty state', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ text: '{\n  "seq": 1\n}', editable: true })
      .mockResolvedValue(null as IdbRecordDocument | null);
    const captured: { invalidate: (() => void) | null } = { invalidate: null };
    installHost(read, undefined, (_tabId, _kind, listener) => {
      captured.invalidate = listener;
      return () => {};
    });
    render(<IdbRecordEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: '{\n  "seq": 5\n}' } });
    await waitFor(() => expect(captured.invalidate).not.toBeNull());
    captured.invalidate?.();

    expect(await screen.findByText(/deleted or changed shape/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard my edits' }));
    expect(await screen.findByText('Record no longer available')).toBeTruthy();
    expect(screen.queryByText(/deleted or changed shape/)).toBeNull();
  });
});
