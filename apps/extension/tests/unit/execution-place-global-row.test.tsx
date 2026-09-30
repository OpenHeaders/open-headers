// @vitest-environment jsdom
/**
 * Settings › API Requests › Where requests run › Execution place — the
 * global row lists this host's ROSTER in the place picker's own words
 * (a host-aware option list, resolved at render time after the entry
 * point declared the host), never a role the host has no leg for; the
 * served tab has one place by construction, so it carries no row, and
 * a group whose rows all hide leaves no title standing over nothing.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/requests';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import CategoryPane from '@openheaders/ui/workbench/settings/components/CategoryPane';
import { resolveSettingDef, translateEnglish } from '@openheaders/ui/workbench/settings/localize';
import { getCategory, requireDef } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
} from '@openheaders/ui/workbench/settings/store';
import type { SettingKey, SettingsMap } from '@openheaders/ui/workbench/settings/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The row resolver reaches every field kind; the code field's editor is
// Monaco, which probes the clipboard at module load — not this pin's subject.
vi.mock('@openheaders/ui/workbench/settings/fields/CodeField', () => ({ default: () => null }));

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

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  setCurrentHost('extension');
  __resetStoreForTests();
});

const getter = <K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k);

function optionLabels(): string[] {
  const def = resolveSettingDef(requireDef('requests.executionPlace'), translateEnglish);
  return (def.enumOptions ?? []).map((option) => option.label);
}

function rowRenders(): boolean {
  return requireDef('requests.executionPlace').when?.(getter) ?? true;
}

describe('the global Execution place row', () => {
  it('lists Automatic and this host’s roster in the picker’s words, read at render time', () => {
    setCurrentHost('extension');
    expect(optionLabels()).toEqual(['Automatic', 'Browser extension', 'Desktop app', 'Server']);
    setCurrentHost('desktop');
    expect(optionLabels()).toEqual(['Automatic', 'Desktop app', 'Server']);
    setCurrentHost('web');
    expect(optionLabels()).toEqual(['Automatic', 'Server']);
  });

  it('renders on the extension and the desktop app, never on the served tab', () => {
    setCurrentHost('extension');
    expect(rowRenders()).toBe(true);
    setCurrentHost('desktop');
    expect(rowRenders()).toBe(true);
    setCurrentHost('web');
    expect(rowRenders()).toBe(false);
  });

  it('the served tab’s pane drops the Where requests run group whose rows all hide', () => {
    const category = getCategory('requests');
    if (!category) throw new Error('requests not registered');
    const defs = [
      requireDef('requests.executionPlace'),
      requireDef('requests.allowServerExecution'),
      requireDef('requests.responseBodyCapMB'),
    ];
    setCurrentHost('web');
    render(<CategoryPane category={category} defs={defs} />);
    expect(screen.queryByText('Where requests run')).toBeNull();
    expect(screen.getByText('HTTP')).toBeTruthy();
    cleanup();
    setCurrentHost('extension');
    render(<CategoryPane category={category} defs={defs} />);
    expect(screen.getByText('Where requests run')).toBeTruthy();
    expect(screen.getByText('HTTP')).toBeTruthy();
  });
});
