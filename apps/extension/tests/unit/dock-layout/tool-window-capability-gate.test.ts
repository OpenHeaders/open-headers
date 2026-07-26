import { registerCapability, type TerminalHostApi, unregisterCapability } from '@openheaders/core/capabilities';
import { normalizeDockLayout, type ToolLayoutState } from '@openheaders/ui/shared/dock-layout';
import {
  availableToolWindowMap,
  availableToolWindows,
  isToolWindowTeased,
  TOOL_WINDOWS,
} from '@openheaders/ui/workbench/tool-windows';
import type { ToolWindowId } from '@openheaders/ui/workbench/types';
import { afterEach, describe, expect, it } from 'vitest';

const docksWith = (
  overrides: Partial<ToolLayoutState<ToolWindowId>['docks']>,
): ToolLayoutState<ToolWindowId>['docks'] => ({
  'left-top': { windows: [], active: null },
  'left-bottom': { windows: [], active: null },
  'right-top': { windows: [], active: null },
  'right-bottom': { windows: [], active: null },
  'bottom-left': { windows: [], active: null },
  'bottom-right': { windows: [], active: null },
  ...overrides,
});

const fakeTerminalHost = (): TerminalHostApi => ({
  spawn: () => Promise.reject(new Error('not wired in tests')),
});

afterEach(() => {
  unregisterCapability('terminal');
});

describe('capability-gated tool windows', () => {
  it('keeps capability-gated windows as desktop teasers on a host without the capabilities', () => {
    // Every gated window in the registry declares `teaserWhenUnavailable`,
    // so a browser host sees the full registry — the gated tabs render
    // the desktop teaser body instead of disappearing.
    const defs = availableToolWindows();
    expect(defs.map((def) => def.id)).toEqual(TOOL_WINDOWS.map((def) => def.id));
    expect(availableToolWindowMap().terminal).toBeDefined();
    for (const def of defs) {
      expect(isToolWindowTeased(def)).toBe(def.requiresCapability !== undefined);
    }
  });

  it('renders the terminal window for real once the capability is registered', () => {
    registerCapability('terminal', fakeTerminalHost);
    const terminal = availableToolWindows().find((def) => def.id === 'terminal');
    expect(terminal).toBeDefined();
    expect(terminal && isToolWindowTeased(terminal)).toBe(false);
    expect(terminal?.defaultSlot).toBe('bottom-left');
    expect(terminal?.openByDefault).toBe(false);
  });

  it('normalize keeps a persisted terminal id on a capability-less host (teased tab)', () => {
    const out = normalizeDockLayout(
      { docks: docksWith({ 'bottom-left': { windows: ['terminal'], active: 'terminal' } }) },
      availableToolWindows(),
      availableToolWindowMap(),
    );
    expect(out.docks['bottom-left'].windows).toContain('terminal');
    expect(out.docks['bottom-left'].active).toBe('terminal');
  });

  it('normalize seats the terminal in its default slot when the capability exists', () => {
    registerCapability('terminal', fakeTerminalHost);
    const out = normalizeDockLayout(null, availableToolWindows(), availableToolWindowMap());
    expect(out.docks['bottom-left'].windows).toContain('terminal');
    // Dormant until the user opens it.
    expect(out.docks['bottom-left'].active).not.toBe('terminal');
  });

  it('orders the bottom dock terminal→git (left) and traffic-monitor→workflow-status→activity (right)', () => {
    const out = normalizeDockLayout(null, availableToolWindows(), availableToolWindowMap());
    expect(out.docks['bottom-left'].windows).toEqual(['terminal', 'git']);
    expect(out.docks['bottom-right'].windows).toEqual(['traffic-monitor', 'workflow-status', 'activity']);
  });
});
