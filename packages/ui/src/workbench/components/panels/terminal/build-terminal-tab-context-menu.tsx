/**
 * build-terminal-tab-context-menu — the terminal flavor of the shared
 * pane-tab context menu: the shared close/split/unsplit family
 * (build-pane-tab-context-menu) with Rename prepended — the IDE
 * "Rename Session" posture.
 */

import { EditOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  type BuildPaneTabContextMenuOptions,
  buildPaneTabContextMenu,
  menuIconWrap,
} from '../pane-tabs/build-pane-tab-context-menu';

interface BuildTerminalTabContextMenuOptions extends Omit<BuildPaneTabContextMenuOptions, 'leading' | 'closeDisabled'> {
  onRename: (tabId: string) => void;
}

export function buildTerminalTabContextMenu(
  { onRename, ...shared }: BuildTerminalTabContextMenuOptions,
  t: Translate,
): { items: ItemType[] } {
  return buildPaneTabContextMenu(
    {
      ...shared,
      leading: [
        {
          key: 'rename',
          label: t('workbench.terminal.menu.rename'),
          icon: menuIconWrap(<EditOutlined />),
          onClick: () => onRename(shared.tabId),
        },
      ],
    },
    t,
  );
}
