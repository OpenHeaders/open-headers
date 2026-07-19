/**
 * Terminal tab registry — tab lifecycle in the workbench terminal's
 * module-level owner: creation/activation ordering, IDE-style
 * lowest-free title numbering, neighbor activation on close, pty
 * disposal, and per-tab exit tracking. The module is a singleton by
 * design, so each test re-imports it fresh via vi.resetModules().
 */

import type { TerminalSession } from '@openheaders/core/capabilities';
import type { getWorkbenchTerminalTabs as GetTabs } from '@openheaders/ui/workbench/components/panels/terminal/terminal-instance';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeSession extends TerminalSession {
  exitListeners: Array<(exitCode: number) => void>;
  disposed: boolean;
  childrenRunning: boolean;
}

function makeFakeSession(id: string): FakeSession {
  const session: FakeSession = {
    id,
    exitListeners: [],
    disposed: false,
    childrenRunning: false,
    write: vi.fn(),
    resize: vi.fn(),
    onData: () => () => {},
    onExit(listener) {
      session.exitListeners.push(listener);
      return () => {};
    },
    hasChildren: async () => session.childrenRunning,
    dispose() {
      session.disposed = true;
    },
  };
  return session;
}

describe('terminal tab registry', () => {
  let getTabs: typeof GetTabs;
  let spawned: FakeSession[];
  let unregister: () => void;

  beforeEach(async () => {
    vi.resetModules();
    const capabilities = await import('@openheaders/core/capabilities');
    spawned = [];
    let sessionSeq = 1;
    capabilities.registerCapability('terminal', () => ({
      spawn: async () => {
        const session = makeFakeSession(`pty-${sessionSeq++}`);
        spawned.push(session);
        return session;
      },
    }));
    unregister = () => capabilities.unregisterCapability('terminal');
    const mod = await import('@openheaders/ui/workbench/components/panels/terminal/terminal-instance');
    getTabs = mod.getWorkbenchTerminalTabs;
  });

  it('returns null without the terminal capability', () => {
    unregister();
    expect(getTabs()).toBeNull();
  });

  it('creates tabs active-last with sequential title indices and notifies', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const listener = vi.fn();
    tabs.onTabsChange(listener);
    const first = tabs.createTab();
    const second = tabs.createTab();
    expect(tabs.list().map((tab) => tab.titleIndex)).toEqual([1, 2]);
    expect(tabs.activeId()).toBe(second);
    expect(listener).toHaveBeenCalledTimes(2);
    tabs.activateTab(first);
    expect(tabs.activeId()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('ignores activation of unknown ids', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    tabs.activateTab('tab-missing');
    expect(tabs.activeId()).toBe(first);
  });

  it('reuses the lowest free title index after a close', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    tabs.createTab();
    const second = tabs.createTab();
    tabs.createTab();
    tabs.closeTab(second);
    tabs.createTab();
    expect(tabs.list().map((tab) => tab.titleIndex)).toEqual([1, 3, 2]);
  });

  it('activates the following neighbor when the active tab closes, previous when it was last', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    const second = tabs.createTab();
    const third = tabs.createTab();
    tabs.activateTab(second);
    tabs.closeTab(second);
    expect(tabs.activeId()).toBe(third);
    tabs.closeTab(third);
    expect(tabs.activeId()).toBe(first);
  });

  it('keeps the active tab when a background tab closes', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    const second = tabs.createTab();
    tabs.activateTab(first);
    tabs.closeTab(second);
    expect(tabs.activeId()).toBe(first);
  });

  it('disposes the pty session on close and empties out after the last tab', async () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const id = tabs.createTab();
    const tab = tabs.getTab(id);
    if (!tab) throw new Error('tab handle missing');
    await tab.ensureSession();
    expect(spawned).toHaveLength(1);
    tabs.closeTab(id);
    expect(spawned[0].disposed).toBe(true);
    expect(tabs.list()).toEqual([]);
    expect(tabs.activeId()).toBeNull();
  });

  it('tracks exit per tab', async () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    const second = tabs.createTab();
    const firstTab = tabs.getTab(first);
    const secondTab = tabs.getTab(second);
    if (!firstTab || !secondTab) throw new Error('tab handle missing');
    await firstTab.ensureSession();
    await secondTab.ensureSession();
    const exitListener = vi.fn();
    firstTab.onExitChange(exitListener);
    for (const listener of spawned[0].exitListeners) listener(0);
    expect(firstTab.isExited()).toBe(true);
    expect(secondTab.isExited()).toBe(false);
    expect(exitListener).toHaveBeenCalledTimes(1);
  });

  it('types the run command into a command tab on first spawn only', async () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const id = tabs.createTab({ runCommand: 'oh tui', title: 'oh tui' });
    expect(tabs.list()[0]).toEqual({ id, titleIndex: 0, title: 'oh tui' });
    const tab = tabs.getTab(id);
    if (!tab) throw new Error('tab handle missing');
    await tab.ensureSession();
    expect(spawned[0].write).toHaveBeenCalledWith('oh tui\r');
    for (const listener of spawned[0].exitListeners) listener(0);
    await tab.ensureSession();
    expect(spawned[1].write).not.toHaveBeenCalled();
  });

  it('excludes titled tabs from Local numbering', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    tabs.createTab();
    tabs.createTab({ runCommand: 'oh tui', title: 'oh tui' });
    tabs.createTab();
    expect(tabs.list().map((tab) => tab.titleIndex)).toEqual([1, 0, 2]);
  });

  it('reports a running process only while the session has live children', async () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const id = tabs.createTab();
    const tab = tabs.getTab(id);
    if (!tab) throw new Error('tab handle missing');
    await expect(tab.hasRunningProcess()).resolves.toBe(false);
    await tab.ensureSession();
    await expect(tab.hasRunningProcess()).resolves.toBe(false);
    spawned[0].childrenRunning = true;
    await expect(tab.hasRunningProcess()).resolves.toBe(true);
    for (const listener of spawned[0].exitListeners) listener(0);
    await expect(tab.hasRunningProcess()).resolves.toBe(false);
  });

  it('still notifies and converges when a disposer throws on close', async () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = tabs.createTab();
      const second = tabs.createTab();
      const tab = tabs.getTab(second);
      if (!tab) throw new Error('tab handle missing');
      await tab.ensureSession();
      spawned[0].dispose = () => {
        throw new Error('kill failed');
      };
      const listener = vi.fn();
      tabs.onTabsChange(listener);
      tabs.closeTab(second);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(tabs.list().map((info) => info.id)).toEqual([first]);
      expect(tabs.activeId()).toBe(first);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('notifies on close after the terminal was opened in a container', async () => {
    // jsdom lacks matchMedia, which xterm's renderer needs on open —
    // stub it so the close path runs against a real, opened terminal
    // (the S13 freeze regression lived in exactly this path).
    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }),
      });
    }
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    const second = tabs.createTab();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tab = tabs.getTab(second);
    if (!tab) throw new Error('tab handle missing');
    tab.term.open(container);
    await tab.ensureSession();
    const listener = vi.fn();
    tabs.onTabsChange(listener);
    tabs.closeTab(second);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(tabs.activeId()).toBe(first);
  });

  it('applies the theme to existing and future tabs', () => {
    const tabs = getTabs();
    if (!tabs) throw new Error('registry unavailable');
    const first = tabs.createTab();
    tabs.setTheme({ background: '#101010' });
    const second = tabs.createTab();
    expect(tabs.getTab(first)?.term.options.theme?.background).toBe('#101010');
    expect(tabs.getTab(second)?.term.options.theme?.background).toBe('#101010');
  });
});
