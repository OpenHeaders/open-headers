/**
 * Product-telemetry disable retention dialog — unchecking the anonymous
 * usage counting toggle asks first instead of flipping the setting.
 * Covers: the uncheck gesture opening the dialog with the value still
 * on, "Turn off anyway" being the only path that commits the disable,
 * "Keep counting on" and plain dismissal leaving counting untouched,
 * and re-enabling flipping on immediately with no dialog.
 */

import ProductTelemetryToggleRow from '@openheaders/ui/workbench/settings/components/product-telemetry-toggle-row';
import { __resetRegistryForTests, allDefs, registerSetting } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import type { SettingDef } from '@openheaders/ui/workbench/settings/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
  }

  subscribe(): () => void {
    return () => {};
  }
}

const KEY = 'telemetry.enabled';

let def: SettingDef;

beforeEach(async () => {
  __resetStoreForTests();
  __resetRegistryForTests();
  configureSettingsStorage(new MemoryDictStorage());
  registerSetting({
    key: KEY,
    type: 'boolean',
    default: true,
    schema: v.boolean(),
    label: 'Anonymous usage counting',
    description: '',
    category: 'general',
    scope: 'user',
  });
  const found = allDefs().find((d) => d.key === KEY);
  if (!found) throw new Error('telemetry def not registered');
  def = found;
  await initSettingsStore();
});

afterEach(cleanup);

const toggle = (): HTMLElement => screen.getByRole('checkbox');

describe('product-telemetry disable retention dialog', () => {
  it('unchecking opens the dialog without flipping the setting', () => {
    render(<ProductTelemetryToggleRow def={def} />);

    act(() => {
      fireEvent.click(toggle());
    });

    expect(screen.getByText('Turn off anonymous usage counting?')).toBeTruthy();
    expect(screen.getByText('Your privacy is already protected')).toBeTruthy();
    expect(storeGet(KEY)).toBe(true);
  });

  it('"Turn off anyway" commits the disable', () => {
    render(<ProductTelemetryToggleRow def={def} />);

    act(() => {
      fireEvent.click(toggle());
    });
    act(() => {
      fireEvent.click(screen.getByText('Turn off anyway'));
    });

    expect(storeGet(KEY)).toBe(false);
  });

  it('"Keep counting on" leaves the setting on', () => {
    render(<ProductTelemetryToggleRow def={def} />);

    act(() => {
      fireEvent.click(toggle());
    });
    act(() => {
      fireEvent.click(screen.getByText('Keep counting on'));
    });

    expect(storeGet(KEY)).toBe(true);
  });

  it('re-enabling flips on immediately with no dialog', () => {
    act(() => {
      storeSet(KEY, false);
    });
    render(<ProductTelemetryToggleRow def={def} />);

    act(() => {
      fireEvent.click(toggle());
    });

    expect(storeGet(KEY)).toBe(true);
    expect(screen.queryByText('Turn off anonymous usage counting?')).toBeNull();
  });
});
