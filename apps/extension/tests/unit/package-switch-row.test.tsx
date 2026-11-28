// @vitest-environment jsdom
/**
 * A classic Windows install switching to the Windows package, on
 * Settings › Application › Updates — over the `packageSwitch` capability
 * only that install registers.
 *
 * The row — and with it the page's last section — shows only where the
 * capability is. It names the install type and offers the switch; where
 * the host says a switch may not begin, the button is off and one line
 * says why. The button opens one dialog; its Switch starts the installer,
 * and the row then only says it is at work. A switch that stops leaves one
 * line, chosen by what the installer's exit code means to a person.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/updates';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  type HostBridge,
  type PackageSwitchBlocker,
  type PackageSwitchState,
  setHostBridge,
} from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { en } from '@openheaders/i18n';
import { packageSwitchStopKey } from '@openheaders/ui/workbench/settings/components/package-switch-lines';
import PackageSwitchRow from '@openheaders/ui/workbench/settings/components/package-switch-row';
import { getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as readSetting,
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

const OFFERED_VERSION = '2026.11.3-beta.12';
const PACKAGE_DIR = 'C:\\Users\\John Doe\\AppData\\Local\\OpenHeaders-Data';

const THIS_PC = 'This PC can’t install the Windows package.';
const DOWNLOAD = 'The package couldn’t be downloaded. Nothing was changed.';
const INSTALL = 'Windows couldn’t install the package. Nothing was changed.';
const PACKAGE_START = 'The Windows package didn’t start. Nothing was changed.';
const APP_STAYED = 'The app didn’t close in time. Nothing was changed.';
const OTHER = 'The switch stopped. Nothing was changed.';
const FEED_UNREAD = 'Couldn’t check for the Windows package.';
const WORKING_LINE = 'Switching. Follow the Open Headers Installer window.';

type Idle = Extract<PackageSwitchState, { phase: 'idle' }>;

function idle(overrides: Partial<Idle> = {}): Idle {
  return {
    phase: 'idle',
    verdict: { eligible: true, version: OFFERED_VERSION },
    channel: 'beta',
    offeredVersion: OFFERED_VERSION,
    packageDataDir: PACKAGE_DIR,
    lastStop: null,
    ...overrides,
  };
}

function blocked(blocker: PackageSwitchBlocker, overrides: Partial<Idle> = {}): Idle {
  return idle({ verdict: { eligible: false, blocker }, ...overrides });
}

type Ask = () => Promise<PackageSwitchState>;

function registerSwitch(
  read: Ask = async () => idle(),
  start: Ask = async () => ({ phase: 'working' }),
): { read: ReturnType<typeof vi.fn<Ask>>; start: ReturnType<typeof vi.fn<Ask>> } {
  const asks = { read: vi.fn<Ask>(read), start: vi.fn<Ask>(start) };
  registerCapability('packageSwitch', () => asks);
  return asks;
}

/** A bridge that only carries the plane's broadcast to the row. */
function installBridge(): { emit: (state: PackageSwitchState) => void } {
  const listeners = new Set<(payload: unknown) => void>();
  const bridge: HostBridge = {
    async call(type, ..._args) {
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe(type, handler) {
      const fn = handler as (payload: unknown) => void;
      if (type === 'packageSwitchState') listeners.add(fn);
      return () => listeners.delete(fn);
    },
    presence: () => () => {},
  };
  setHostBridge(bridge);
  return {
    emit: (state) => {
      act(() => {
        for (const fn of listeners) fn(state);
      });
    },
  };
}

function renderRow(): void {
  const def = getDef('updates.installType');
  if (!def) throw new Error('updates.installType not registered');
  render(<PackageSwitchRow def={def} />);
}

function openButton(): HTMLButtonElement {
  return screen.getByTestId('package-switch-open') as HTMLButtonElement;
}

async function openDialog(): Promise<void> {
  await waitFor(() => expect(openButton().disabled).toBe(false));
  fireEvent.click(openButton());
  await screen.findByTestId('package-switch-confirm');
}

/**
 * jsdom never fires motion events, so `destroyOnHidden` cannot unmount a
 * dismissed dialog here — closed shows as its leave classes.
 */
async function dialogClosed(): Promise<void> {
  await waitFor(() => expect(document.querySelector('.ant-modal')?.className).toMatch(/-leave/));
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

let bridge: ReturnType<typeof installBridge>;

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
  bridge = installBridge();
});

afterEach(() => {
  cleanup();
  unregisterCapability('packageSwitch');
  __resetStoreForTests();
});

