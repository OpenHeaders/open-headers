/**
 * ProxyTrustPane — the consent surface over `oh.daemon.proxy.trust.*`
 * (PROXY_SECURITY.md §2.3, §5). Pins the load-bearing consent laws:
 * nothing is installed before the wizard's explicit commit, no store is
 * ever pre-checked, the install call carries exactly the checked
 * stores, partial failure renders exactly as reported (an elevation
 * denial is surfaced, never retried), and teardown affordances follow
 * the recorded-changes state.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import type { ProxyCaPublicInfo, ProxyTrustChange, ProxyTrustStoreState } from '@openheaders/core/types';
import ProxyTrustPane from '@openheaders/ui/workbench/settings/components/proxy-trust-pane';
import type { CategoryDef } from '@openheaders/ui/workbench/settings/types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// antd's Popconfirm measures via rc-resize-observer — jsdom has none.
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

const CATEGORY: CategoryDef = {
  id: 'proxyTrust',
  labelKey: 'workbench.settings.category.proxyTrust.label',
  icon: null,
  order: 89,
};

interface TrustStatus {
  ca: ProxyCaPublicInfo | null;
  stores: ProxyTrustStoreState[];
  changes: ProxyTrustChange[];
  systemKeychainTrustSupported?: boolean;
}

const CA: ProxyCaPublicInfo = {
  subject: 'CN=Open Headers Proxy CA',
  fingerprintSha256: 'ab'.repeat(32),
  notBeforeIso: '2026-07-20T00:00:00.000Z',
  notAfterIso: '2036-07-20T00:00:00.000Z',
  createdAt: 1_752_960_000_000,
};

function storeState(overrides: Partial<ProxyTrustStoreState> = {}): ProxyTrustStoreState {
  return {
    store: 'macos-login-keychain',
    ref: '/Users/dev/Library/Keychains/login.keychain-db',
    state: 'absent',
    ...overrides,
  };
}

function change(overrides: Partial<ProxyTrustChange> = {}): ProxyTrustChange {
  return {
    store: 'macos-login-keychain',
    ref: '/Users/dev/Library/Keychains/login.keychain-db',
    fingerprintSha256: 'ab'.repeat(32),
    fingerprintSha1: 'cd'.repeat(20),
    at: 1_752_960_000_000,
    ...overrides,
  };
}

interface BridgeFake {
  install: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function installBridge(
  status: () => TrustStatus,
  handlers: { install?: (payload: unknown) => unknown; remove?: (payload: unknown) => unknown } = {},
): BridgeFake {
  const install = vi.fn(handlers.install ?? (() => ({ ok: true, ca: CA, results: [] })));
  const remove = vi.fn(handlers.remove ?? (() => ({ ok: true, results: [] })));
  const bridge: HostBridge = {
    async call(type, ...args) {
      if (type === 'oh.daemon.proxy.trust.status') {
        return { systemKeychainTrustSupported: true, ...status() } as never;
      }
      if (type === 'oh.daemon.proxy.trust.install') return install(args[0]) as never;
      if (type === 'oh.daemon.proxy.trust.remove') return remove(args[0]) as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe: () => () => {},
    presence: () => () => {},
  };
  setHostBridge(bridge);
  return { install, remove };
}

function renderPane(): void {
  render(
    <AntApp>
      <ProxyTrustPane category={CATEGORY} defs={[]} />
    </AntApp>,
  );
}

afterEach(cleanup);

describe('ProxyTrustPane', () => {
  it('renders live store states and the no-CA scaffold; teardown affordances stay hidden without records', async () => {
    installBridge(() => ({
      ca: null,
      stores: [
        storeState({ state: 'absent' }),
        storeState({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' }),
        storeState({
          store: 'nss-firefox',
          ref: '/Users/dev/profile.default',
          state: 'unavailable',
          detail: 'certutil not found',
        }),
      ],
      changes: [],
    }));
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-store-macos-login-keychain')).toBeTruthy());
    expect(screen.getByText('No certificate authority exists yet', { exact: false })).toBeTruthy();
    expect(screen.getAllByText('Not installed')).toHaveLength(2);
    expect(screen.getByText('Unreadable')).toBeTruthy();
    expect(screen.getByText('default — certutil not found')).toBeTruthy();
    expect(screen.getByTestId('proxy-trust-setup')).toBeTruthy();
    expect(screen.queryByTestId('proxy-trust-remove')).toBeNull();
    expect(screen.queryByTestId('proxy-trust-delete-ca')).toBeNull();
  });

  it('surfaces a fingerprint mismatch as tamper visibility', async () => {
    installBridge(() => ({
      ca: CA,
      stores: [storeState({ state: 'mismatch', detail: 'certificate present with fingerprint ef12…' })],
      changes: [],
    }));
    renderPane();

    await waitFor(() => expect(screen.getByText('A trust store holds a different certificate')).toBeTruthy());
    expect(screen.getByText('Different certificate')).toBeTruthy();
  });

  it('installs nothing before the explicit commit and sends exactly the checked stores', async () => {
    const fake = installBridge(
      () => ({
        ca: null,
        stores: [
          storeState(),
          storeState({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' }),
        ],
        changes: [],
      }),
      { install: () => ({ ok: true, ca: CA, results: [{ store: 'macos-login-keychain', ref: '/k', ok: true }] }) },
    );
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-setup')).toBeTruthy());
    fireEvent.click(screen.getByTestId('proxy-trust-setup'));
    // Explain step: install/enable/remove named before any store choice.
    expect(screen.getByText('What gets installed')).toBeTruthy();
    expect(screen.getByText('What it enables')).toBeTruthy();
    expect(screen.getByText('How it is removed')).toBeTruthy();
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-next'));

    // Never pre-checked; the commit button is inert with nothing picked.
    const login = screen.getByTestId('proxy-trust-opt-macos-login-keychain');
    const system = screen.getByTestId('proxy-trust-opt-macos-system-keychain');
    expect((login as HTMLInputElement).checked).toBe(false);
    expect((system as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('proxy-trust-wizard-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(fake.install).not.toHaveBeenCalled();

    fireEvent.click(login);
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-confirm'));
    await waitFor(() => expect(fake.install).toHaveBeenCalledTimes(1));
    expect(fake.install).toHaveBeenCalledWith({ stores: ['macos-login-keychain'] });
    await waitFor(() => expect(screen.getByText('Trust is installed in every store you picked.')).toBeTruthy());
  });

  it('reports partial failure exactly and never retries around an elevation denial', async () => {
    const fake = installBridge(
      () => ({
        ca: null,
        stores: [
          storeState(),
          storeState({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' }),
        ],
        changes: [],
      }),
      {
        install: () => ({
          ok: true,
          ca: CA,
          results: [
            { store: 'macos-login-keychain', ref: '/k', ok: true },
            {
              store: 'macos-system-keychain',
              ref: '/Library/Keychains/System.keychain',
              ok: false,
              elevationRequired: true,
            },
          ],
        }),
      },
    );
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-setup')).toBeTruthy());
    fireEvent.click(screen.getByTestId('proxy-trust-setup'));
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-next'));
    fireEvent.click(screen.getByTestId('proxy-trust-opt-macos-login-keychain'));
    fireEvent.click(screen.getByTestId('proxy-trust-opt-macos-system-keychain'));
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-confirm'));

    await waitFor(() => expect(screen.getByText('Some stores were left unchanged.', { exact: false })).toBeTruthy());
    expect(screen.getByText('Installed and trusted')).toBeTruthy();
    expect(screen.getByText('Admin approval was declined — the store was left unchanged.')).toBeTruthy();
    expect(fake.install).toHaveBeenCalledTimes(1);
  });

  it('removes over the recorded rows on confirm and keeps honest partial-failure rows visible', async () => {
    const fake = installBridge(
      () => ({
        ca: CA,
        stores: [storeState({ state: 'trusted' })],
        changes: [change()],
      }),
      {
        remove: () => ({
          ok: false,
          results: [
            {
              store: 'macos-login-keychain',
              ref: '/k',
              ok: false,
              error: 'store still trusts the certificate after removal',
            },
          ],
        }),
      },
    );
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-remove')).toBeTruthy());
    expect(screen.getByText('1 recorded install')).toBeTruthy();
    expect(screen.queryByTestId('proxy-trust-delete-ca')).toBeNull();
    fireEvent.click(screen.getByTestId('proxy-trust-remove'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(fake.remove).toHaveBeenCalledTimes(1));
    expect(fake.remove).toHaveBeenCalledWith({});
    await waitFor(() =>
      expect(screen.getAllByText('Some stores could not be verified clean.', { exact: false }).length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getByText('Failed: store still trusts the certificate after removal')).toBeTruthy();
  });

  it('disables the System-keychain option with honest copy on builds without the privileged helper', async () => {
    const fake = installBridge(() => ({
      ca: null,
      stores: [storeState(), storeState({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' })],
      changes: [],
      systemKeychainTrustSupported: false,
    }));
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-setup')).toBeTruthy());
    fireEvent.click(screen.getByTestId('proxy-trust-setup'));
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-next'));

    const system = screen.getByTestId('proxy-trust-opt-macos-system-keychain');
    expect((system as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('proxy-trust-opt-macos-login-keychain') as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText('System-wide trust isn’t available in this build yet', { exact: false })).toBeTruthy();

    // A disabled option can never reach the install call.
    fireEvent.click(system);
    expect((system as HTMLInputElement).checked).toBe(false);
    expect(fake.install).not.toHaveBeenCalled();
  });

  it('renders a residue result as its own actionable outcome, never as "left unchanged"', async () => {
    installBridge(
      () => ({
        ca: null,
        stores: [
          storeState(),
          storeState({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' }),
        ],
        changes: [change({ store: 'macos-system-keychain', ref: '/Library/Keychains/System.keychain' })],
      }),
      {
        install: () => ({
          ok: true,
          ca: CA,
          results: [
            {
              store: 'macos-system-keychain',
              ref: '/Library/Keychains/System.keychain',
              ok: false,
              error: 'trust settings write refused',
              residue: true,
            },
          ],
        }),
      },
    );
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-setup')).toBeTruthy());
    fireEvent.click(screen.getByTestId('proxy-trust-setup'));
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-next'));
    fireEvent.click(screen.getByTestId('proxy-trust-opt-macos-system-keychain'));
    fireEvent.click(screen.getByTestId('proxy-trust-wizard-confirm'));

    await waitFor(() =>
      expect(screen.getByText('The certificate was added but could not be trusted.', { exact: false })).toBeTruthy(),
    );
    expect(screen.queryByText('Admin approval was declined — the store was left unchanged.')).toBeNull();
  });

  it('offers CA deletion only once every recorded row is gone, passing dropCa', async () => {
    const fake = installBridge(() => ({ ca: CA, stores: [storeState()], changes: [] }));
    renderPane();

    await waitFor(() => expect(screen.getByTestId('proxy-trust-delete-ca')).toBeTruthy());
    expect(screen.queryByTestId('proxy-trust-remove')).toBeNull();
    fireEvent.click(screen.getByTestId('proxy-trust-delete-ca'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(fake.remove).toHaveBeenCalledTimes(1));
    expect(fake.remove).toHaveBeenCalledWith({ dropCa: true });
  });
});
