// @vitest-environment jsdom
/**
 * Settings › Secret Managers › Connections — this device's secret-
 * manager connections edited in place. Pins the registry shape (one
 * `info` def with the custom editor under the declared `connections`
 * section, the category a top-level entry after API Requests), the
 * list's gestures through the secret-manager client (add through the
 * form with the provider's fields, Test, remove), the read-only posture
 * on a browser host, and the Vault row's connection pick over the same
 * client.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/secret-managers';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { SecretProviderProbe } from '@openheaders/core/secret-providers';
import type { SecretManagerConnection } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { secretReferenceInfo } from '@openheaders/ui/workbench/components/panels/SecretManagerRowInfo';
import SecretManagerConnectionsRow from '@openheaders/ui/workbench/settings/components/secret-manager-connections-row';
import { allCategories, byCategory, getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { client } = vi.hoisted(() => ({
  client: {
    useSecretManagerConnections: vi.fn(() => ({ connections: [] as SecretManagerConnection[], ready: true })),
    useSecretManagerProbe: vi.fn<(uid: string | null) => SecretProviderProbe | null>(() => ({ available: true })),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    authorize: vi.fn(),
  },
}));

vi.mock('@openheaders/ui/shared/secret-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/shared/secret-manager')>()),
  useSecretManagerConnections: () => client.useSecretManagerConnections(),
  useSecretManagerProbe: (uid: string | null) => client.useSecretManagerProbe(uid),
  addSecretManagerConnection: (input: unknown) => client.add(input),
  updateSecretManagerConnection: (input: unknown) => client.update(input),
  removeSecretManagerConnection: (uid: string) => client.remove(uid),
  authorizeSecretManagerConnection: (uid: string) => client.authorize(uid),
}));

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
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

const WORK: SecretManagerConnection = {
  uid: 'conn0001',
  label: 'Work',
  config: { provider: 'onepassword', account: 'work', auth: 'app' },
};

let live: SecretManagerConnection[] = [];

beforeEach(async () => {
  live = [];
  client.useSecretManagerConnections.mockImplementation(() => ({ connections: live, ready: true }));
  client.useSecretManagerProbe.mockImplementation(() => ({ available: true }));
  client.add.mockReset();
  client.add.mockResolvedValue({ ok: true, connection: WORK });
  client.update.mockReset();
  client.update.mockResolvedValue({ ok: true, connection: WORK });
  client.remove.mockReset();
  client.remove.mockResolvedValue({ ok: true });
  client.authorize.mockReset();
  client.authorize.mockResolvedValue({ ok: true });
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
  __resetStoreForTests();
});

function requireDef() {
  const def = getDef('secretManagers.connections');
  if (!def) throw new Error('secretManagers.connections not registered');
  return def;
}

function renderBlock(element: React.ReactElement) {
  return render(<App>{element}</App>);
}

describe('secret managers — registry', () => {
  it('registers the one info def with the custom editor under the declared connections section of a top-level category', () => {
    const def = requireDef();
    expect(def.type).toBe('info');
    expect(def.subcategory).toBe('connections');
    expect(def.customEditor).toBe(SecretManagerConnectionsRow);
    expect(def.category).toBe('secretManagers');
    const category = getCategory('secretManagers');
    expect(category?.parent).toBeUndefined();
    const declared = new Set((category?.subcategories ?? []).map((s) => s.id));
    for (const row of byCategory('secretManagers')) expect(declared.has(row.subcategory ?? '')).toBe(true);
    // Sits right after API Requests among the roots.
    const roots = allCategories()
      .filter((c) => c.parent === undefined)
      .map((c) => c.id);
    expect(roots.indexOf('secretManagers')).toBe(roots.indexOf('requests') + 1);
  });
});

describe('connections block', () => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('renders the table with the empty line inside and Add at zero connections', () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    expect(screen.getByTestId('secret-manager-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('secret-manager-row')).toHaveLength(0);
    expect(screen.getByTestId('secret-manager-add').hasAttribute('disabled')).toBe(false);
  });

  it('adds through the form: the provider’s required field gates Save, the config lands typed', async () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    const save = screen.getByTestId('secret-manager-form-save');
    expect(save.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByTestId('secret-manager-form-label'), { target: { value: 'Work' } });
    fireEvent.change(screen.getByTestId('secret-manager-form-account'), { target: { value: 'work' } });
    await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(client.add).toHaveBeenCalledTimes(1));
    expect(client.add).toHaveBeenCalledWith({
      label: 'Work',
      config: { provider: 'onepassword', account: 'work', auth: 'app' },
    });
    await waitFor(() => expect(screen.queryByTestId('secret-manager-form')).toBeNull());
  });

  it('reads an untested connection as Not tested and a verified one as Connected with its age', () => {
    live = [WORK];
    const { rerender } = renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    expect(screen.getByText('Not tested')).toBeTruthy();
    client.useSecretManagerProbe.mockImplementation(() => ({ available: true, verifiedAt: Date.now() - 120_000 }));
    rerender(
      <App>
        <SecretManagerConnectionsRow def={requireDef()} />
      </App>,
    );
    expect(screen.getByText(/^Connected · /)).toBeTruthy();
    expect(screen.queryByText('Not tested')).toBeNull();
  });

  it('lists a connection with its description and status, tests it through the client, removes it', async () => {
    live = [WORK];
    client.useSecretManagerProbe.mockImplementation(() => ({
      available: false,
      reason: 'integration-disabled',
      detail: 'off',
    }));
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    expect(screen.getAllByTestId('secret-manager-row')).toHaveLength(1);
    expect(screen.getByText('work')).toBeTruthy();
    expect(screen.getByText('Integration disabled')).toBeTruthy();
    fireEvent.click(screen.getByTestId('secret-manager-test'));
    await waitFor(() => expect(client.authorize).toHaveBeenCalledWith('conn0001'));
    fireEvent.click(screen.getByTestId('secret-manager-remove'));
    await waitFor(() => expect(client.remove).toHaveBeenCalledWith('conn0001'));
  });

  it('edits in place with the provider pinned and the fields hydrated', async () => {
    live = [WORK];
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-edit'));
    const account = screen.getByTestId('secret-manager-form-account') as HTMLInputElement;
    expect(account.value).toBe('work');
    fireEvent.change(account, { target: { value: 'personal' } });
    fireEvent.click(screen.getByTestId('secret-manager-form-save'));
    await waitFor(() => expect(client.update).toHaveBeenCalledTimes(1));
    expect(client.update).toHaveBeenCalledWith({
      uid: 'conn0001',
      label: 'Work',
      config: { provider: 'onepassword', account: 'personal', auth: 'app' },
    });
  });
});

describe('connections block on a browser host', () => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'browser');
  });

  it('reads the list read-only with the honest note', () => {
    live = [WORK];
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    expect(screen.getByTestId('secret-manager-add').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('secret-manager-remove').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/live on the desktop app/)).toBeTruthy();
  });
});

/** Highlighted example-card tokens of the currently open popover. */
const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

