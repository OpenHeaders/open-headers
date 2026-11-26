// @vitest-environment jsdom
/**
 * The two surfaces that say a Windows package's launch alias is switched
 * off — the Add-ons popover's row for the browser helper's alias, and the
 * MCP client row's notice for the app's — over the `packageAliases`
 * capability only a Windows package registers.
 *
 * Each speaks only while its own alias is off, names the alias as Windows
 * Settings lists it, and offers the way to the switch. A host without the
 * capability renders neither.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/backend';
import '@openheaders/ui/workbench/settings/schema/mcp';
import { type PackageAliases, registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { BrowserHelperAliasRow } from '@openheaders/ui/shared/status';
import McpClientConfigRow from '@openheaders/ui/workbench/settings/components/mcp-client-config-row';
import { getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

const APP_NAME = 'OpenHeaders';
const HELPER_NAME = 'OpenHeaders browser helper';
const HELPER_SENTENCE = `Browsers need the “${HELPER_NAME}” alias turned on in Windows.`;
const APP_SENTENCE = `This command needs the “${APP_NAME}” alias turned on in Windows.`;

interface AliasSwitches {
  app: boolean;
  helper: boolean;
}

function registerAliases(switches: AliasSwitches): { openSettings: ReturnType<typeof vi.fn>; switches: AliasSwitches } {
  const openSettings = vi.fn();
  const aliases: PackageAliases = {
    read: async () => ({
      app: { on: switches.app, name: APP_NAME },
      helper: { on: switches.helper, name: HELPER_NAME },
    }),
    openSettings,
  };
  registerCapability('packageAliases', () => aliases);
  return { openSettings, switches };
}

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

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  unregisterCapability('packageAliases');
  __resetStoreForTests();
});

/** Lets the mount's read of the aliases land. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the Add-ons row for the browser helper's alias", () => {
  it('renders nothing on a host without launch aliases', async () => {
    const { container } = render(<BrowserHelperAliasRow />);
    await settle();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing while Windows keeps the alias', async () => {
    registerAliases({ app: false, helper: true });
    const { container } = render(<BrowserHelperAliasRow />);
    await settle();
    expect(container.firstChild).toBeNull();
  });

  it('names the alias and opens Windows Settings while it is off', async () => {
    const { openSettings } = registerAliases({ app: true, helper: false });
    render(<BrowserHelperAliasRow />);

    await screen.findByText(HELPER_SENTENCE);
    fireEvent.click(screen.getByTestId('addons-helper-alias-open'));
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it('goes once the alias is back on and the window takes focus again', async () => {
    const { switches } = registerAliases({ app: true, helper: false });
    render(<BrowserHelperAliasRow />);
    await screen.findByText(HELPER_SENTENCE);

    switches.helper = true;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.queryByText(HELPER_SENTENCE)).toBeNull());
  });
});

describe("the MCP client row's notice for the app's alias", () => {
  function renderRow() {
    const def = getDef('mcp.clientConfig');
    if (!def) throw new Error('mcp.clientConfig not registered');
    return render(<McpClientConfigRow def={def} />);
  }

  it('is absent on a host without launch aliases', async () => {
    renderRow();
    await settle();
    expect(screen.queryByTestId('mcp-alias-off')).toBeNull();
  });

  it('is absent while Windows keeps the alias', async () => {
    registerAliases({ app: true, helper: false });
    renderRow();
    await settle();
    expect(screen.queryByTestId('mcp-alias-off')).toBeNull();
  });

  it('names the alias and opens Windows Settings while it is off', async () => {
    const { openSettings } = registerAliases({ app: false, helper: true });
    renderRow();

    await screen.findByText(APP_SENTENCE);
    fireEvent.click(screen.getByTestId('mcp-alias-open'));
    expect(openSettings).toHaveBeenCalledOnce();
  });
});
