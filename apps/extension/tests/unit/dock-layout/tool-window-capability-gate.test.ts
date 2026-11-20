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
    // the desktop teaser body instead of disappearing. `server-admin`
    // included: with no `serverAdmin` plane registered the per-user
    // admin gate never applies and the tab is the desktop teaser.
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

  it('orders the bottom dock terminal→git→traffic-monitor (left) and workflow-status→activity→activity-monitor (right)', () => {
    const out = normalizeDockLayout(null, availableToolWindows(), availableToolWindowMap());
    expect(out.docks['bottom-left'].windows).toEqual(['terminal', 'git', 'traffic-monitor']);
    expect(out.docks['bottom-right'].windows).toEqual(['workflow-status', 'activity', 'activity-monitor']);
  });
});

describe('the activity monitor window', () => {
  afterEach(() => {
    unregisterCapability('activityMonitor');
  });

  const activityMonitor = () => {
    const def = availableToolWindows().find((candidate) => candidate.id === 'activity-monitor');
    if (!def) throw new Error('activity-monitor window dropped');
    return def;
  };

  it('stays as the desktop teaser on a host without the capability', () => {
    const def = activityMonitor();
    expect(isToolWindowTeased(def)).toBe(true);
    expect(def.teaserWhenUnavailable).toBe('activityMonitor');
  });

  it('is the real panel once the host registers the capability', () => {
    registerCapability('activityMonitor', () => true);
    expect(isToolWindowTeased(activityMonitor())).toBe(false);
  });

  it('sits bottom-right after the feed, closed until opened, and needs no workspace', () => {
    const def = activityMonitor();
    expect(def.defaultSlot).toBe('bottom-right');
    expect(def.openByDefault).toBe(false);
    expect(def.requiresWorkspace).toBeUndefined();
    expect(def.core).toBe(false);

    registerCapability('activityMonitor', () => true);
    const out = normalizeDockLayout(null, availableToolWindows(), availableToolWindowMap());
    expect(out.docks['bottom-right'].active).not.toBe('activity-monitor');
  });

  it('reads by its name alone — a label key and no tooltip key', () => {
    const def = activityMonitor();
    expect(def.labelKey).toBe('workbench.toolWindows.activityMonitor');
    expect(def.tooltipKey).toBeUndefined();
  });
});
