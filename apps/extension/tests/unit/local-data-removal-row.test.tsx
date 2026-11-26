// @vitest-environment jsdom
/**
 * The removal of a Windows package's own data and capture trust, on
 * Settings › Application › Data — over the `removeLocalData` capability
 * only a Windows package registers.
 *
 * The row — and with it the page's last section — shows only where the
 * capability is. Two steps and no typed word: the row's button opens a dialog that says what
 * goes and what stays, and the dialog's danger button runs the removal. A
 * trust store that kept the certificate is listed with two answers; an
 * app alias switched off is said on the row, which then offers no run.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/data';
import type { LocalDataRemovalResult } from '@openheaders/core/bridge';
import { type PackageAliases, registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import LocalDataRemovalRow from '@openheaders/ui/workbench/settings/components/local-data-removal-row';
import { getCategory, getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as readSetting,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
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

const APP_ALIAS_NAME = 'OpenHeaders';
const ALIAS_SENTENCE = `The removal needs the “${APP_ALIAS_NAME}” alias turned on in Windows.`;
const FIREFOX_PROFILE = 'C:\\Users\\John Doe\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\ab12cd34.default-release';
const REFUSED: LocalDataRemovalResult = {
  outcome: 'trust-refused',
  stores: [{ store: 'nss-firefox', ref: FIREFOX_PROFILE, error: 'the profile is in use' }],
};

type Removal = (options: { readonly force: boolean }) => Promise<LocalDataRemovalResult>;

function registerRemoval(answer: Removal = async () => ({ outcome: 'restarting' })): ReturnType<typeof vi.fn<Removal>> {
  const remove = vi.fn<Removal>(answer);
  registerCapability('removeLocalData', remove);
  return remove;
}

function registerAppAlias(on: boolean): ReturnType<typeof vi.fn> {
  const openSettings = vi.fn();
  const aliases: PackageAliases = {
    read: async () => ({
      app: { on, name: APP_ALIAS_NAME },
      helper: { on: true, name: 'OpenHeaders browser helper' },
    }),
    openSettings,
  };
  registerCapability('packageAliases', () => aliases);
  return openSettings;
}

function renderRow(): void {
  const def = getDef('data.removeLocalData');
  if (!def) throw new Error('data.removeLocalData not registered');
  render(
    <AntApp>
      <LocalDataRemovalRow def={def} />
    </AntApp>,
  );
}

async function openDialog(): Promise<void> {
  fireEvent.click(await screen.findByTestId('local-data-remove'));
  await screen.findByTestId('local-data-remove-confirm');
}

/**
 * jsdom never fires motion events, so `destroyOnHidden` cannot unmount a
 * dismissed dialog here — closed shows as its leave classes.
 */
async function dialogClosed(): Promise<void> {
  await waitFor(() => expect(document.querySelector('.ant-modal')?.className).toMatch(/-leave/));
}

function isBusy(testId: string): boolean {
  return screen.getByTestId(testId).classList.contains('ant-btn-loading');
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
  unregisterCapability('removeLocalData');
  unregisterCapability('packageAliases');
  __resetStoreForTests();
});

