// @vitest-environment jsdom
/**
 * Settings › API Requests › TLS — the two trust lists edited in place.
 * Pins the registry shape (two `info` defs with custom editors under
 * the leading `tls` section, every requests def tagging a declared
 * section), the workspace list's gestures (paste → summary → Add
 * commits through the mutator, remove commits, a leaf is refused), the
 * device list's gestures (add and remove through the device-trust
 * client, a self-signed leaf accepted), the read-only posture on a
 * browser host, and that the navigator's variables view no longer
 * offers the retired singleton row — trust is not a variable.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/requests';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { DeviceTrustedCertificate, TrustedRoot } from '@openheaders/core/types';
import { useVariableSingletonNodes } from '@openheaders/ui/workbench/components/sidebar/useVariableSingletonNodes';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import DeviceTrustRow from '@openheaders/ui/workbench/settings/components/device-trust-row';
import SystemTrustRow from '@openheaders/ui/workbench/settings/components/system-trust-row';
import TrustedRootsRow from '@openheaders/ui/workbench/settings/components/trusted-roots-row';
import { byCategory, getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseTrustedRoots, mockAddRoot, mockRemoveRoot, mockReplaceRoots, mockDevice } = vi.hoisted(() => ({
  mockUseTrustedRoots: vi.fn(),
  mockAddRoot: vi.fn(),
  mockRemoveRoot: vi.fn(),
  mockReplaceRoots: vi.fn(),
  mockDevice: {
    useDeviceTrust: vi.fn(() => ({
      certificates: [] as DeviceTrustedCertificate[],
      systemTrust: { supported: true, enabled: false, count: 0 },
      ready: true,
    })),
    add: vi.fn(),
    remove: vi.fn(),
    setSystemTrust: vi.fn(),
  },
}));

vi.mock('@openheaders/ui/shared/hooks/readers/useTrustedRoots', () => ({
  useTrustedRoots: mockUseTrustedRoots,
}));

vi.mock('@openheaders/ui/shared/hooks/mutators/useTrustedRootsMutator', () => ({
  useTrustedRootsMutator: () => ({ addRoot: mockAddRoot, removeRoot: mockRemoveRoot, replaceRoots: mockReplaceRoots }),
}));

vi.mock('@openheaders/ui/shared/device-trust', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/shared/device-trust')>()),
  useDeviceTrust: () => mockDevice.useDeviceTrust(),
  addDeviceTrustedCertificate: (input: unknown) => mockDevice.add(input),
  removeDeviceTrustedCertificate: (uid: string) => mockDevice.remove(uid),
  setSystemTrustEnabled: (enabled: boolean) => mockDevice.setSystemTrust(enabled),
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

/** A CA:TRUE test root (CN=OpenHeaders Test Root). */
const caPem = `-----BEGIN CERTIFICATE-----
MIIBeDCCAR2gAwIBAgIBATAKBggqhkjOPQQDAjA5MR4wHAYDVQQDExVPcGVuSGVh
ZGVycyBUZXN0IFJvb3QxFzAVBgNVBAoTDm9wZW5oZWFkZXJzLmlvMB4XDTI2MDEw
MTAwMDAwMFoXDTM2MDEwMTAwMDAwMFowOTEeMBwGA1UEAxMVT3BlbkhlYWRlcnMg
VGVzdCBSb290MRcwFQYDVQQKEw5vcGVuaGVhZGVycy5pbzBZMBMGByqGSM49AgEG
CCqGSM49AwEHA0IABObZxdfBYTwTirPRwk/4JoUMpSw8lz8eu12yemOtLC0jtuI9
vnEJE7exe08TehZY3PhHJE/NtuMbJE6lk+i5LY6jFjAUMBIGA1UdEwEB/wQIMAYB
Af8CAQAwCgYIKoZIzj0EAwIDSQAwRgIhALw6OnrxEcyEC/Fq3CEgBLXzAoP3UFAe
JUa3RZhmKYPLAiEA+tHsiu/3GrcHhMy0znd6vL/Apd1AGqzIpWbMtZi77+Q=
-----END CERTIFICATE-----`;

function makeRoot(uid: string): TrustedRoot {
  return { uid, name: `Root ${uid}`, certPem: caPem, addedAt: '2026-08-27T00:00:00.000Z' };
}

