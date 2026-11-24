/**
 * PeerTabDebugControls + the shared peer Debug-mode answer — what a
 * workbench shows under a request whose content was never captured: the
 * OWNING browser's Debug mode, its attach scope, and whether this tab is
 * included, each as what it is.
 */

import type { TelemetryDebugState } from '@openheaders/core/protocol';
import PeerTabDebugControls from '@openheaders/ui/workbench/components/panels/PeerTabDebugControls';
import {
  __resetPeerDebugStatesForTests,
  isTabCovered,
  publishPeerDebugState,
  readPeerDebugState,
  setDebugScope,
  subscribePeerDebugStates,
} from '@openheaders/ui/workbench/data/peer-debug-state';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NODE = 'ext-0eefd940';
const TAB = 461072714;
const OTHER_TAB = 461072319;
const HINT = /available in Chrome and Edge/i;
const COVERED = 'New requests in this browser tab will show their content.';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => {}), broadcast: vi.fn(), presence: vi.fn() },
  };
});

function debugState(overrides: Partial<TelemetryDebugState> = {}): TelemetryDebugState {
  return { available: true, enabled: false, attachedTabs: [], pinnedTabs: [], scope: 'devtools', ...overrides };
}

/** A browser that applies each command to its posture and answers with it. */
function answeringBrowser(initial: TelemetryDebugState) {
  let state = initial;
  mockCall.mockImplementation(
    async (type: string, payload?: { command?: { kind: string } & Record<string, unknown> }) => {
      if (type !== 'oh.daemon.telemetry.debug.control') throw new Error(`unexpected call ${type}`);
      const command = payload?.command;
      if (command?.kind === 'enable') state = { ...state, enabled: command.enabled === true };
      if (command?.kind === 'pin' && typeof command.tabId === 'number') {
        const rest = state.pinnedTabs.filter((tabId) => tabId !== command.tabId);
        state = { ...state, pinnedTabs: command.pinned === true ? [...rest, command.tabId] : rest };
      }
      if (
        command?.kind === 'scope' &&
        (command.scope === 'devtools' || command.scope === 'active' || command.scope === 'both')
      ) {
        state = { ...state, scope: command.scope };
      }
      return { ok: true, debug: state };
    },
  );
}

function sentCommands(): unknown[] {
  return mockCall.mock.calls
    .filter(([type]) => type === 'oh.daemon.telemetry.debug.control')
    .map(([, payload]) => payload);
}

const debugSwitch = () => screen.getByRole('switch', { name: 'Toggle debug mode' }) as HTMLButtonElement;
const includeSwitch = () => screen.queryByTestId('peer-tab-debug-include') as HTMLButtonElement | null;
const scopeSelect = () => screen.queryByTestId('peer-tab-debug-scope');
const isChecked = (el: HTMLElement | null) => el?.getAttribute('aria-checked') === 'true';

function mount(initial: TelemetryDebugState) {
  publishPeerDebugState(NODE, initial);
  answeringBrowser(initial);
  return render(<PeerTabDebugControls nodeId={NODE} tabId={TAB} />);
}

beforeEach(() => {
  __resetPeerDebugStatesForTests();
  mockCall.mockReset();
});

afterEach(() => {
  cleanup();
  __resetPeerDebugStatesForTests();
});

describe('isTabCovered', () => {
  it('needs the browser’s switch on AND the tab in its scope', () => {
    expect(isTabCovered(debugState(), TAB)).toBe(false);
    expect(isTabCovered(debugState({ enabled: true }), TAB)).toBe(false);
    expect(isTabCovered(debugState({ pinnedTabs: [TAB] }), TAB)).toBe(false);
    expect(isTabCovered(debugState({ enabled: true, pinnedTabs: [TAB] }), TAB)).toBe(true);
    expect(isTabCovered(debugState({ enabled: true, attachedTabs: [TAB] }), TAB)).toBe(true);
  });

  it('a switch that is on for other tabs only does not count', () => {
    expect(isTabCovered(debugState({ enabled: true, attachedTabs: [OTHER_TAB], pinnedTabs: [OTHER_TAB] }), TAB)).toBe(
      false,
    );
  });
});

