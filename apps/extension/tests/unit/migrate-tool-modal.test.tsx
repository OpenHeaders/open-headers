/**
 * MigrateToolModal — the single-modal migration surface's contract
 * (MIGRATION_STATUS.md S14 UI law: one wide modal, sections collapse
 * and steps render inline):
 *   - the vendor section is always visible; detection runs only on the
 *     explicit "Scan this computer" click and fills in status-only
 *     vendor rows plus the compact details table below;
 *   - a backup row's Import… routes through the host-validated
 *     readBackup RPC into the sectioned flow; Insomnia guidance hands
 *     off to the import hub; scan skips render with their reason;
 *   - "Import from Postman account" needs no detection: it collapses the
 *     other vendors and reveals the inline stepper — key → listWorkspaces →
 *     checkbox picker → start narrowed to the selected workspaceIds —
 *     closing on `started` and surfacing refusal reasons inline.
 */

import { type HostBridge, type MigrationScanResult, setHostBridge } from '@openheaders/core/bridge';
import type { PostmanWorkspaceListResult, ToolInstallFinding } from '@openheaders/core/import';
import MigrateToolModal from '@openheaders/ui/workbench/components/import/MigrateToolModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Ant's Table measures via rc-resize-observer and the responsive
// observer; jsdom has neither ResizeObserver nor matchMedia.
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

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const TOOLS: ToolInstallFinding[] = [
  { tool: 'postman', displayName: 'Postman', detected: true, markers: ['/Applications/Postman.app'] },
  { tool: 'insomnia', displayName: 'Insomnia', detected: true, markers: ['/Applications/Insomnia.app'] },
  { tool: 'thunder-client', displayName: 'Thunder Client', detected: false, markers: [] },
  { tool: 'bruno', displayName: 'Bruno', detected: false, markers: [] },
];

const SCAN: MigrationScanResult = {
  findings: [
    {
      tool: 'postman',
      store: 'postman-backup',
      path: '/home/u/.config/Postman/backup-2026-03-18.json',
      mtimeMs: 1750000000000,
      counts: { collections: 3, environments: 2, globals: 1, headerPresets: 4 },
    },
    {
      tool: 'insomnia',
      store: 'insomnia-nedb',
      dir: '/home/u/.config/Insomnia',
      files: ['insomnia.Workspace.db'],
      counts: { collections: 1, environments: 1, requests: 7 },
    },
  ],
  skipped: [{ path: '/home/u/.config/Postman/backup-old.json', reason: 'Superseded by a newer backup.' }],
};

const WORKSPACE_LIST: PostmanWorkspaceListResult = {
  ok: true,
  workspaces: [
    { id: 'ws-a', name: 'OpenHeaders Team', type: 'team', collections: 3, environments: 2 },
    { id: 'ws-b', name: 'Personal', type: 'personal', collections: 1, environments: 0 },
  ],
  budget: {},
};

type CallLog = Array<{ type: string; payload?: unknown }>;

function installBridge(overrides: Partial<Record<string, unknown>> = {}): CallLog {
  const calls: CallLog = [];
  const bridge: HostBridge = {
    async call(type, ...args) {
      calls.push({ type: String(type), payload: args[0] });
      if (String(type) in overrides) {
        const value = overrides[String(type)];
        if (value instanceof Error) throw value;
        return value as never;
      }
      if (type === 'oh.migration.detectTools') return TOOLS as never;
      if (type === 'oh.migration.scanToolData') return SCAN as never;
      if (type === 'oh.migration.postmanPull.listWorkspaces') return WORKSPACE_LIST as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe: () => () => {},
    presence: () => () => {},
  };
  setHostBridge(bridge);
  return calls;
}

function renderModal(props: Partial<Parameters<typeof MigrateToolModal>[0]> = {}) {
  return render(
    <MigrateToolModal
      open
      onClose={props.onClose ?? (() => {})}
      onImportBackupText={props.onImportBackupText ?? (() => {})}
      onOpenImportHub={props.onOpenImportHub ?? (() => {})}
    />,
  );
}

async function detected(calls: CallLog): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Scan this computer' }));
  await waitFor(() => expect(calls.map((c) => c.type)).toContain('oh.migration.scanToolData'));
  await screen.findAllByText('Detected');
}

