// @vitest-environment jsdom
/**
 * DomStorageEntryEditorTab — one localStorage/sessionStorage entry
 * opened as a full editor-tab document. One-shot full-value fetch over
 * the host seam, key + value editing with derived dirty across both
 * fields, value-only saves riding the plain write, key changes riding
 * the collision-guarded rename (re-keying the tab via onRenamed),
 * reasoned failure notes, the too-large read-only gate, and the honest
 * empty state with a Refresh retry.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { DomStorageEntryEditorTab } from '@openheaders/ui/panel/components/storage/DomStorageEntryEditorTab';
import { buildDomStorageEntryTab } from '@openheaders/ui/panel/data/inspector-tab';
import { notifyDomStorageWrite } from '@openheaders/ui/panel/data/storage/dom-storage-write-notifier';
import type { DomStorageFullValue, StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
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
  readDomStorageValue: StorageInspectorHost['readDomStorageValue'],
  writeDomStorage: StorageInspectorHost['writeDomStorage'] = vi.fn(() => Promise.resolve(false)),
  renameDomStorage: StorageInspectorHost['renameDomStorage'] = vi.fn(() => Promise.resolve({ ok: false })),
) {
  const host: StorageInspectorHost = {
    listScopes: vi.fn(() => Promise.resolve(null)),
    readDomStorage: vi.fn(() => Promise.resolve(null)),
    readDomStorageValue,
    writeDomStorage,
    renameDomStorage,
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

function fullValue(value: string): Promise<DomStorageFullValue | null> {
  return Promise.resolve({ value, tooLarge: false });
}

const TAB = buildDomStorageEntryTab({
  frameId: 0,
  area: 'local',
  entryKey: 'oh-theme',
  timestamp: 1_770_000_000_000,
});

beforeEach(() => {
  setHostNavigation(NAV);
});

afterEach(() => {
  cleanup();
});

describe('DomStorageEntryEditorTab', () => {
  it('fetches the full value with the tab coordinates and renders it editable', async () => {
    const read = vi.fn(() => fullValue('dark'));
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(read).toHaveBeenCalledWith(42, 0, 'local', 'oh-theme');
    expect(viewer.value).toBe('dark');
    expect(viewer.readOnly).toBe(false);
    expect(viewer.getAttribute('data-language')).toBe('plaintext');
    expect((screen.getByLabelText('Entry key') as HTMLInputElement).value).toBe('oh-theme');
  });

  it('keys the language and Preview off a JSON value', async () => {
    installHost(vi.fn(() => fullValue('{"mode": "dark"}')));
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = await screen.findByTestId('code-viewer');
    expect(viewer.getAttribute('data-language')).toBe('json');
    const preview = screen.getByRole('tab', { name: 'Preview' });
    expect(preview.hasAttribute('disabled')).toBe(false);
    fireEvent.click(preview);
    expect(screen.getByLabelText('Entry value tree')).toBeTruthy();
    expect(screen.getByText('"mode"')).toBeTruthy();
    expect(screen.queryByTestId('code-viewer')).toBeNull();
  });

  it('disables Preview for a non-JSON value', async () => {
    installHost(vi.fn(() => fullValue('plain text')));
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    expect(screen.getByRole('tab', { name: 'Preview' }).hasAttribute('disabled')).toBe(true);
  });

  it('derives dirty from the VALUE draft and gates Save on it', async () => {
    installHost(vi.fn(() => fullValue('dark')));
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(viewer, { target: { value: 'light' } });
    expect(save.hasAttribute('disabled')).toBe(false);

    fireEvent.change(viewer, { target: { value: 'dark' } });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('derives dirty from the KEY draft — and an empty key keeps Save disabled', async () => {
    installHost(vi.fn(() => fullValue('dark')));
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    const keyInput = screen.getByLabelText('Entry key') as HTMLInputElement;
    const save = screen.getByRole('button', { name: 'Save' });

    fireEvent.change(keyInput, { target: { value: 'oh-appearance' } });
    expect(save.hasAttribute('disabled')).toBe(false);

    fireEvent.change(keyInput, { target: { value: '' } });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(keyInput, { target: { value: 'oh-theme' } });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('saves a value-only edit through the plain write and re-fetches', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'light', tooLarge: false } as DomStorageFullValue | null);
    const write = vi.fn(() => Promise.resolve(true));
    installHost(read, write);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'light' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(write).toHaveBeenCalledWith(42, 0, 'local', 'oh-theme', 'light');
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true));
  });

  it('commits a key change through the rename and re-keys the tab via onRenamed', async () => {
    const rename = vi.fn(() => Promise.resolve({ ok: true }));
    const write = vi.fn(() => Promise.resolve(true));
    const onRenamed = vi.fn();
    installHost(
      vi.fn(() => fullValue('dark')),
      write,
      rename,
    );
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} onRenamed={onRenamed} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'light' } });
    fireEvent.change(screen.getByLabelText('Entry key'), { target: { value: 'oh-appearance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('oh-appearance'));
    expect(rename).toHaveBeenCalledWith(42, 0, 'local', 'oh-theme', 'oh-appearance', 'light');
    expect(write).not.toHaveBeenCalled();
  });

  it('renders the reasoned collision note, keeps the drafts, and clears the note on edit', async () => {
    const rename = vi.fn(() => Promise.resolve({ ok: false, reason: 'collision' as const }));
    installHost(
      vi.fn(() => fullValue('dark')),
      undefined,
      rename,
    );
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    const keyInput = screen.getByLabelText('Entry key') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'oh-existing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already exists/)).toBeTruthy();
    expect(keyInput.value).toBe('oh-existing');

    fireEvent.change(keyInput, { target: { value: 'oh-existing-2' } });
    expect(screen.queryByText(/already exists/)).toBeNull();
  });

  it('notes an unreasoned value-write failure', async () => {
    installHost(
      vi.fn(() => fullValue('dark')),
      vi.fn(() => Promise.resolve(false)),
    );
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'light' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/write was rejected/)).toBeTruthy();
    expect(viewer.value).toBe('light');
  });

  it('gates a value past the edit ceiling as a read-only too-large state', async () => {
    installHost(vi.fn(() => Promise.resolve({ value: null, tooLarge: true })));
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText('Too large to open')).toBeTruthy();
    expect(screen.queryByTestId('code-viewer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByLabelText('Entry key')).toBeNull();
  });

  it('degrades to the honest empty state when the entry is gone, and Refresh retries', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: null, tooLarge: false })
      .mockResolvedValue({ value: 'back', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    expect(await screen.findByText('Entry no longer available')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Refresh entry'));
    const viewer = await screen.findByTestId('code-viewer');
    expect((viewer as HTMLTextAreaElement).value).toBe('back');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('arms Refresh while dirty — only the confirm discards the drafts', async () => {
    const read = vi.fn(() => fullValue('dark'));
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'light' } });

    fireEvent.click(screen.getByLabelText('Refresh entry'));
    expect(read).toHaveBeenCalledTimes(1);
    expect(viewer.value).toBe('light');

    fireEvent.click(screen.getByLabelText('Refresh entry — click again to confirm'));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('dark'));
  });

  it('mirrors dirty up through onDirtyChange and registers its save action', async () => {
    const write = vi.fn(() => Promise.resolve(true));
    installHost(
      vi.fn(() => fullValue('dark')),
      write,
    );
    const onDirtyChange = vi.fn();
    const saves = new Map<string, () => Promise<boolean>>();
    render(
      <DomStorageEntryEditorTab
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
    fireEvent.change(viewer, { target: { value: 'light' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const save = saves.get(TAB.id);
    expect(save).toBeDefined();
    const ok = save ? await save() : false;
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledWith(42, 0, 'local', 'oh-theme', 'light');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('silently adopts an external value change while pristine (live canonical)', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'light', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.value).toBe('dark');
    notifyDomStorageWrite();

    await waitFor(() => expect(viewer.value).toBe('light'));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps a touched value draft while the canonical underneath advances', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'theirs', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    notifyDomStorageWrite();

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(viewer.value).toBe('my-draft');
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps a dirty editor with an honest note when the entry is deleted underneath', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue(null as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    notifyDomStorageWrite();

    expect(await screen.findByText(/deleted in the browser/)).toBeTruthy();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('my-draft');
    expect(screen.queryByText('Entry no longer available')).toBeNull();
  });

  it('re-seeds a clean editor to the honest empty state when the entry is deleted underneath', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue(null as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    await screen.findByTestId('code-viewer');
    notifyDomStorageWrite();

    expect(await screen.findByText('Entry no longer available')).toBeTruthy();
  });

  it('chips a touched draft when the value ALSO changed in the browser — Use saved adopts, Keep mine dismisses until the next divergence', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValueOnce({ value: 'theirs', tooLarge: false })
      .mockResolvedValue({ value: 'theirs-2', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
    notifyDomStorageWrite();

    const chip = await screen.findByTitle('External change available — click to resolve');
    expect(screen.getByText(/value changed in the browser/)).toBeTruthy();
    fireEvent.click(chip);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(screen.queryByTitle('External change available — click to resolve')).toBeNull());
    expect(viewer.value).toBe('my-draft');

    // A further external change re-surfaces the dismissed conflict…
    notifyDomStorageWrite();
    const chip2 = await screen.findByTitle('External change available — click to resolve');

    // …and Use saved adopts the live value, going clean.
    fireEvent.click(chip2);
    fireEvent.click(await screen.findByRole('button', { name: 'Use saved' }));
    await waitFor(() => expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('theirs-2'));
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('Open merge view resolves a value conflict through the 3-pane dialog — the merged text becomes the draft', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'theirs', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    // The merge commit toasts via App.useApp() — the provider must exist.
    render(
      <AntApp>
        <DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />
      </AntApp>,
    );

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    notifyDomStorageWrite();
    await screen.findByText(/value changed in the browser/);

    fireEvent.click(screen.getByRole('button', { name: 'Open merge view' }));
    await screen.findByTestId('merge-dialog');
    // The panes carry the REAL values (base = seed-time baseline,
    // mine = draft, saved = live canonical), never the clipped chips.
    expect(screen.getByTestId('merge-base').textContent).toBe('dark');
    expect(screen.getByTestId('merge-mine').textContent).toBe('my-draft');
    expect(screen.getByTestId('merge-saved').textContent).toBe('theirs');

    fireEvent.change(screen.getByLabelText('Merge result'), { target: { value: 'merged-by-hand' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete merge' }));

    await waitFor(() => expect(screen.queryByTestId('merge-dialog')).toBeNull());
    expect(await screen.findByText(/Merge applied to the draft/)).toBeTruthy();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('merged-by-hand');
    // The merge lands in the DRAFT — Save still commits to the browser —
    // and the conflict is dismissed until the next divergence.
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/value changed in the browser/)).toBeNull();
  });

  it('cancelling the merge dialog is inert — the draft and the conflict note stay', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'theirs', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    notifyDomStorageWrite();
    await screen.findByText(/value changed in the browser/);

    fireEvent.click(screen.getByRole('button', { name: 'Open merge view' }));
    await screen.findByTestId('merge-dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel merge' }));

    expect(screen.queryByTestId('merge-dialog')).toBeNull();
    expect((screen.getByTestId('code-viewer') as HTMLTextAreaElement).value).toBe('my-draft');
    expect(screen.getByText(/value changed in the browser/)).toBeTruthy();
  });

  it('a convergent edit (draft equals the new live value) never chips', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue({ value: 'same', tooLarge: false } as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'same' } });
    notifyDomStorageWrite();

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true));
    expect(screen.queryByTitle('External change available — click to resolve')).toBeNull();
  });

  it('deleted-under-you: Discard my edits drops the drafts to the honest empty state', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ value: 'dark', tooLarge: false })
      .mockResolvedValue(null as DomStorageFullValue | null);
    installHost(read);
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={vi.fn()} />);

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    fireEvent.change(viewer, { target: { value: 'my-draft' } });
    notifyDomStorageWrite();

    expect(await screen.findByText(/deleted in the browser/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard my edits' }));
    expect(await screen.findByText('Entry no longer available')).toBeTruthy();
    expect(screen.queryByText(/deleted in the browser/)).toBeNull();
  });

  it('routes Reveal in Storage back to the originating area', async () => {
    installHost(vi.fn(() => fullValue('dark')));
    const onReveal = vi.fn();
    render(<DomStorageEntryEditorTab tab={TAB} onRevealInStorage={onReveal} />);

    await screen.findByTestId('code-viewer');
    fireEvent.click(screen.getByText('Reveal in Storage'));
    expect(onReveal).toHaveBeenCalledWith('local');
  });
});
