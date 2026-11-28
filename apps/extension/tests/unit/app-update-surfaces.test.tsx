// @vitest-environment jsdom
/**
 * The two update surfaces that draw a download's progress — the Settings
 * row and the footer's background task — over `oh.updates.getState` and
 * the `appUpdateState` broadcast.
 *
 * A download reports a percentage or none at all (`progressPercent:
 * null`: a host whose update is fetched by the system). With a number
 * both draw a bar; with none the row shows its busy line and the task
 * goes indeterminate — never a bar standing at zero.
 *
 * And the setting that downloads updates ahead: not offered where an
 * update is downloaded only together with its install.
 *
 * And the button that starts or finishes an update, on the row and in
 * the update dialog: a colour of its own, never the theme's primary —
 * the selected options beside it are the primary's.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/updates';
import { type AppUpdateState, type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import {
  __resetBackgroundTasksForTests,
  useAppUpdateTask,
  useBackgroundTasks,
} from '@openheaders/ui/shared/background-tasks';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { closeUpdateDialog, openUpdateDialog, UPDATE_ACTION_COLOR, UpdateDialog } from '@openheaders/ui/shared/updates';
import AppUpdateRow from '@openheaders/ui/workbench/settings/components/app-update-row';
import { getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as readSetting,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Button, ConfigProvider } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

function makeState(overrides: Partial<AppUpdateState> = {}): AppUpdateState {
  return {
    phase: 'idle',
    currentVersion: '2026.12.0-beta.1',
    availableVersion: null,
    releaseNotesUrl: null,
    progressPercent: null,
    errorMessage: null,
    lastCheckedAt: null,
    lastCheckReason: null,
    severity: null,
    belowSafeFloor: false,
    supported: true,
    installMethod: 'builtin',
    ...overrides,
  };
}

const DOWNLOADING = { phase: 'downloading', availableVersion: '2026.12.0-beta.2' } as const;

function installBridge(initial: AppUpdateState): { emit: (state: AppUpdateState) => void } {
  const listeners = new Set<(payload: unknown) => void>();
  const bridge: HostBridge = {
    async call(type, ..._args) {
      if (type === 'oh.updates.getState') return initial as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe(type, handler) {
      const fn = handler as (payload: unknown) => void;
      if (type === 'appUpdateState') listeners.add(fn);
      return () => listeners.delete(fn);
    },
    presence: () => () => {},
  };
  setHostBridge(bridge);
  return {
    emit: (state) => {
      for (const fn of listeners) fn(state);
    },
  };
}

beforeEach(async () => {
  __resetBackgroundTasksForTests();
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
});

describe('the Settings update row while a download runs', () => {
  function renderRow() {
    const def = getDef('updates.state');
    if (!def) throw new Error('updates.state not registered');
    return render(<AppUpdateRow def={def} />);
  }

  it('draws a bar at the reported percentage', async () => {
    installBridge(makeState({ ...DOWNLOADING, progressPercent: 42 }));
    const { container } = renderRow();

    await screen.findByText('Downloading 2026.12.0-beta.2…');
    expect(container.querySelector('.ant-progress')).not.toBeNull();
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
    expect(container.querySelector('.anticon-sync')).toBeNull();
  });

  it('shows its busy line and no bar when the download reports no progress', async () => {
    installBridge(makeState({ ...DOWNLOADING, progressPercent: null }));
    const { container } = renderRow();

    await screen.findByText('Downloading 2026.12.0-beta.2…', { exact: false });
    expect(container.querySelector('.anticon-sync.anticon-spin')).not.toBeNull();
    expect(container.querySelector('.ant-progress')).toBeNull();
  });

  it('leaves the busy line when the phase moves on', async () => {
    const { emit } = installBridge(makeState({ ...DOWNLOADING, progressPercent: null }));
    const { container } = renderRow();
    await waitFor(() => expect(container.querySelector('.anticon-sync')).not.toBeNull());

    act(() => {
      emit(makeState({ phase: 'downloaded', availableVersion: '2026.12.0-beta.2', progressPercent: 100 }));
    });
    expect(container.querySelector('.anticon-sync')).toBeNull();
    expect(screen.getByText('Restart to install')).toBeTruthy();
  });
});

describe('the button that starts or finishes an update', () => {
  const THEME_PRIMARY = '#1677ff';
  const OFFERED = { availableVersion: '2026.12.0-beta.2' } as const;

  /** The primary a button paints with, as its own theme scope hands it down. */
  function primaryOf(label: string): string {
    const button = screen.getByText(label).closest('button');
    if (!button) throw new Error(`no button reads "${label}"`);
    return getComputedStyle(button).getPropertyValue('--ant-color-primary').toLowerCase();
  }

  function renderInTheme(children: React.ReactNode) {
    return render(
      <ConfigProvider theme={{ token: { colorPrimary: THEME_PRIMARY } }}>
        {children}
        <Button type="primary">A selected state's colour</Button>
      </ConfigProvider>,
    );
  }

  function row(): React.ReactNode {
    const def = getDef('updates.state');
    if (!def) throw new Error('updates.state not registered');
    return <AppUpdateRow def={def} />;
  }

  afterEach(() => {
    closeUpdateDialog();
  });

  it('is not the theme primary on the row, where an update is on offer', async () => {
    installBridge(makeState({ phase: 'available', ...OFFERED }));
    renderInTheme(row());

    await screen.findByText('Update & Restart');
    expect(primaryOf('Update & Restart')).toBe(UPDATE_ACTION_COLOR);
    expect(primaryOf("A selected state's colour")).toBe(THEME_PRIMARY);
  });

  it('is the same colour once the update is downloaded', async () => {
    installBridge(makeState({ phase: 'downloaded', ...OFFERED, progressPercent: 100 }));
    renderInTheme(row());

    await screen.findByText('Restart to install');
    expect(primaryOf('Restart to install')).toBe(UPDATE_ACTION_COLOR);
  });

  it('is the same colour in the update dialog', async () => {
    installBridge(makeState({ phase: 'available', ...OFFERED }));
    renderInTheme(<UpdateDialog onConfigureUpdates={() => {}} />);
    act(() => openUpdateDialog());

    await screen.findByText('Update & Restart');
    expect(primaryOf('Update & Restart')).toBe(UPDATE_ACTION_COLOR);
    // The dialog's other buttons stay the theme's.
    expect(primaryOf('Remind Me Later')).toBe(THEME_PRIMARY);
  });
});

