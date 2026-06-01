/**
 * Back-end Switch gate — `useBackendModeSwitch.attemptChange`.
 *
 * Pins the verify-then-switch flow:
 *   - a probe failure HARD-ABORTS — `backend.mode` is NOT committed;
 *   - a probe success commits the new mode after the overlay dwell;
 *   - modes that need no wire (`in-browser`) skip the probe entirely.
 */

import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import {
  __resetRegistryForTests,
  registerCategory,
  registerSetting,
} from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import { act, renderHook } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type { ReactNode } from 'react';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProbe = vi.fn();
vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/backend')>();
  return { ...actual, probeBackendConnection: (...args: unknown[]) => mockProbe(...args) };
});

import { useBackendModeSwitch } from '@openheaders/ui/workbench/settings/components/backend-mode-switch';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

function seedBackendSettings(): void {
  registerCategory({ id: 'backend', label: 'Backend', icon: null, order: 20 });
  registerSetting({
    key: 'backend.mode',
    type: 'enum',
    default: 'in-browser',
    schema: v.picklist(['in-browser', 'desktop-app', 'local-self-hosted', 'remote-self-hosted']),
    label: 'Active back-end',
    description: '',
    category: 'backend',
    scope: 'user',
  });
  registerSetting({
    key: 'backend.url',
    type: 'string',
    default: 'ws://127.0.0.1:59210',
    schema: v.string(),
    label: 'Back-end URL',
    description: '',
    category: 'backend',
    scope: 'user',
  });
  registerSetting({
    key: 'backend.authToken',
    type: 'string',
    default: '',
    schema: v.string(),
    label: 'Auth token',
    description: '',
    category: 'backend',
    scope: 'user',
  });
}

const wrapper = ({ children }: { children: ReactNode }): ReactNode => <AntApp>{children}</AntApp>;

beforeEach(async () => {
  mockProbe.mockReset();
  setCurrentHost('extension');
  __resetStoreForTests();
  __resetRegistryForTests();
  configureSettingsStorage(new NoopDictStorage());
  seedBackendSettings();
  await initSettingsStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBackendModeSwitch.attemptChange', () => {
  it('hard-aborts and does NOT commit when the probe fails', async () => {
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      await result.current.attemptChange('desktop-app');
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(storeGet('backend.mode')).toBe('in-browser');
    expect(result.current.mode).toBe('in-browser');
  });

  it('commits the new mode after the overlay dwell when the probe passes', async () => {
    mockProbe.mockResolvedValue({ ok: true, latencyMs: 5, protocolVersion: 1, role: 'extension', agent: 'x' });
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      const pending = result.current.attemptChange('desktop-app');
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(storeGet('backend.mode')).toBe('desktop-app');
    expect(result.current.mode).toBe('desktop-app');
    expect(result.current.disabled).toBe(false);
  });

  it('skips the probe for a mode with no wire (in-browser)', async () => {
    storeSet('backend.mode', 'desktop-app');
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      const pending = result.current.attemptChange('in-browser');
      await vi.advanceTimersByTimeAsync(1_000);
      await pending;
    });

    expect(mockProbe).not.toHaveBeenCalled();
    expect(storeGet('backend.mode')).toBe('in-browser');
  });

  it('presents the staged URL + auth token to the probe', async () => {
    storeSet('backend.url', 'ws://127.0.0.1:9999');
    storeSet('backend.authToken', 'tok-123');
    mockProbe.mockResolvedValue({ ok: false, reason: 'timeout' });
    const { result } = renderHook(() => useBackendModeSwitch(), { wrapper });

    await act(async () => {
      await result.current.attemptChange('desktop-app');
    });

    expect(mockProbe).toHaveBeenCalledWith(
      'ws://127.0.0.1:9999',
      expect.objectContaining({ authToken: 'tok-123', role: 'extension' }),
    );
  });
});