describe('connection form info popovers', () => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('leads the Provider popover with the provider’s card, the connection and the resolved reference lit', async () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    fireEvent.click(screen.getByRole('button', { name: 'About 1Password' }));
    expect(await screen.findByText('Example connection and reference')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Secret Manager');
    expect(litTokens()).toEqual([
      'name: Work',
      'account: Acme Team',
      'auth: desktop app',
      'op://Engineering/Payments API/credential',
    ]);
  });

  it('lights the Name row’s token on the connect line', async () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    fireEvent.click(screen.getByRole('button', { name: 'About Name' }));
    expect(await screen.findByText('Example connection and reference')).toBeTruthy();
    expect(litTokens()).toEqual(['name: Work']);
  });

  it('lights the Account row’s own slice and reads its copy', async () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    fireEvent.click(screen.getByRole('button', { name: 'About Account' }));
    expect(await screen.findByText('Example connection and reference')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('1Password');
    expect(document.querySelector('.oh-info-popover-title')?.textContent).toBe('Account');
    expect(litTokens()).toEqual(['account: Acme Team']);
    expect(screen.getByText(/exactly as the 1Password app lists it/)).toBeTruthy();
  });

  it('follows the auth picklist on the card', async () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    fireEvent.click(screen.getByRole('button', { name: 'About Authentication' }));
    expect(await screen.findByText('Example connection and reference')).toBeTruthy();
    expect(litTokens()).toEqual(['auth: desktop app']);
  });

  it('keeps the provider’s text fields in the form’s own font', () => {
    renderBlock(<SecretManagerConnectionsRow def={requireDef()} />);
    fireEvent.click(screen.getByTestId('secret-manager-add'));
    const account = screen.getByTestId('secret-manager-form-account') as HTMLInputElement;
    expect(account.style.fontFamily).toBe('');
  });
});

describe('the Vault row’s reference popover', () => {
  it('lights the whole path and the resolved line, then lists every path field with its copy', async () => {
    const t = getTranslator(DEFAULT_LOCALE);
    renderBlock(<InfoTrigger content={secretReferenceInfo(t, 'hashivault')} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Reference' }));
    expect(await screen.findByText('Example connection and reference')).toBeTruthy();
    expect(document.querySelector('.oh-info-popover-kicker')?.textContent).toBe('HashiCorp Vault');
    expect(litTokens()).toEqual(['mount: secret', 'path: payments/api', 'key: token', 'secret/payments/api#token']);
    expect(screen.getByText('Mount')).toBeTruthy();
    expect(screen.getByText('Path')).toBeTruthy();
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByText(/secret for the default KV engine/)).toBeTruthy();
  });
});
