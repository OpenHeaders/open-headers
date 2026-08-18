/**
 * MigrateAccountPullModal — the extension's migration entry after the
 * Phase D funnel redesign (the extension account-pull plan): the account
 * pull runs natively on this host, so the stepper is the PRIMARY path,
 * open from the first paint with no scan affordance; the desktop
 * hand-off survives only as a connection-routed fallback note; local
 * tool data routes back to the import hub. The full stepper flow
 * (list → pick → start) rides the same host-blind RPC pair the desktop
 * modal's suite covers — here the accepted-run close is re-proven on
 * this surface.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import type { PostmanWorkspaceListResult } from '@openheaders/core/import';
import MigrateAccountPullModal from '@openheaders/ui/workbench/components/import/MigrateAccountPullModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const WORKSPACE_LIST: PostmanWorkspaceListResult = {
  ok: true,
  workspaces: [{ id: 'ws-a', name: 'OpenHeaders Team', type: 'team', collections: 3, environments: 2 }],
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

function renderModal(props: Partial<Parameters<typeof MigrateAccountPullModal>[0]> = {}) {
  return render(
    <App>
      <MigrateAccountPullModal
        open
        onClose={props.onClose ?? (() => {})}
        connected={props.connected ?? false}
        onOpenImportHub={props.onOpenImportHub ?? (() => {})}
      />
    </App>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MigrateAccountPullModal', () => {
  it('opens with the pull stepper as the primary path and no scan affordance', () => {
    installBridge();
    renderModal();
    expect(screen.getByText('Import from your Postman account')).toBeTruthy();
    expect(screen.getByLabelText('Postman API key')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scan this computer' })).toBeNull();
  });

  it('shows the connected fallback note when the desktop is on the wire', () => {
    installBridge();
    renderModal({ connected: true });
    expect(screen.getByText(/Your desktop app is connected/)).toBeTruthy();
    expect(screen.getByText(/progress mirrors here/)).toBeTruthy();
    expect(screen.queryByText(/The scan needs the desktop app/)).toBeNull();
  });

  it('shows the desktop fallback note when not connected', () => {
    installBridge();
    renderModal({ connected: false });
    expect(screen.getByText(/The scan needs the desktop app/)).toBeTruthy();
    expect(screen.queryByText(/Your desktop app is connected/)).toBeNull();
  });

  it('hands local tool data back to the import hub', () => {
    installBridge();
    const onOpenImportHub = vi.fn();
    renderModal({ onOpenImportHub });
    fireEvent.click(screen.getByRole('button', { name: 'import hub' }));
    expect(onOpenImportHub).toHaveBeenCalledTimes(1);
  });

  it('runs the stepper to an accepted start and closes', async () => {
    const calls = installBridge({ 'oh.migration.postmanPull.start': { started: true, runId: 'run-1' } });
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));
    await screen.findByRole('checkbox', { name: /OpenHeaders Team/ });
    fireEvent.click(screen.getByRole('button', { name: 'Import selected' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls.at(-1)).toEqual({
      type: 'oh.migration.postmanPull.start',
      payload: { apiKey: 'PMAK-abc', workspaceIds: ['ws-a'] },
    });
  });

  it('closes on Esc while still on the key step', () => {
    installBridge();
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', keyCode: 27 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Esc while the workspace listing is in flight; the X asks to keep waiting', async () => {
    // A listing that never settles — the guard window under test.
    installBridge({ 'oh.migration.postmanPull.listWorkspaces': new Promise(() => {}) });
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));

    fireEvent.keyDown(screen.getAllByRole('dialog')[0], { key: 'Escape', keyCode: 27 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findAllByText('Close the import?')).not.toHaveLength(0);
    expect(screen.getByText(/still being listed/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Keep waiting' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const closeAnywayButtons = await screen.findAllByRole('button', { name: 'Close anyway' });
    fireEvent.click(closeAnywayButtons[closeAnywayButtons.length - 1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('ignores Esc once the workspace picker is up; the X asks before closing', async () => {
    installBridge();
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.change(screen.getByLabelText('Postman API key'), { target: { value: 'PMAK-abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'List workspaces' }));
    await screen.findByRole('checkbox', { name: /OpenHeaders Team/ });

    fireEvent.keyDown(screen.getAllByRole('dialog')[0], { key: 'Escape', keyCode: 27 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findAllByText('Close the import?')).not.toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();

    // The dismissed confirm lingers hidden in jsdom (no exit motion), so
    // later queries use the *AllBy* variants and act on the newest match.
    fireEvent.click(screen.getByRole('button', { name: 'Keep selecting' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    const discardButtons = await screen.findAllByRole('button', { name: 'Discard and close' });
    fireEvent.click(discardButtons[discardButtons.length - 1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('renders nothing while closed', () => {
    installBridge();
    render(<MigrateAccountPullModal open={false} onClose={() => {}} connected onOpenImportHub={() => {}} />);
    expect(screen.queryByText('Migrate from another tool')).toBeNull();
  });
});