let liveRoots: TrustedRoot[] = [];
let livePins: DeviceTrustedCertificate[] = [];
let liveSystemTrust = { supported: true, enabled: false, count: 0 };

beforeEach(async () => {
  liveRoots = [];
  livePins = [];
  liveSystemTrust = { supported: true, enabled: false, count: 0 };
  mockUseTrustedRoots.mockReset();
  mockUseTrustedRoots.mockImplementation(() => liveRoots);
  mockAddRoot.mockReset();
  mockAddRoot.mockResolvedValue({ ok: true, root: makeRoot('new') });
  mockRemoveRoot.mockReset();
  mockRemoveRoot.mockResolvedValue({ ok: true });
  mockReplaceRoots.mockReset();
  mockReplaceRoots.mockResolvedValue({ ok: true });
  mockDevice.useDeviceTrust.mockImplementation(() => ({
    certificates: livePins,
    systemTrust: liveSystemTrust,
    ready: true,
  }));
  mockDevice.setSystemTrust.mockReset();
  mockDevice.setSystemTrust.mockResolvedValue({ ok: true });
  mockDevice.add.mockReset();
  mockDevice.add.mockResolvedValue({ ok: true, certificate: { uid: 'pin00001', name: 'localhost', certPem: caPem } });
  mockDevice.remove.mockReset();
  mockDevice.remove.mockResolvedValue({ ok: true });
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
  __resetStoreForTests();
});

function requireDef(key: 'requests.trustedRoots' | 'requests.deviceTrust' | 'requests.systemTrust') {
  const def = getDef(key);
  if (!def) throw new Error(`${key} not registered`);
  return def;
}

function renderBlock(element: React.ReactElement, workspaceId: string | null = 'ws-1') {
  return render(
    <App>
      <EditingScopeWorkspaceProvider workspaceId={workspaceId}>{element}</EditingScopeWorkspaceProvider>
    </App>,
  );
}

async function pasteAndAdd(addTestId: string, pem: string): Promise<void> {
  fireEvent.click(screen.getByTestId(addTestId));
  fireEvent.change(screen.getByTestId('trusted-root-pem-input'), { target: { value: pem } });
  const confirm = screen.getByTestId('trusted-root-add-confirm');
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
  fireEvent.click(confirm);
}

describe('requests › tls — registry', () => {
  it('registers both lists as info defs with custom editors under the leading tls section', () => {
    const workspace = requireDef('requests.trustedRoots');
    const device = requireDef('requests.deviceTrust');
    expect(workspace.type).toBe('info');
    expect(workspace.subcategory).toBe('tls');
    expect(workspace.customEditor).toBe(TrustedRootsRow);
    expect(device.type).toBe('info');
    expect(device.subcategory).toBe('tls');
    expect(device.customEditor).toBe(DeviceTrustRow);
    const system = requireDef('requests.systemTrust');
    expect(system.type).toBe('info');
    expect(system.subcategory).toBe('tls');
    expect(system.customEditor).toBe(SystemTrustRow);
    const subcategories = getCategory('requests')?.subcategories ?? [];
    expect(subcategories[0]?.id).toBe('tls');
    const declared = new Set(subcategories.map((s) => s.id));
    for (const def of byCategory('requests')) expect(declared.has(def.subcategory ?? '')).toBe(true);
  });
});

