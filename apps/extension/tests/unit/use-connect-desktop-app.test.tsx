/**
 * "Connect desktop app" — `useConnectDesktopApp`, the Sync page's
 * one-click verb.
 *
 * Pins the three outcomes over the `OH.backends` registry:
 *   - a granted native-messaging handoff writes the token onto the fresh
 *     loopback record and hands it to the probe-gated enable — no wizard;
 *   - a refused handoff opens the wizard on that record with the
 *     fallback flagged, the record still disabled and unpaired;
 *   - a host without the NM plane opens the wizard directly.
 */

import { __clearBackendsForTests, getBackends, refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import type { BackendConnection } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { BackendWizardTarget } from '@openheaders/ui/workbench/settings/components/backend-wizard';
import type { BackendEnableSwitchHandle } from '@openheaders/ui/workbench/settings/components/use-backend-enable-switch';
import { useConnectDesktopApp } from '@openheaders/ui/workbench/settings/components/use-connect-desktop-app';
import { act, renderHook } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

function createEnableSwitchStub(): BackendEnableSwitchHandle & { setEnabled: ReturnType<typeof vi.fn> } {
  return {
    setEnabled: vi.fn(async (_record: BackendConnection, _next: boolean) => true),
    busy: false,
    overlayElement: null,
  };
}

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <AntApp>{children}</AntApp>;

function renderConnect(enableSwitch: BackendEnableSwitchHandle) {
  const openWizard = vi.fn<(target: BackendWizardTarget) => void>();
  const hook = renderHook(() => useConnectDesktopApp(enableSwitch, openWizard), { wrapper });
  return { hook, openWizard };
}

beforeEach(async () => {
  setCurrentHost('extension');
  setHostStorage(createHostStorageFake());
  __clearBackendsForTests();
  await refreshBackendsFromHostStorage();
});

afterEach(() => {
  unregisterCapability('nmAutoPair');
});

describe('useConnectDesktopApp', () => {
  it('a granted handoff pairs the fresh loopback record and hands it to the enable gate, no wizard', async () => {
    registerCapability('nmAutoPair', async () => ({ ok: true, token: 'nm-tok', browser: 'chrome' }));
    const enableSwitch = createEnableSwitchStub();
    const { hook, openWizard } = renderConnect(enableSwitch);

    await act(async () => {
      await hook.result.current.connect();
    });

    const [record] = getBackends();
    expect(record.url).toBe('ws://127.0.0.1:8137');
    expect(record.authToken).toBe('nm-tok');
    expect(enableSwitch.setEnabled).toHaveBeenCalledWith(expect.objectContaining({ id: record.id }), true);
    expect(openWizard).not.toHaveBeenCalled();
  });

  it('a refused handoff opens the wizard on the unpaired record with the fallback flagged', async () => {
    registerCapability('nmAutoPair', async () => ({ ok: false, reason: 'refused' }));
    const enableSwitch = createEnableSwitchStub();
    const { hook, openWizard } = renderConnect(enableSwitch);

    await act(async () => {
      await hook.result.current.connect();
    });

    const [record] = getBackends();
    expect(record.authToken).toBe('');
    expect(record.enabled).toBe(false);
    expect(openWizard).toHaveBeenCalledWith({
      recordId: record.id,
      mode: 'add',
      kind: 'desktop-app',
      autoPairFailed: true,
    });
    expect(enableSwitch.setEnabled).not.toHaveBeenCalled();
  });

  it('a host without the NM plane opens the wizard directly', async () => {
    const enableSwitch = createEnableSwitchStub();
    const { hook, openWizard } = renderConnect(enableSwitch);

    await act(async () => {
      await hook.result.current.connect();
    });

    const [record] = getBackends();
    expect(openWizard).toHaveBeenCalledWith({ recordId: record.id, mode: 'add', kind: 'desktop-app' });
    expect(enableSwitch.setEnabled).not.toHaveBeenCalled();
  });
});
