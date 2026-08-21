import type { AppUpdateState } from '@openheaders/core/bridge';
import { describe, expect, it, vi } from 'vitest';
import { registerUpdateMenuBuilder, updateMenuItems, updateMenusOnState } from '@/main/bootstrap/update-menus';

vi.mock('@/main/electron-updater-port', () => ({
  updateCapability: () => 'self',
}));
vi.mock('@/main/bootstrap/window-manager', () => ({
  showMainWindow: vi.fn(),
}));

function makeState(overrides: Partial<AppUpdateState> = {}): AppUpdateState {
  return {
    phase: 'idle',
    currentVersion: '2026.7.1',
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

function labels(): Array<string | undefined> {
  return updateMenuItems().map((item) => item.label);
}

describe('updateMenuItems labels', () => {
  it('byte-matches the shipped strings across every updater phase', () => {
    expect(labels()).toEqual(['Check for Updates…']);

    updateMenusOnState(makeState({ phase: 'checking' }));
    expect(labels()).toEqual(['Checking for Updates…']);

    updateMenusOnState(makeState({ phase: 'available', availableVersion: '2026.8.1' }));
    expect(labels()).toEqual(['Update to 2026.8.1 & Restart']);

    updateMenusOnState(makeState({ phase: 'downloading', availableVersion: '2026.8.1', progressPercent: 42 }));
    expect(labels()).toEqual(['Downloading Update… 42%']);

    updateMenusOnState(makeState({ phase: 'downloading', availableVersion: '2026.8.1' }));
    expect(labels()).toEqual(['Downloading Update…']);

    updateMenusOnState(makeState({ phase: 'downloaded', availableVersion: '2026.8.1' }));
    expect(labels()).toEqual(['Restart to Install 2026.8.1']);

    updateMenusOnState(makeState({ phase: 'error' }));
    expect(labels()).toEqual(['Check for Updates…']);
  });

  it('package-manager installs announce the version instead of Update & Restart', () => {
    updateMenusOnState(
      makeState({
        phase: 'available',
        availableVersion: '2026.8.1',
        releaseNotesUrl: 'https://github.com/OpenHeaders/open-headers/releases/tag/v2026.8.1',
        installMethod: 'packageManager',
      }),
    );
    expect(labels()).toEqual(['Version 2026.8.1 Available…']);
    expect(updateMenuItems()[0]?.enabled).toBe(true);
    updateMenusOnState(makeState());
  });

  it('re-runs every registered menu builder on a state transition', () => {
    const rebuild = vi.fn();
    registerUpdateMenuBuilder(rebuild);
    updateMenusOnState(makeState({ phase: 'checking' }));
    expect(rebuild).toHaveBeenCalledTimes(1);
    updateMenusOnState(makeState());
  });
});