describe('the shared peer Debug-mode answer', () => {
  it('a snapshot that changes nothing notifies no one', () => {
    const listener = vi.fn();
    publishPeerDebugState(NODE, debugState({ enabled: true, pinnedTabs: [TAB] }));
    subscribePeerDebugStates(listener);
    publishPeerDebugState(NODE, debugState({ enabled: true, pinnedTabs: [TAB] }));
    expect(listener).not.toHaveBeenCalled();
    publishPeerDebugState(NODE, debugState({ enabled: true, pinnedTabs: [TAB], attachedTabs: [TAB] }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a scope change alone is a change', () => {
    const listener = vi.fn();
    publishPeerDebugState(NODE, debugState());
    subscribePeerDebugStates(listener);
    publishPeerDebugState(NODE, debugState({ scope: 'both' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a scope command publishes the browser’s answer', async () => {
    answeringBrowser(debugState({ enabled: true }));
    await setDebugScope(NODE, 'active');
    expect(readPeerDebugState(NODE)?.scope).toBe('active');
  });
});

describe('PeerTabDebugControls — Debug mode off', () => {
  it('shows the one switch, off, and nothing else', () => {
    mount(debugState());
    expect(isChecked(debugSwitch())).toBe(false);
    expect(includeSwitch()).toBeNull();
    expect(scopeSelect()).toBeNull();
    expect(screen.queryByText(COVERED)).toBeNull();
  });

  it('turning it on includes this tab, then flips the browser’s switch', async () => {
    mount(debugState());
    fireEvent.click(debugSwitch());
    await waitFor(() => expect(isChecked(debugSwitch())).toBe(true));
    expect(sentCommands()).toEqual([
      { nodeId: NODE, command: { kind: 'pin', tabId: TAB, pinned: true } },
      { nodeId: NODE, command: { kind: 'enable', enabled: true } },
    ]);
    expect(isChecked(includeSwitch())).toBe(true);
    expect(screen.getByText(COVERED)).toBeTruthy();
  });

  it('a tab already included only needs the browser’s switch', async () => {
    mount(debugState({ pinnedTabs: [TAB] }));
    fireEvent.click(debugSwitch());
    await waitFor(() => expect(isChecked(debugSwitch())).toBe(true));
    expect(sentCommands()).toEqual([{ nodeId: NODE, command: { kind: 'enable', enabled: true } }]);
  });
});

describe('PeerTabDebugControls — Debug mode on, this tab not attached', () => {
  const ON_ELSEWHERE = debugState({ enabled: true, attachedTabs: [OTHER_TAB], pinnedTabs: [OTHER_TAB] });

  it('shows Debug mode ON, with the scope and this tab not included — and no promise of content', () => {
    mount(ON_ELSEWHERE);
    expect(isChecked(debugSwitch())).toBe(true);
    expect(isChecked(includeSwitch())).toBe(false);
    expect(screen.getByText('Attach to')).toBeTruthy();
    expect(screen.getByText('Where DevTools is open')).toBeTruthy();
    expect(screen.getByText('Include this browser tab')).toBeTruthy();
    expect(screen.queryByText(COVERED)).toBeNull();
  });

  it('boxes the two rows together with an "and" between them — they add up', () => {
    mount(ON_ELSEWHERE);
    const box = screen.getByTestId('peer-tab-debug-scope-box');
    const and = screen.getByTestId('peer-tab-debug-and');
    expect(and.textContent).toBe('and');
    // Scope row, then "and", then the include row, all inside the one box.
    const children = Array.from(box.children);
    expect(children).toHaveLength(3);
    expect(children[0]?.textContent).toContain('Attach to');
    expect(children[1]).toBe(and);
    expect(children[2]?.textContent).toContain('Include this browser tab');
    expect(box.style.borderStyle).toBe('dashed');
  });

  it('including this tab sends the pin alone, and says what changes', async () => {
    mount(ON_ELSEWHERE);
    const include = includeSwitch();
    if (include === null) throw new Error('expected the include switch');
    fireEvent.click(include);
    await waitFor(() => expect(isChecked(includeSwitch())).toBe(true));
    expect(sentCommands()).toEqual([{ nodeId: NODE, command: { kind: 'pin', tabId: TAB, pinned: true } }]);
    expect(screen.getByText(COVERED)).toBeTruthy();
    // The other tab's pin is untouched.
    expect(readPeerDebugState(NODE)?.pinnedTabs).toEqual([OTHER_TAB, TAB]);
  });

  it('names the focused tab as the BROWSER’S, for a watcher outside it', () => {
    mount(debugState({ enabled: true, scope: 'active' }));
    expect(screen.getByText('The focused browser tab')).toBeTruthy();
    expect(screen.queryByText('The focused tab')).toBeNull();
  });

  it('a tab the scope attached on its own is covered without being included', () => {
    mount(debugState({ enabled: true, scope: 'active', attachedTabs: [TAB] }));
    expect(isChecked(includeSwitch())).toBe(false);
    expect(screen.getByText(COVERED)).toBeTruthy();
  });

  it('a browser that reports no scope shows no selector, and the rest works', () => {
    const { scope: _scope, ...withoutScope } = debugState({ enabled: true });
    mount(withoutScope);
    expect(scopeSelect()).toBeNull();
    expect(screen.queryByText('Attach to')).toBeNull();
    expect(screen.queryByTestId('peer-tab-debug-and')).toBeNull();
    expect(includeSwitch()).not.toBeNull();
  });
});

describe('PeerTabDebugControls — Debug mode on, this tab covered', () => {
  const COVERING = debugState({ enabled: true, pinnedTabs: [TAB], attachedTabs: [TAB] });

  it('taking the tab out sends the unpin alone and withdraws the promise', async () => {
    mount(COVERING);
    const include = includeSwitch();
    if (include === null) throw new Error('expected the include switch');
    fireEvent.click(include);
    await waitFor(() => expect(isChecked(includeSwitch())).toBe(false));
    expect(sentCommands()).toEqual([{ nodeId: NODE, command: { kind: 'pin', tabId: TAB, pinned: false } }]);
  });

  it('turning Debug mode off flips the browser’s switch, hides the rest and leaves the pin', async () => {
    mount(COVERING);
    fireEvent.click(debugSwitch());
    await waitFor(() => expect(isChecked(debugSwitch())).toBe(false));
    expect(sentCommands()).toEqual([{ nodeId: NODE, command: { kind: 'enable', enabled: false } }]);
    expect(includeSwitch()).toBeNull();
    expect(screen.queryByText(COVERED)).toBeNull();
    expect(readPeerDebugState(NODE)?.pinnedTabs).toEqual([TAB]);
  });
});

describe('PeerTabDebugControls — where the answer comes from', () => {
  it('follows a change made elsewhere — the rail, or the browser itself', async () => {
    mount(debugState());
    expect(isChecked(debugSwitch())).toBe(false);
    publishPeerDebugState(NODE, debugState({ enabled: true, attachedTabs: [TAB], scope: 'both' }));
    await waitFor(() => expect(isChecked(debugSwitch())).toBe(true));
    expect(screen.getByText('Both')).toBeTruthy();
    expect(screen.getByText(COVERED)).toBeTruthy();
  });

  it('a browser that cannot drive its debugger shows the switch disabled, with where it works', () => {
    publishPeerDebugState(NODE, debugState({ available: false }));
    const { container } = render(<PeerTabDebugControls nodeId={NODE} tabId={TAB} />);
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[aria-disabled="true"]')?.getAttribute('aria-label')).toMatch(HINT);
    expect(includeSwitch()).toBeNull();
  });

  it('a browser that never answers leaves everything where it was', async () => {
    publishPeerDebugState(NODE, debugState());
    mockCall.mockResolvedValue({ ok: false, debug: null });
    render(<PeerTabDebugControls nodeId={NODE} tabId={TAB} />);
    fireEvent.click(debugSwitch());
    await waitFor(() => expect(sentCommands().length).toBeGreaterThan(0));
    await waitFor(() => expect(debugSwitch().className).not.toContain('ant-switch-loading'));
    expect(isChecked(debugSwitch())).toBe(false);
  });

  it('mounted with nothing published, it asks the host once and takes the answer', async () => {
    mockCall.mockResolvedValue({
      peers: [
        {
          nodeId: NODE,
          agent: '@openheaders/extension@2026.11.1',
          browser: { name: 'Chrome', platform: 'macOS' },
          debug: debugState({ enabled: true, attachedTabs: [TAB] }),
          tabs: [],
          watchConsent: true,
        },
      ],
    });
    render(
      <>
        <PeerTabDebugControls nodeId={NODE} tabId={TAB} />
        <PeerTabDebugControls nodeId={NODE} tabId={OTHER_TAB} />
      </>,
    );
    await waitFor(() => expect(readPeerDebugState(NODE)).toBeDefined());
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('oh.daemon.telemetry.tabs.list');
    // The first tab is attached and says so; the second is not.
    await waitFor(() => expect(screen.getAllByText(COVERED)).toHaveLength(1));
  });

  it('a browser that is no longer connected shows nothing', async () => {
    mockCall.mockResolvedValue({ peers: [] });
    const { container } = render(<PeerTabDebugControls nodeId={NODE} tabId={TAB} />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('a host that cannot read its browsers shows nothing either', async () => {
    mockCall.mockRejectedValue(new Error('no relay'));
    const { container } = render(<PeerTabDebugControls nodeId={NODE} tabId={TAB} />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
