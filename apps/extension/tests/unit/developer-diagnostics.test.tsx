// @vitest-environment jsdom
/**
 * The developer diagnostics command set: the section lists one crash
 * command per visible tool window and the tab crash only with an active
 * tab, under stable ids; the crash commands arm their units; the
 * uncaught command throws from a timer; and the palette section exists
 * only once a host installed the diagnostics.
 */

import { InjectedFaultError, isFaultArmed, ROOT_FAULT_UNIT, resetFaults } from '@openheaders/ui/shared/fault-injection';
import {
  buildDeveloperCommandSection,
  DEVELOPER_COMMAND_IDS,
  installDeveloperDiagnostics,
  isDeveloperDiagnosticsInstalled,
  useDeveloperCommandSection,
} from '@openheaders/ui/workbench/developer-diagnostics';
import type { ToolWindowId } from '@openheaders/ui/workbench/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  resetFaults();
  vi.useRealTimers();
});

const ids = (section: { items: Array<{ id: string }> }) => section.items.map((item) => item.id);

describe('developer diagnostics', () => {
  it('lists the tab crash only with an active tab and one crash per visible tool window, under stable ids', () => {
    const bare = buildDeveloperCommandSection({ activeTabId: null, visibleToolWindows: [] });
    expect(bare.id).toBe(DEVELOPER_COMMAND_IDS.section);
    expect(bare.title).toBe('Developer');
    expect(ids(bare)).toEqual(['dev-crash-root', 'dev-hang-renderer', 'dev-throw-uncaught', 'dev-reject-unhandled']);

    const full = buildDeveloperCommandSection({ activeTabId: 'tab-1', visibleToolWindows: ['http-rules', 'activity'] });
    expect(ids(full)).toEqual([
      'dev-crash-tab',
      'dev-crash-window-http-rules',
      'dev-crash-window-activity',
      'dev-crash-root',
      'dev-hang-renderer',
      'dev-throw-uncaught',
      'dev-reject-unhandled',
    ]);
    expect(full.items[1].label).toBe('Crash tool window: http-rules');
  });

  it('the crash commands arm their units', () => {
    const section = buildDeveloperCommandSection({ activeTabId: 'tab-1', visibleToolWindows: ['http-rules'] });
    const select = (id: string) => section.items.find((item) => item.id === id)?.onSelect();
    select(DEVELOPER_COMMAND_IDS.crashTab);
    expect(isFaultArmed({ kind: 'tab', id: 'tab-1' })).toBe(true);
    select(DEVELOPER_COMMAND_IDS.crashToolWindow('http-rules'));
    expect(isFaultArmed({ kind: 'window', id: 'http-rules' })).toBe(true);
    expect(isFaultArmed(ROOT_FAULT_UNIT)).toBe(false);
    select(DEVELOPER_COMMAND_IDS.crashRoot);
    expect(isFaultArmed(ROOT_FAULT_UNIT)).toBe(true);
  });

  it('the uncaught command throws an InjectedFaultError from a timer, outside React', () => {
    vi.useFakeTimers();
    const section = buildDeveloperCommandSection({ activeTabId: null, visibleToolWindows: [] });
    section.items.find((item) => item.id === DEVELOPER_COMMAND_IDS.throwUncaught)?.onSelect();
    expect(() => vi.runAllTimers()).toThrow(InjectedFaultError);
  });

  it('the palette section exists only once a host installed the diagnostics', () => {
    const none: ToolWindowId[] = [];
    const { result } = renderHook(() => useDeveloperCommandSection({ activeTabId: null, visibleToolWindows: none }));
    expect(isDeveloperDiagnosticsInstalled()).toBe(false);
    expect(result.current).toBeNull();
    act(() => installDeveloperDiagnostics());
    expect(isDeveloperDiagnosticsInstalled()).toBe(true);
    expect(result.current?.id).toBe(DEVELOPER_COMMAND_IDS.section);
  });
});
