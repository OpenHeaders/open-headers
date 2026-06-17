/**
 * Cross-surface Debug mode toggle shortcut.
 *
 * `useDebugModeShortcut` (mounted by the shared DebugModePill on every
 * surface) binds one document keydown listener that flips
 * `inspection.cdpEnabled`. It's gated on the `cdpInspection` capability
 * and ignored while a text field has focus.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import '@openheaders/ui/workbench/settings/schema/keyboard';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { useDebugModeShortcut } from '@openheaders/ui/shared/debug-mode';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  get,
  initSettingsStore,
  set,
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

function Harness(): null {
  useDebugModeShortcut();
  return null;
}

function pressShiftD(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', shiftKey: true, bubbles: true, cancelable: true }),
  );
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
  set('inspection.cdpEnabled', false);
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  __resetStoreForTests();
});

describe('Debug mode toggle shortcut', () => {
  it('flips inspection.cdpEnabled on the bound chord when the capability is present', () => {
    registerCapability('cdpInspection', () => true);
    render(<Harness />);

    pressShiftD();
    expect(get('inspection.cdpEnabled')).toBe(true);

    pressShiftD();
    expect(get('inspection.cdpEnabled')).toBe(false);
  });

  it('does nothing without the cdpInspection capability', () => {
    render(<Harness />);
    pressShiftD();
    expect(get('inspection.cdpEnabled')).toBe(false);
  });

  it('ignores the chord while a text field is focused', () => {
    registerCapability('cdpInspection', () => true);
    render(
      <>
        <Harness />
        <input data-testid="field" />
      </>,
    );
    (screen.getByTestId('field') as HTMLInputElement).focus();

    pressShiftD();
    expect(get('inspection.cdpEnabled')).toBe(false);
  });
});