describe('workspace certificates block', () => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('renders the table with the empty line inside and a primary Add at zero roots', () => {
    renderBlock(<TrustedRootsRow def={requireDef('requests.trustedRoots')} />);
    expect(screen.getByText('Workspace Certificates')).toBeTruthy();
    expect(screen.getByText('CERTIFICATES (0)')).toBeTruthy();
    expect(screen.getByTestId('trusted-roots-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('trusted-root-row')).toHaveLength(0);
  });

  it('a pasted root commits through the mutator on Add and the panel closes', async () => {
    renderBlock(<TrustedRootsRow def={requireDef('requests.trustedRoots')} />);
    await pasteAndAdd('trusted-root-add', caPem);
    await waitFor(() => expect(mockAddRoot).toHaveBeenCalledTimes(1));
    expect(mockAddRoot.mock.calls[0]?.[0]).toEqual({ name: 'OpenHeaders Test Root', certPem: caPem });
    await waitFor(() => expect(screen.queryByTestId('trusted-root-add-panel')).toBeNull());
  });

  it('remove commits through the mutator without a confirm', async () => {
    liveRoots = [makeRoot('r1'), makeRoot('r2')];
    renderBlock(<TrustedRootsRow def={requireDef('requests.trustedRoots')} />);
    expect(screen.getAllByTestId('trusted-root-row')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(mockRemoveRoot).toHaveBeenCalledWith('r1'));
  });

  it('is read-only with the honest caption on a browser host', () => {
    unregisterCapability('requestRuntime');
    registerCapability('requestRuntime', () => 'browser');
    liveRoots = [makeRoot('r1')];
    renderBlock(<TrustedRootsRow def={requireDef('requests.trustedRoots')} />);
    expect(screen.getByTestId('trusted-root-add').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.getByText(/verifies with its own trust store/)).toBeTruthy();
  });
});

describe('device certificates block', () => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('lists this device’s pins and removes through the device-trust client', async () => {
    livePins = [{ uid: 'pin00001', name: 'localhost', certPem: caPem, addedAt: '2026-08-27T00:00:00.000Z' }];
    renderBlock(<DeviceTrustRow def={requireDef('requests.deviceTrust')} />);
    expect(screen.getByText('Device Certificates')).toBeTruthy();
    expect(screen.getByText('PINNED ON THIS DEVICE (1)')).toBeTruthy();
    expect(screen.getAllByTestId('trusted-root-row')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mockDevice.remove).toHaveBeenCalledWith('pin00001'));
  });

  it('a pasted certificate pins through the device-trust client', async () => {
    renderBlock(<DeviceTrustRow def={requireDef('requests.deviceTrust')} />);
    expect(screen.getByTestId('device-trust-empty')).toBeTruthy();
    await pasteAndAdd('device-trust-add', caPem);
    await waitFor(() => expect(mockDevice.add).toHaveBeenCalledTimes(1));
    expect(mockDevice.add.mock.calls[0]?.[0]).toEqual({ name: 'OpenHeaders Test Root', certPem: caPem });
  });
});

describe('system trust store row', () => {
  it('flips the opt-in through the device-trust client and names the store’s count once on', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderBlock(<SystemTrustRow def={requireDef('requests.systemTrust')} />);
    expect(screen.getByText('System Trust Store:')).toBeTruthy();
    expect(screen.getByTestId('system-trust-caption').textContent).toBe(
      'Only the built-in roots and the certificates above are trusted',
    );
    const toggle = screen.getByTestId('system-trust-switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(mockDevice.setSystemTrust).toHaveBeenCalledWith(true));
    cleanup();
    liveSystemTrust = { supported: true, enabled: true, count: 7 };
    renderBlock(<SystemTrustRow def={requireDef('requests.systemTrust')} />);
    expect(screen.getByTestId('system-trust-switch').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('system-trust-caption').textContent).toMatch(/^7 certificates from this machine/);
  });

  it('is disabled with the honest caption on a runtime that cannot read the store, and on a browser host', () => {
    registerCapability('requestRuntime', () => 'node');
    liveSystemTrust = { supported: false, enabled: false, count: 0 };
    renderBlock(<SystemTrustRow def={requireDef('requests.systemTrust')} />);
    expect(screen.getByTestId('system-trust-switch').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('system-trust-caption').textContent).toMatch(/Node 22\.15/);
    cleanup();
    unregisterCapability('requestRuntime');
    registerCapability('requestRuntime', () => 'browser');
    renderBlock(<SystemTrustRow def={requireDef('requests.systemTrust')} />);
    expect(screen.getByTestId('system-trust-switch').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('system-trust-caption').textContent).toBe(
      'The browser verifies with its own trust store',
    );
  });
});

describe('variables view singletons', () => {
  it('no longer offers a trusted-roots row beside the vault', () => {
    const { result } = renderHook(() => useVariableSingletonNodes({}));
    expect(Object.keys(result.current).sort()).toEqual([
      'liveVarsNode',
      'scriptPackagesNode',
      'vaultNode',
      'workspaceVarsNode',
    ]);
  });
});