describe('the switch to the Windows package, on the Updates page', () => {
  it('is the last section of the page, and its row is gated on the capability alone', () => {
    const sections = [...(getCategory('updates')?.subcategories ?? [])].sort((a, b) => a.order - b.order);
    expect(sections.map((section) => section.id)).toEqual(['behavior', 'status', 'installation']);

    const def = getDef('updates.installType');
    expect(def?.subcategory).toBe('installation');
    expect(def?.when?.(readSetting)).toBe(false);
    registerSwitch();
    expect(def?.when?.(readSetting)).toBe(true);
  });

  it('names the install type and offers no switch while the host is read', async () => {
    let answer: (state: PackageSwitchState) => void = () => {};
    registerSwitch(
      () =>
        new Promise<PackageSwitchState>((resolve) => {
          answer = resolve;
        }),
    );
    renderRow();

    expect(await screen.findByText('Install type', { exact: false })).toBeTruthy();
    expect(screen.getByTestId('package-switch-value').textContent).toBe('Classic installer');
    expect(openButton().textContent).toBe('Switch to the Windows package…');
    expect(openButton().disabled).toBe(true);
    expect(screen.getByTestId('package-switch-checking').textContent).toBe('Checking…');

    await act(async () => answer(idle()));
    await waitFor(() => expect(openButton().disabled).toBe(false));
    expect(screen.queryByTestId('package-switch-checking')).toBeNull();
    expect(screen.queryByTestId('package-switch-reason')).toBeNull();
    expect(screen.queryByTestId('package-switch-stopped')).toBeNull();
  });

  it('starts nothing on the first press: the dialog says what happens and what is kept', async () => {
    const { start } = registerSwitch();
    renderRow();
    await openDialog();

    expect(screen.getByText('Switch to the Windows package?')).toBeTruthy();
    expect(
      screen.getByText(
        `Installs version ${OFFERED_VERSION} as a Windows package and removes this install. The app closes and opens again.`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Kept: your workspaces, settings and stored secrets. To redo: a taskbar pin, and an MCP client command you pasted.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('package-switch-confirm').textContent).toBe('Switch');
    expect(screen.getByTestId('package-switch-confirm').className).not.toContain('ant-btn-dangerous');
    expect(start).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('package-switch-cancel'));
    await dialogClosed();
    expect(start).not.toHaveBeenCalled();
  });

  it('starts on the second press, closes the dialog and says the installer is at work', async () => {
    const { start } = registerSwitch();
    renderRow();
    await openDialog();

    fireEvent.click(screen.getByTestId('package-switch-confirm'));
    await waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect((await screen.findByTestId('package-switch-working')).textContent).toBe(WORKING_LINE);
    await dialogClosed();
    expect(openButton().disabled).toBe(true);
    expect(document.querySelector('.ant-progress')).toBeNull();
  });

  it.each<[PackageSwitchBlocker, string]>([
    ['windows-too-old', 'The Windows package needs Windows 10 version 2004 or later.'],
    ['no-installer', 'This copy of the app can’t make the switch.'],
    ['data-folder-elsewhere', 'This copy of the app can’t make the switch.'],
    ['data-folder-not-plain', 'Your data folder is a link or on another drive, and can’t be handed over.'],
    ['data-on-another-volume', 'Your data folder is a link or on another drive, and can’t be handed over.'],
    ['package-installed', 'The Windows package is already installed. Uninstall it in Windows Settings first.'],
    ['package-data-left', `An earlier Windows package left data in ${PACKAGE_DIR}. Move or delete that folder first.`],
    ['feed-unread', FEED_UNREAD],
    ['no-package-offered', 'The Beta channel has no Windows package yet.'],
    ['held-back', 'The Windows package is held back right now.'],
    ['package-older', `The Windows package on the Beta channel (${OFFERED_VERSION}) is older than this app.`],
  ])('keeps the button off and says why on %s', async (blocker, sentence) => {
    registerSwitch(async () => blocked(blocker));
    renderRow();

    expect((await screen.findByTestId('package-switch-reason')).textContent).toBe(sentence);
    expect(openButton().disabled).toBe(true);
    expect(screen.queryByTestId('package-switch-retry') !== null).toBe(blocker === 'feed-unread');
  });

  it('names the channel the verdict was read on', async () => {
    registerSwitch(async () => blocked('no-package-offered', { channel: 'stable', offeredVersion: null }));
    renderRow();
    expect((await screen.findByTestId('package-switch-reason')).textContent).toBe(
      'The Stable channel has no Windows package yet.',
    );
  });

  it('reads again on Retry when the feed could not be read', async () => {
    const { read } = registerSwitch();
    read.mockResolvedValueOnce(blocked('feed-unread', { offeredVersion: null }));
    renderRow();

    fireEvent.click(await screen.findByTestId('package-switch-retry'));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(openButton().disabled).toBe(false));
    expect(screen.queryByTestId('package-switch-reason')).toBeNull();
  });

  it('says a host that does not answer as a check that failed, with Retry', async () => {
    const { read } = registerSwitch();
    read.mockRejectedValueOnce(new Error('bridge closed'));
    renderRow();

    expect((await screen.findByTestId('package-switch-reason')).textContent).toBe(FEED_UNREAD);
    expect(openButton().disabled).toBe(true);
    fireEvent.click(screen.getByTestId('package-switch-retry'));
    await waitFor(() => expect(openButton().disabled).toBe(false));
  });

  it('closes the dialog and says why when the host finds at the click that no switch may begin', async () => {
    registerSwitch(undefined, async () => blocked('package-installed'));
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('package-switch-confirm'));

    expect((await screen.findByTestId('package-switch-reason')).textContent).toBe(
      'The Windows package is already installed. Uninstall it in Windows Settings first.',
    );
    await dialogClosed();
    expect(screen.queryByTestId('package-switch-working')).toBeNull();
  });

  it('says a start the host did not answer as a switch that stopped', async () => {
    registerSwitch(undefined, async () => {
      throw new Error('bridge closed');
    });
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('package-switch-confirm'));

    expect((await screen.findByTestId('package-switch-stopped')).textContent).toBe(OTHER);
    await dialogClosed();
    expect(openButton().disabled).toBe(false);
  });

  it('follows a switch another window started', async () => {
    registerSwitch();
    renderRow();
    await waitFor(() => expect(openButton().disabled).toBe(false));

    bridge.emit({ phase: 'working' });
    expect(screen.getByTestId('package-switch-working').textContent).toBe(WORKING_LINE);
    expect(openButton().disabled).toBe(true);
  });

  it.each<[number | null, string | null]>([
    [10, THIS_PC],
    [11, THIS_PC],
    [12, THIS_PC],
    [20, DOWNLOAD],
    [21, DOWNLOAD],
    [22, DOWNLOAD],
    [23, DOWNLOAD],
    [30, INSTALL],
    [32, PACKAGE_START],
    [33, APP_STAYED],
    [1, OTHER],
    [null, OTHER],
    [35, null],
    [40, null],
  ])('says a switch that stopped with %s in one line, and offers the switch again', async (code, sentence) => {
    registerSwitch(async () => ({ phase: 'working' }));
    renderRow();
    await screen.findByTestId('package-switch-working');

    bridge.emit(idle({ lastStop: { code } }));
    expect(screen.queryByTestId('package-switch-working')).toBeNull();
    expect(screen.queryByTestId('package-switch-stopped')?.textContent ?? null).toBe(sentence);
    expect(openButton().disabled).toBe(false);
  });

  it('says a package that is there already as the reason, with no line of its own', async () => {
    registerSwitch(async () => ({ phase: 'working' }));
    renderRow();
    await screen.findByTestId('package-switch-working');

    bridge.emit(blocked('package-installed', { lastStop: { code: 35 } }));
    expect(screen.queryByTestId('package-switch-stopped')).toBeNull();
    expect(screen.getByTestId('package-switch-reason').textContent).toBe(
      'The Windows package is already installed. Uninstall it in Windows Settings first.',
    );
  });
});