describe("the removal of a Windows package's data, on the Data page", () => {
  it('is the last section of the page, and its row is gated on the capability alone', () => {
    const subs = [...(getCategory('data')?.subcategories ?? [])].sort((a, b) => a.order - b.order);
    expect(subs.at(-1)?.id).toBe('removal');

    const def = getDef('data.removeLocalData');
    expect(def?.subcategory).toBe('removal');
    expect(def?.when?.(readSetting)).toBe(false);
    registerRemoval();
    expect(def?.when?.(readSetting)).toBe(true);
  });

  it('removes nothing on the first press: the dialog says what goes and what stays', async () => {
    const remove = registerRemoval();
    renderRow();

    expect(await screen.findByTestId('local-data-remove')).toBeTruthy();
    expect(screen.getByText('Data and Capture Trust', { exact: false })).toBeTruthy();
    expect(screen.getByTestId('local-data-remove').textContent).toBe('Remove…');

    await openDialog();
    expect(screen.getByText('Remove data and capture trust?')).toBeTruthy();
    expect(screen.getByText('Deleted from this device:', { exact: false })).toBeTruthy();
    expect(screen.getByText('Kept: the app and its launch aliases', { exact: false })).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('local-data-remove-cancel'));
    await dialogClosed();
    expect(remove).not.toHaveBeenCalled();
  });

  it('runs on the second press, unforced, and stays busy while the app closes', async () => {
    const remove = registerRemoval();
    renderRow();
    await openDialog();

    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledWith({ force: false });
    await waitFor(() => expect(isBusy('local-data-remove-confirm')).toBe(true));
    expect(screen.getByTestId('local-data-remove-cancel')).toHaveProperty('disabled', true);
  });

  it('lists a store that kept the certificate, and keeps everything on the first answer', async () => {
    const remove = registerRemoval(async () => REFUSED);
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));

    await screen.findByTestId('local-data-remove-refused');
    expect(screen.getByText('These stores kept the capture certificate. Nothing else was changed.')).toBeTruthy();
    expect(screen.getByText('Firefox profile')).toBeTruthy();
    expect(screen.getByText('default-release — the profile is in use')).toBeTruthy();

    fireEvent.click(screen.getByTestId('local-data-remove-keep'));
    await dialogClosed();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('goes on past that store on the second answer, forced', async () => {
    const remove = registerRemoval(async ({ force }) => (force ? { outcome: 'restarting' } : REFUSED));
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));

    await screen.findByTestId('local-data-remove-refused');
    await waitFor(() => expect(isBusy('local-data-remove-anyway')).toBe(false));
    fireEvent.click(screen.getByTestId('local-data-remove-anyway'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
    expect(remove).toHaveBeenLastCalledWith({ force: true });
    await waitFor(() => expect(isBusy('local-data-remove-anyway')).toBe(true));
  });

  it('says why the teardown did not run when no store is named', async () => {
    registerRemoval(async () => ({ outcome: 'trust-refused', stores: [], error: 'record unreadable' }));
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));

    await screen.findByTestId('local-data-remove-refused');
    expect(screen.getByText('record unreadable')).toBeTruthy();
  });

  it("says so on the row while the app's alias is off, and offers no run", async () => {
    const remove = registerRemoval();
    const openSettings = registerAppAlias(false);
    renderRow();

    await screen.findByText(ALIAS_SENTENCE);
    expect(screen.getByTestId('local-data-remove')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByTestId('local-data-remove-alias-open'));
    expect(openSettings).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it("says nothing of the alias while Windows keeps the app's", async () => {
    registerRemoval();
    registerAppAlias(true);
    renderRow();

    await screen.findByTestId('local-data-remove');
    await waitFor(() => expect(screen.getByTestId('local-data-remove')).toHaveProperty('disabled', false));
    expect(screen.queryByTestId('local-data-remove-alias-off')).toBeNull();
  });

  it.each<[string, LocalDataRemovalResult, string]>([
    ['the alias went off since the row read it', { outcome: 'alias-off', name: APP_ALIAS_NAME }, ALIAS_SENTENCE],
    [
      'the run could not be handed over',
      { outcome: 'failed', reason: 'EPERM' },
      'The removal could not start (EPERM).',
    ],
  ])('closes the dialog and says it when %s', async (_case, result, sentence) => {
    registerRemoval(async () => result);
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));

    await screen.findByText(sentence);
    await dialogClosed();
  });

  it('closes the dialog and says it when the host does not answer', async () => {
    registerRemoval(async () => {
      throw new Error('bridge closed');
    });
    renderRow();
    await openDialog();
    fireEvent.click(screen.getByTestId('local-data-remove-confirm'));

    await screen.findByText('The removal could not start (bridge closed).');
    await dialogClosed();
  });
});
