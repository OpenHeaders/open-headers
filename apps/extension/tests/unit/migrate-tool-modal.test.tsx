/**
 * MigrateToolModal — the desktop migration entry surface's contract
 * (MIGRATION_STATUS.md S5 addendum: two clicks of consent):
 *   - step 1 explains the scan and runs detect+scan only on the
 *     explicit button click;
 *   - step 2 renders one row per known tool with detection state,
 *     backup findings with counts + Import click-through (via the
 *     host-validated readBackup RPC), Insomnia guidance into the hub,
 *     and scan skips with their reason;
 *   - the API-key field drives `postmanPull.start` exactly once with
 *     the trimmed key, closes on `started`, and surfaces the refusal
 *     reason inline otherwise.
 */

import { type HostBridge, type MigrationScanResult, setHostBridge } from '@openheaders/core/bridge';
import type { ToolInstallFinding } from '@openheaders/core/import';
import MigrateToolModal from '@openheaders/ui/workbench/components/import/MigrateToolModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

async function scanned(calls: CallLog): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Scan this computer' }));
  await waitFor(() => expect(calls.map((c) => c.type)).toContain('oh.migration.scanToolData'));
  await screen.findAllByText('Detected');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MigrateToolModal', () => {
  it('renders the consent copy and does not scan until the button is clicked', () => {
    const calls = installBridge();
    renderModal();
    expect(screen.getByText(/never opens credential, cookie, or session files/i)).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('scans on click 1 and renders the findings inventory', async () => {
    const calls = installBridge();
    renderModal();
    await scanned(calls);

    expect(calls.map((c) => c.type)).toEqual(['oh.migration.detectTools', 'oh.migration.scanToolData']);
    expect(screen.getByText('Postman')).toBeTruthy();
    expect(screen.getByText('Thunder Client')).toBeTruthy();
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
    await scanned(calls);

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
    await scanned(calls);

    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    await screen.findByText('Not an allowlisted backup file.');
    expect(onImportBackupText).not.toHaveBeenCalled();
  });

  it('hands the Insomnia guidance off to the import hub', async () => {
    const calls = installBridge();
    const onOpenImportHub = vi.fn();
    renderModal({ onOpenImportHub });
    await scanned(calls);

    fireEvent.click(screen.getByRole('button', { name: 'import hub' }));
    expect(onOpenImportHub).toHaveBeenCalledTimes(1);
  });

  it('starts the background pull with the trimmed key and closes on started', async () => {
    const calls = installBridge({
      'oh.migration.postmanPull.start': { started: true, runId: 'run-1' },
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await scanned(calls);

    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: '  PMAK-abc  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start background import' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls.at(-1)).toEqual({ type: 'oh.migration.postmanPull.start', payload: { apiKey: 'PMAK-abc' } });
  });

  it('surfaces the refusal reason inline when the run cannot start', async () => {
    const calls = installBridge({
      'oh.migration.postmanPull.start': { started: false, reason: 'A pull is already running.' },
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await scanned(calls);

    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start background import' }));
    await screen.findByText('A pull is already running.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the start button disabled without a key', async () => {
    const calls = installBridge();
    renderModal();
    await scanned(calls);
    const button = screen.getByRole('button', { name: 'Start background import' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a scan error inline and stays on the offer step', async () => {
    const calls = installBridge({ 'oh.migration.detectTools': new Error('no ladder') });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Scan this computer' }));
    await screen.findByText(/The scan could not run/);
    expect(screen.getByRole('button', { name: 'Scan this computer' })).toBeTruthy();
    expect(calls.length).toBeGreaterThan(0);
  });
});
