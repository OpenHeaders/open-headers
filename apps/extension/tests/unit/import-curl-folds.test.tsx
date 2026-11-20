/**
 * The curl import dialog stays compact:
 *   - a command handed off by the hub folds to one row once it parses,
 *     and its caret brings the editable source back;
 *   - a source that needs work (empty, or a hand-off that fails to
 *     parse) never folds, and typing in it keeps it open;
 *   - several report entries fold under their counts, one entry shows
 *     as it is.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import ImportCurlModal from '@openheaders/ui/workbench/components/import/ImportCurlModal';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Ant's inputs measure via rc-resize-observer; jsdom has no ResizeObserver.
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

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
  setCurrentHost('extension');
  setHostBridge({ call: vi.fn(async () => ({ success: true })) } as unknown as HostBridge);
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
});

const CLEAN = "curl 'https://api.openheaders.io/v1/things'";
// One transform (the promoted header) and two drops (the cookie, the output file).
const LOSSY =
  "curl 'https://api.openheaders.io/v1/things' -H 'Authorization: Bearer john-doe-token' -b 'session=1' -o out.json";
const ONE_DROP = "curl 'https://api.openheaders.io/v1/things' -b 'session=1'";

function renderModal(props: Partial<React.ComponentProps<typeof ImportCurlModal>> = {}) {
  return render(
    <AntApp>
      <ImportCurlModal
        open
        collections={[]}
        onCancel={() => undefined}
        onImported={() => undefined}
        createRequest={vi.fn(async () => ({ uid: 'req-1' }))}
        createCollection={vi.fn(async () => ({ uid: 'coll-1' }))}
        {...props}
      />
    </AntApp>,
  );
}

const sourceField = () => document.querySelector<HTMLTextAreaElement>('.ant-modal textarea');

describe('ImportCurlModal — the source fold', () => {
  it('folds a parsed hub hand-off to one row and unfolds it into the editable source', async () => {
    renderModal({ initialSource: CLEAN });
    const row = await screen.findByTestId('import-curl-source-collapsed');
    expect(row.textContent).toContain(CLEAN);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(sourceField()).toBeNull();

    fireEvent.click(row);
    await waitFor(() => expect(sourceField()?.value).toBe(CLEAN));
    expect(screen.queryByTestId('import-curl-source-collapsed')).toBeNull();
    expect(document.activeElement).toBe(sourceField());
  });

  it('folds the open source back from the caret on its intro line', async () => {
    renderModal({ initialSource: CLEAN });
    fireEvent.click(await screen.findByTestId('import-curl-source-collapsed'));
    await waitFor(() => expect(sourceField()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Paste a/ }));
    await screen.findByTestId('import-curl-source-collapsed');
    expect(sourceField()).toBeNull();
  });

  it('keeps an unparseable hand-off open, and open still once it is fixed by hand', async () => {
    renderModal({ initialSource: "curl --bogus-flag-that-never-parses '" });
    await waitFor(() => expect(sourceField()).not.toBeNull());
    expect(screen.queryByTestId('import-curl-source-collapsed')).toBeNull();

    fireEvent.change(sourceField() as HTMLTextAreaElement, { target: { value: CLEAN } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Paste a/ })).toBeTruthy());
    expect(sourceField()?.value).toBe(CLEAN);
    expect(screen.queryByTestId('import-curl-source-collapsed')).toBeNull();
  });

  it('leaves a dialog opened empty on its paste area while a command is typed', async () => {
    renderModal();
    await waitFor(() => expect(sourceField()).not.toBeNull());

    fireEvent.change(sourceField() as HTMLTextAreaElement, { target: { value: CLEAN } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Paste a/ })).toBeTruthy());
    expect(sourceField()?.value).toBe(CLEAN);
    expect(screen.queryByTestId('import-curl-source-collapsed')).toBeNull();
  });
});

describe('ImportCurlModal — the report fold', () => {
  it('folds several entries under their counts and opens to every line', async () => {
    renderModal({ initialSource: LOSSY });
    const toggle = await screen.findByTestId('import-curl-report-toggle');
    expect(toggle.textContent).toContain('1 transform');
    expect(toggle.textContent).toContain('2 drops');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('flag:-b')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('flag:-b')).toBeTruthy();
    expect(screen.getByText('flag:-o')).toBeTruthy();
    expect(screen.getByText('header[0]:')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('flag:-b')).toBeNull();
  });

  it('reads top down: the report, the parsed request, then the fields to fill', async () => {
    renderModal({ initialSource: LOSSY });
    const report = await screen.findByTestId('import-curl-report-toggle');
    const request = screen.getByText('https://api.openheaders.io/v1/things');
    const name = screen.getByPlaceholderText('How this request appears in the sidebar');
    expect(report.compareDocumentPosition(request) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(request.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a single entry as it is, with nothing to unfold', async () => {
    renderModal({ initialSource: ONE_DROP });
    expect(await screen.findByText('flag:-b')).toBeTruthy();
    expect(screen.queryByTestId('import-curl-report-toggle')).toBeNull();
  });

  it('renders no report for a clean command', async () => {
    renderModal({ initialSource: CLEAN });
    await screen.findByTestId('import-curl-source-collapsed');
    expect(screen.queryByTestId('import-curl-report-toggle')).toBeNull();
  });
});
