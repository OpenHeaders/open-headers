/**
 * DebugModePill capability gate.
 *
 * On a browser extension without the `cdpInspection` capability (Firefox /
 * Safari) the control stays visible-but-disabled with a tooltip pointing to
 * Chrome / Edge, so the feature stays discoverable. Non-browser hosts
 * (desktop) have nothing to debug and render nothing. Where the capability is
 * present the control is fully interactive.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import '@openheaders/ui/workbench/settings/schema/keyboard';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { DebugModePill } from '@openheaders/ui/shared/debug-mode';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HINT = /available in Chrome and Edge/i;

const { mockCall, mockSubscribe } = vi.hoisted(() => ({ mockCall: vi.fn(), mockSubscribe: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: mockSubscribe, broadcast: vi.fn(), presence: vi.fn() },
  };
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
  mockCall.mockReset();
  mockCall.mockResolvedValue({ snapshot: {} });
  mockSubscribe.mockReset();
  mockSubscribe.mockReturnValue(() => {});
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  setCurrentHost('extension');
  __resetStoreForTests();
  vi.restoreAllMocks();
});

describe('DebugModePill capability gate', () => {
  it('renders visible-but-disabled with a Chrome/Edge hint when the browser lacks the capability', async () => {
    // Firefox / Safari extension: the host never registered `cdpInspection`.
    const { container } = render(<DebugModePill tabSource="active" />);
    await screen.findByText('Debug mode');

    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('aria-label')).toMatch(HINT);

    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    // No interactive controls trigger in the disabled state.
    expect(screen.queryByRole('button', { name: 'Debug mode controls' })).toBeNull();
  });

  it('renders nothing on a non-browser host (desktop)', async () => {
    setCurrentHost('desktop');
    const { container } = render(<DebugModePill tabSource="none" />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));

    expect(screen.queryByText('Debug mode')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('renders the interactive control when the capability is present', async () => {
    registerCapability('cdpInspection', () => true);
    render(<DebugModePill tabSource="active" />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));

    expect(screen.getByRole('button', { name: 'Debug mode controls' })).toBeTruthy();
    expect(screen.queryByLabelText(HINT)).toBeNull();
  });
});
