/**
 * The toolbar button's right-click menu — five top-level items on the
 * `action` context, a Help submenu, a pause item that follows the setting,
 * and clicks that reach the workspace navigator.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildToolbarMenu, installToolbarMenuClicks } from '@/background/modules/toolbar-menu';

const { openWorkspaceIntent, settings, keyListeners } = vi.hoisted(() => ({
  openWorkspaceIntent: vi.fn(() => Promise.resolve({ ok: true, tabId: 1, path: 'warm' })),
  settings: new Map<string, unknown>(),
  keyListeners: new Map<string, () => void>(),
}));

vi.mock('@/background/modules/workspace/workspace-navigator', () => ({ openWorkspaceIntent }));
vi.mock('@/background/modules/workspace/workspace-store', () => ({ getActiveWorkspaceId: () => 'ws-john-doe' }));
vi.mock('@/background/modules/badge-manager', () => ({ extensionTranslator: () => (key: string) => key }));
vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: (key: string) => settings.get(key),
  set: (key: string, value: unknown) => {
    settings.set(key, value);
    keyListeners.get(key)?.();
  },
  subscribeKey: (key: string, fn: () => void) => {
    keyListeners.set(key, fn);
    return () => keyListeners.delete(key);
  },
}));

type ClickListener = (info: { menuItemId: string | number }, tab?: { windowId?: number }) => void;

const menus = {
  create: vi.fn((_props: chrome.contextMenus.CreateProperties, done?: () => void) => done?.()),
  update: vi.fn(() => Promise.resolve()),
  removeAll: vi.fn(() => Promise.resolve()),
  onClicked: { addListener: vi.fn<(listener: ClickListener) => void>() },
};
const host = chrome as unknown as { contextMenus?: typeof menus };

function created(): chrome.contextMenus.CreateProperties[] {
  return menus.create.mock.calls.map(([props]) => props);
}

function click(menuItemId: string, tab?: { windowId?: number }): void {
  installToolbarMenuClicks();
  const listener = menus.onClicked.addListener.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('expected a click listener');
  listener({ menuItemId }, tab);
}

beforeEach(() => {
  host.contextMenus = menus;
  settings.clear();
  settings.set('rulesEngine.paused', false);
  keyListeners.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  delete host.contextMenus;
});

describe('buildToolbarMenu', () => {
  it('rebuilds from scratch: five top-level items on the action context, in order', async () => {
    await buildToolbarMenu();
    expect(menus.removeAll).toHaveBeenCalledOnce();
    const topLevel = created().filter((props) => props.parentId === undefined);
    expect(topLevel.map((props) => props.title)).toEqual([
      'extension.toolbarMenu.openWorkspace',
      'extension.toolbarMenu.settings',
      'extension.toolbarMenu.pauseRules',
      'extension.toolbarMenu.notifications',
      'extension.toolbarMenu.help',
    ]);
    expect(created().every((props) => props.contexts?.length === 1 && props.contexts[0] === 'action')).toBe(true);
  });

  it('hangs documentation, what is new and the report under Help', async () => {
    await buildToolbarMenu();
    const help = created().find((props) => props.title === 'extension.toolbarMenu.help');
    const children = created().filter((props) => props.parentId !== undefined);
    expect(children.map((props) => props.title)).toEqual([
      'extension.toolbarMenu.documentation',
      'extension.toolbarMenu.whatsNew',
      'extension.toolbarMenu.reportProblem',
    ]);
    expect(children.every((props) => props.parentId === help?.id)).toBe(true);
  });

  it('titles the pause item from the setting, and retitles it when the setting flips', async () => {
    settings.set('rulesEngine.paused', true);
    await buildToolbarMenu();
    const pause = created().find((props) => props.title === 'extension.toolbarMenu.resumeRules');
    expect(pause).toBeDefined();
    settings.set('rulesEngine.paused', false);
    keyListeners.get('rulesEngine.paused')?.();
    expect(menus.update).toHaveBeenLastCalledWith(pause?.id, { title: 'extension.toolbarMenu.pauseRules' });
  });

  it('does nothing on a browser without the menus API', async () => {
    delete host.contextMenus;
    await expect(buildToolbarMenu()).resolves.toBeUndefined();
    expect(menus.create).not.toHaveBeenCalled();
  });
});

describe('toolbar menu clicks', () => {
  it('the pause item flips the pause setting', async () => {
    await buildToolbarMenu();
    const pause = created().find((props) => props.title === 'extension.toolbarMenu.pauseRules');
    click(String(pause?.id));
    expect(settings.get('rulesEngine.paused')).toBe(true);
    expect(openWorkspaceIntent).not.toHaveBeenCalled();
  });

  it.each([
    ['extension.toolbarMenu.openWorkspace', { kind: 'open-workspace' }],
    ['extension.toolbarMenu.settings', { kind: 'open-settings' }],
    ['extension.toolbarMenu.notifications', { kind: 'open-notifications' }],
    ['extension.toolbarMenu.documentation', { kind: 'open-docs', section: 'rules' }],
    ['extension.toolbarMenu.whatsNew', { kind: 'open-whats-new' }],
    ['extension.toolbarMenu.reportProblem', { kind: 'open-report-issue' }],
  ] as const)('%s opens its workspace destination in the clicked window', async (title, intent) => {
    await buildToolbarMenu();
    const item = created().find((props) => props.title === title);
    click(String(item?.id), { windowId: 42 });
    expect(openWorkspaceIntent).toHaveBeenCalledExactlyOnceWith(intent, {
      callerWorkspaceId: 'ws-john-doe',
      callerWindowId: 42,
    });
  });

  it('ignores an item it does not own', () => {
    click('someone-elses-item');
    expect(openWorkspaceIntent).not.toHaveBeenCalled();
  });
});
