/**
 * The toolbar button's right-click menu: the workspace, its settings, the
 * rules pause, notifications, and a Help submenu.
 *
 * Two halves, because a click must be able to wake the background:
 *
 *   - {@link installToolbarMenuClicks} registers the click listener at
 *     eval time, before anything is awaited.
 *   - {@link buildToolbarMenu} runs once settings are loaded. It rebuilds
 *     every item from scratch — correct whether or not the browser kept
 *     the previous start's items — and keeps the titles on the settings
 *     locale and the pause item on the pause setting.
 *
 * Five top-level items: browsers ignore a toolbar-menu item past their
 * limit (six on Chrome and Firefox).
 */

import type { WorkspaceIntent } from '@openheaders/core/workspace-intent';
import type { MessageKey, Translator } from '@openheaders/i18n';
import { get as getSetting, set as setSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { extensionTranslator } from './badge-manager';
import { openWorkspaceIntent } from './workspace/workspace-navigator';
import { getActiveWorkspaceId } from './workspace/workspace-store';

const PAUSE_ITEM_ID = 'oh-toolbar-pause';
const HELP_ITEM_ID = 'oh-toolbar-help';

interface IntentItem {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly intent: WorkspaceIntent;
  readonly parentId?: string;
}

const INTENT_ITEMS: readonly IntentItem[] = [
  { id: 'oh-toolbar-workspace', titleKey: 'extension.toolbarMenu.openWorkspace', intent: { kind: 'open-workspace' } },
  { id: 'oh-toolbar-settings', titleKey: 'extension.toolbarMenu.settings', intent: { kind: 'open-settings' } },
  {
    id: 'oh-toolbar-notifications',
    titleKey: 'extension.toolbarMenu.notifications',
    intent: { kind: 'open-notifications' },
  },
  {
    id: 'oh-toolbar-docs',
    titleKey: 'extension.toolbarMenu.documentation',
    intent: { kind: 'open-docs', section: 'rules' },
    parentId: HELP_ITEM_ID,
  },
  {
    id: 'oh-toolbar-whats-new',
    titleKey: 'extension.toolbarMenu.whatsNew',
    intent: { kind: 'open-whats-new' },
    parentId: HELP_ITEM_ID,
  },
  {
    id: 'oh-toolbar-report',
    titleKey: 'extension.toolbarMenu.reportProblem',
    intent: { kind: 'open-report-issue' },
    parentId: HELP_ITEM_ID,
  },
];

/** Top-level order as the menu shows it; Help's children follow their parent. */
const TOP_LEVEL_ORDER: readonly string[] = [
  'oh-toolbar-workspace',
  'oh-toolbar-settings',
  PAUSE_ITEM_ID,
  'oh-toolbar-notifications',
  HELP_ITEM_ID,
];

type Menus = typeof chrome.contextMenus;

/** The menus namespace under whichever name this browser exposes it. */
function getMenus(): Menus | null {
  const api: { contextMenus?: Menus; menus?: Menus } = getBrowserAPI();
  return api.contextMenus ?? api.menus ?? null;
}

function pauseTitle(t: Translator): string {
  return t(getSetting('rulesEngine.paused') ? 'extension.toolbarMenu.resumeRules' : 'extension.toolbarMenu.pauseRules');
}

function titleFor(id: string, t: Translator): string {
  if (id === PAUSE_ITEM_ID) return pauseTitle(t);
  if (id === HELP_ITEM_ID) return t('extension.toolbarMenu.help');
  const item = INTENT_ITEMS.find((candidate) => candidate.id === id);
  return item ? t(item.titleKey) : '';
}

function createItem(menus: Menus, id: string, title: string, parentId?: string): void {
  menus.create({ id, title, contexts: ['action'], ...(parentId !== undefined ? { parentId } : {}) }, () => {
    // Read so a refused item is logged here, not listed as an unchecked error.
    const error = getBrowserAPI().runtime.lastError;
    if (error) logger.info('ToolbarMenu', `item ${id} not created:`, error.message);
  });
}

function retitle(menus: Menus): void {
  const t = extensionTranslator();
  for (const id of [...TOP_LEVEL_ORDER, ...INTENT_ITEMS.filter((item) => item.parentId).map((item) => item.id)]) {
    void menus.update(id, { title: titleFor(id, t) });
  }
}

/** Register the click listener. Eval time only — see the module doc. */
export function installToolbarMenuClicks(): void {
  const menus = getMenus();
  if (!menus) return;
  menus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === PAUSE_ITEM_ID) {
      setSetting('rulesEngine.paused', !getSetting('rulesEngine.paused'));
      return;
    }
    const item = INTENT_ITEMS.find((candidate) => candidate.id === info.menuItemId);
    if (!item) return;
    void openWorkspaceIntent(item.intent, {
      callerWorkspaceId: getActiveWorkspaceId(),
      ...(typeof tab?.windowId === 'number' ? { callerWindowId: tab.windowId } : {}),
    }).catch((error: Error) => {
      logger.info('ToolbarMenu', `${item.id} failed:`, error.message);
    });
  });
}

/** Build the items and keep their titles live. Call once settings are loaded. */
export async function buildToolbarMenu(): Promise<void> {
  const menus = getMenus();
  if (!menus) {
    logger.info('ToolbarMenu', 'menus API unavailable — no toolbar menu');
    return;
  }
  await menus.removeAll();
  const t = extensionTranslator();
  for (const id of TOP_LEVEL_ORDER) createItem(menus, id, titleFor(id, t));
  for (const item of INTENT_ITEMS) {
    if (item.parentId !== undefined) createItem(menus, item.id, t(item.titleKey), item.parentId);
  }
  subscribeKey(
    'rulesEngine.paused',
    () => void menus.update(PAUSE_ITEM_ID, { title: pauseTitle(extensionTranslator()) }),
  );
  subscribeKey('general.language', () => retitle(menus));
}