describe("the line for a switch that stopped, held to the installer's own codes", () => {
  const OUTCOME_SOURCE = path.resolve(__dirname, '../../../../native/windows-installer/src/outcome.rs');

  /** Every `Failure` the installer can end with, and the exit code it gives. */
  function installerExitCodes(): Map<string, number> {
    const source = readFileSync(OUTCOME_SOURCE, 'utf8');
    const arms = /pub fn exit_code\(self\) -> i32 \{([\s\S]*?)\n {4}\}/.exec(source)?.[1] ?? '';
    const codes = new Map<string, number>();
    for (const [, failures, code] of arms.matchAll(/((?:Failure::\w+[\s|]*)+)=>\s*(\d+)/g)) {
      for (const [, name] of failures.matchAll(/Failure::(\w+)/g)) codes.set(name, Number(code));
    }
    return codes;
  }

  /** What a person is told for each: null where the row says nothing. */
  const LINE_BY_FAILURE: Record<string, string | null> = {
    Unexpected: OTHER,
    BadSwitches: OTHER,
    WindowsTooOld: THIS_PC,
    SMode: THIS_PC,
    PolicyBlocks: THIS_PC,
    Pointer: DOWNLOAD,
    NothingPublished: DOWNLOAD,
    HeldBack: DOWNLOAD,
    Download: DOWNLOAD,
    Hash: DOWNLOAD,
    Signature: DOWNLOAD,
    WindowsRefused: INSTALL,
    NotOpened: OTHER,
    PackageCheck: PACKAGE_START,
    AppStayed: APP_STAYED,
    ClassicRemains: OTHER,
    PackagePresent: null,
    Cancelled: null,
  };

  it('has a line, or a reason to say none, for every way the installer ends', () => {
    const codes = installerExitCodes();
    expect([...codes.keys()].sort()).toEqual(Object.keys(LINE_BY_FAILURE).sort());
    for (const [failure, code] of codes) {
      const key = packageSwitchStopKey(code);
      expect(key === null ? null : en[key], `${failure} (${code})`).toBe(LINE_BY_FAILURE[failure]);
    }
  });

  it('says an installer that ended without a code as a switch that stopped', () => {
    const key = packageSwitchStopKey(null);
    expect(key === null ? null : en[key]).toBe(OTHER);
  });
});
