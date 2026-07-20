import { registerCapability, type TerminalHostApi, unregisterCapability } from '@openheaders/core/capabilities';
import { normalizeDockLayout, type ToolLayoutState } from '@openheaders/ui/shared/dock-layout';
import { availableToolWindowMap, availableToolWindows, TOOL_WINDOWS } from '@openheaders/ui/workbench/tool-windows';
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
  it('drops every capability-gated window on a host without the capabilities', () => {
    const ids = availableToolWindows().map((def) => def.id);
    expect(ids).not.toContain('terminal');
    expect(ids).not.toContain('git');
    expect(availableToolWindowMap().terminal).toBeUndefined();
    // Everything ungated stays.
    const gated = TOOL_WINDOWS.filter((def) => def.requiresCapability !== undefined).length;
    expect(ids).toHaveLength(TOOL_WINDOWS.length - gated);
  });

  it('includes the terminal window once the capability is registered', () => {
    registerCapability('terminal', fakeTerminalHost);
    const terminal = availableToolWindows().find((def) => def.id === 'terminal');
    expect(terminal).toBeDefined();
    expect(terminal?.defaultSlot).toBe('bottom-left');
    expect(terminal?.openByDefault).toBe(false);
  });

  it('normalize drops a persisted terminal id on a capability-less host', () => {
    const out = normalizeDockLayout(
      { docks: docksWith({ 'bottom-left': { windows: ['terminal'], active: 'terminal' } }) },
      availableToolWindows(),
      availableToolWindowMap(),
    );
    expect(out.docks['bottom-left'].windows).not.toContain('terminal');
    expect(out.docks['bottom-left'].active).toBeNull();
  });

  it('normalize seats the terminal in its default slot when the capability exists', () => {
    registerCapability('terminal', fakeTerminalHost);
    const out = normalizeDockLayout(null, availableToolWindows(), availableToolWindowMap());
    expect(out.docks['bottom-left'].windows).toContain('terminal');
    // Dormant until the user opens it.
    expect(out.docks['bottom-left'].active).not.toBe('terminal');
  });
});
