/**
 * FF/Safari capability gate for the CDP master switch.
 *
 * The row reads its availability off the host-injected `cdpInspection`
 * capability (never a browser-name check), so the chrome-free UI stays
 * platform-agnostic. Where the capability is absent — Firefox / Safari,
 * which don't expose the debugging protocol — the control renders visibly
 * disabled with an explanation rather than silently doing nothing.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import BooleanField from '@openheaders/ui/workbench/settings/fields/BooleanField';
import { getDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

const DISABLED_LABEL = 'Disabled — unavailable on this browser';

function inspectionDef() {
  const def = getDef('inspection.cdpEnabled');
  if (!def) throw new Error('inspection.cdpEnabled not registered');
  return def;
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  __resetStoreForTests();
});

describe('CDP master-switch capability gate', () => {
  it('renders the row disabled with an explanation when the capability is absent', () => {
    // Firefox / Safari: the host never registered `cdpInspection`.
    render(<BooleanField def={inspectionDef()} />);
    expect(screen.getByRole('img', { name: DISABLED_LABEL })).toBeTruthy();
  });

  it('renders the row enabled when the host supports CDP inspection', () => {
    registerCapability('cdpInspection', () => true);
    render(<BooleanField def={inspectionDef()} />);
    expect(screen.queryByRole('img', { name: DISABLED_LABEL })).toBeNull();
  });
});
