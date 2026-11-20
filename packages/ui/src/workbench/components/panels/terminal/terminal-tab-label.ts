/**
 * A terminal tab's label, and the label of the tab that holds a given
 * pty session — for a surface outside the terminal that names a session
 * the way its tab does (the activity monitor plan §6, law 12).
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useCallback } from 'react';
import { useSettingValue } from '../../../settings/hooks';
import { getWorkbenchTerminalTabs, type TerminalTabInfo } from './terminal-instance';

export function terminalTabLabel(t: Translate, tab: TerminalTabInfo, defaultName = ''): string {
  if (tab.title !== undefined) return tab.title;
  const custom = defaultName.trim();
  if (custom.length > 0) return tab.titleIndex === 1 ? custom : `${custom} (${tab.titleIndex})`;
  return tab.titleIndex === 1
    ? t('workbench.terminal.tabLocal')
    : t('workbench.terminal.tabLocalN', { n: tab.titleIndex });
}

/**
 * The label of the tab whose shell is the session, read from the tab
 * registry when it is asked — a rename shows at the caller's next
 * render. null where no tab of this document holds the session: it has
 * ended, or it belongs to another window.
 */
export function useTerminalSessionLabel(): (sessionId: string) => string | null {
  const t = useT();
  const defaultTabName = useSettingValue('terminal.defaultTabName');
  return useCallback(
    (sessionId) => {
      const tab = getWorkbenchTerminalTabs()?.tabForSession(sessionId) ?? null;
      return tab === null ? null : terminalTabLabel(t, tab, defaultTabName);
    },
    [t, defaultTabName],
  );
}