async function openedPicker(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Import from Postman account' }));
  fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: '  PMAK-abc  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));
  await screen.findByRole('checkbox', { name: /OpenHeaders Team/ });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MigrateToolModal', () => {
  it('renders the consent copy and vendor rows, and does not detect until the button is clicked', () => {
    const calls = installBridge();
    renderModal();
    expect(screen.getByText(/never opens credential, cookie, or session files/i)).toBeTruthy();
    expect(screen.getByText('Postman')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.queryByText('Detected')).toBeNull();
    expect(screen.getAllByText('–')).toHaveLength(4);
    expect(screen.getByText(/Nothing scanned yet/)).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('detects on click and renders status-only rows with the details table below', async () => {
    const calls = installBridge();
    renderModal();
    await detected(calls);

    expect(calls.map((c) => c.type)).toEqual(['oh.migration.detectTools', 'oh.migration.scanToolData']);
    expect(screen.getAllByText('Detected')).toHaveLength(2);
    expect(screen.getAllByText('Not found')).toHaveLength(2);
    expect(screen.getByText('3 collections · 2 environments · 4 header presets · 1 globals')).toBeTruthy();
    expect(screen.getByText('1 collections · 1 environments · 7 requests')).toBeTruthy();
    expect(screen.getByText(/Superseded by a newer backup/)).toBeTruthy();
  });

  it('routes a backup Import click through readBackup into the sectioned flow', async () => {
    const calls = installBridge({ 'oh.migration.readBackup': { text: '{"version":1}' } });
    const onImportBackupText = vi.fn();
    renderModal({ onImportBackupText });
    await detected(calls);

    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    await waitFor(() => expect(onImportBackupText).toHaveBeenCalledWith('{"version":1}'));
    expect(calls.at(-1)).toEqual({
      type: 'oh.migration.readBackup',
      payload: { path: '/home/u/.config/Postman/backup-2026-03-18.json' },
    });
  });

  it('shows the refusal reason when the host declines the backup read', async () => {
    const calls = installBridge({
      'oh.migration.readBackup': { text: null, reason: 'Not an allowlisted backup file.' },
    });
    const onImportBackupText = vi.fn();
    renderModal({ onImportBackupText });
    await detected(calls);

    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    await screen.findByText('Not an allowlisted backup file.');
    expect(onImportBackupText).not.toHaveBeenCalled();
  });

  it('hands the Insomnia guidance off to the import hub', async () => {
    const calls = installBridge();
    const onOpenImportHub = vi.fn();
    renderModal({ onOpenImportHub });
    await detected(calls);

    fireEvent.click(screen.getByRole('button', { name: 'import hub' }));
    expect(onOpenImportHub).toHaveBeenCalledTimes(1);
  });

  it('opens the pull stepper without detection and collapses the other vendors', () => {
    const calls = installBridge();
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Import from Postman account' }));
    expect(screen.getByLabelText('Postman API key')).toBeTruthy();
    expect(screen.queryByText('Bruno')).toBeNull();
    expect(screen.queryByText('Insomnia')).toBeNull();
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Postman API key')).toBeNull();
    expect(screen.getByText('Bruno')).toBeTruthy();
  });

  it('keeps the stepper button disabled without a key', () => {
    installBridge();
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Import from Postman account' }));
    const button = screen.getByRole('button', { name: 'List workspaces' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists the account workspaces with the trimmed key and renders the picker pre-selected', async () => {
    const calls = installBridge();
    renderModal();
    await openedPicker();

    expect(calls.at(-1)).toEqual({
      type: 'oh.migration.postmanPull.listWorkspaces',
      payload: { apiKey: 'PMAK-abc' },
    });
    expect(screen.getByText('3 collections · 2 environments')).toBeTruthy();
    expect(screen.getByText('1 collections · 0 environments')).toBeTruthy();
    const team = screen.getByRole('checkbox', { name: /OpenHeaders Team/ }) as HTMLInputElement;
    const personal = screen.getByRole('checkbox', { name: /Personal/ }) as HTMLInputElement;
    expect(team.checked).toBe(true);
    expect(personal.checked).toBe(true);
  });

  it('surfaces the enumeration refusal inline and stays on the key step', async () => {
    installBridge({
      'oh.migration.postmanPull.listWorkspaces': { ok: false, reason: 'The API key was rejected.' },
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Import from Postman account' }));
    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));
    await screen.findByText('The API key was rejected.');
    expect(screen.getByLabelText('Postman API key')).toBeTruthy();
  });

  it('shows the star ticker with a timer while the account enumeration runs', async () => {
    installBridge({ 'oh.migration.postmanPull.listWorkspaces': new Promise(() => {}) });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Import from Postman account' }));
    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));
    expect(await screen.findByText(/Contacting your Postman account…/)).toBeTruthy();
    expect(screen.getByText('(0s)')).toBeTruthy();
  });

  it('starts the pull narrowed to the selected workspaces and closes on started', async () => {
    const calls = installBridge({
      'oh.migration.postmanPull.start': { started: true, runId: 'run-1' },
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await openedPicker();

    fireEvent.click(screen.getByRole('checkbox', { name: /Personal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import selected' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls.at(-1)).toEqual({
      type: 'oh.migration.postmanPull.start',
      payload: { apiKey: 'PMAK-abc', workspaceIds: ['ws-a'] },
    });
  });

  it('disables Import selected when every workspace is deselected', async () => {
    installBridge();
    renderModal();
    await openedPicker();

    fireEvent.click(screen.getByRole('checkbox', { name: /OpenHeaders Team/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Personal/ }));
    const button = screen.getByRole('button', { name: 'Import selected' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('surfaces the refusal reason inline when the run cannot start', async () => {
    installBridge({
      'oh.migration.postmanPull.start': { started: false, reason: 'A pull is already running.' },
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await openedPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Import selected' }));
    await screen.findByText('A pull is already running.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a detection error inline and keeps the section usable', async () => {
    const calls = installBridge({ 'oh.migration.detectTools': new Error('no ladder') });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Scan this computer' }));
    await screen.findByText(/The scan could not run/);
    // The spinner's exit animation never completes under jsdom, so the
    // accessible name may keep its "loading" prefix — match loosely.
    expect(await screen.findByRole('button', { name: /Scan this computer/ })).toBeTruthy();
    expect(calls.length).toBeGreaterThan(0);
  });
});