describe('the Updates page', () => {
  it('puts what the app does about updates above what it found', () => {
    const sections = [...(getCategory('updates')?.subcategories ?? [])].sort((a, b) => a.order - b.order);
    expect(sections.map((section) => section.id)).toEqual(['behavior', 'status', 'installation']);
  });
});

describe('the setting that downloads updates ahead', () => {
  afterEach(() => {
    unregisterCapability('updatesOnRequest');
    setCurrentHost('extension');
  });

  it('is offered by the desktop app, and not where an update is downloaded only with its install', () => {
    const def = getDef('updates.autoDownload');
    expect(def?.when?.(readSetting)).toBe(false);
    setCurrentHost('desktop');
    expect(def?.when?.(readSetting)).toBe(true);
    registerCapability('updatesOnRequest', () => true);
    expect(def?.when?.(readSetting)).toBe(false);
    // The rows beside it stay: the check and the channel work as anywhere.
    expect(getDef('updates.check')?.when?.(readSetting)).toBe(true);
    expect(getDef('updates.channel')?.when?.(readSetting)).toBe(true);
  });
});

describe('the update channel while none is chosen', () => {
  afterEach(() => {
    unregisterCapability('updateChannelDefault');
  });

  it('is Stable, and Beta on a build that was released as a beta', () => {
    const def = getDef('updates.channel');
    expect(def?.getDefault?.()).toBe('stable');
    registerCapability('updateChannelDefault', () => 'beta');
    expect(def?.getDefault?.()).toBe('beta');
  });
});

describe('the footer update task while a download runs', () => {
  it('carries the reported percentage', async () => {
    installBridge(makeState({ ...DOWNLOADING, progressPercent: 42 }));
    renderHook(() => useAppUpdateTask());
    const tasks = renderHook(() => useBackgroundTasks());

    await waitFor(() => expect(tasks.result.current).toHaveLength(1));
    expect(tasks.result.current[0]).toMatchObject({ title: 'Downloading 2026.12.0-beta.2', percent: 42 });
  });

  it('is indeterminate when the download reports no progress', async () => {
    installBridge(makeState({ ...DOWNLOADING, progressPercent: null }));
    renderHook(() => useAppUpdateTask());
    const tasks = renderHook(() => useBackgroundTasks());

    await waitFor(() => expect(tasks.result.current).toHaveLength(1));
    expect(tasks.result.current[0]).toMatchObject({ title: 'Downloading 2026.12.0-beta.2', percent: null });
  });

  it('goes when the download ends', async () => {
    const { emit } = installBridge(makeState({ ...DOWNLOADING, progressPercent: null }));
    renderHook(() => useAppUpdateTask());
    const tasks = renderHook(() => useBackgroundTasks());
    await waitFor(() => expect(tasks.result.current).toHaveLength(1));

    act(() => {
      emit(makeState({ phase: 'downloaded', availableVersion: '2026.12.0-beta.2', progressPercent: 100 }));
    });
    expect(tasks.result.current).toHaveLength(0);
  });
});
