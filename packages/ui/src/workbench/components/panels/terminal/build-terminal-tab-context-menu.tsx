/**
 * build-terminal-tab-context-menu — the pure Ant Design menu-item
 * factory for a terminal tab's right-click menu. Mirrors the editor tab
 * strip's menu (same labels, same close family, same layout icons)
 * minus the items with no terminal meaning (duplicate, unmodified,
 * splits) and plus Rename — the IDE "Rename Session" posture.
 */

import { EditOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import LayoutMenuIcon from '../../shell/LayoutMenuIcon';

const menuIconWrap = (node: React.ReactNode) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 18,
    }}
  >
    {node}
  </span>
);

interface BuildTerminalTabContextMenuOptions {
  tabId: string;
  tabIndex: number;
  tabCount: number;
  onRename: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
}

export function buildTerminalTabContextMenu(
  { tabId, tabIndex, tabCount, onRename, onClose, onCloseOther, onCloseAll, onCloseToLeft, onCloseToRight }:
    BuildTerminalTabContextMenuOptions,
  t: Translate,
): { items: ItemType[] } {
  return {
    items: [
      {
        key: 'rename',
        label: t('workbench.terminal.menu.rename'),
        icon: menuIconWrap(<EditOutlined />),
        onClick: () => onRename(tabId),
      },
      { type: 'divider' as const },
      { key: 'close', label: t('workbench.tabbar.menu.close'), onClick: () => onClose(tabId) },
      {
        key: 'close-other',
        label: t('workbench.tabbar.menu.closeOther'),
        disabled: tabCount <= 1,
        onClick: () => onCloseOther(tabId),
      },
      { key: 'close-all', label: t('workbench.tabbar.menu.closeAll'), onClick: () => onCloseAll() },
      { type: 'divider' as const },
      {
        key: 'close-left',
        label: t('workbench.tabbar.menu.closeLeft'),
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-left" />),
        disabled: tabIndex === 0,
        onClick: () => onCloseToLeft(tabId),
      },
      {
        key: 'close-right',
        label: t('workbench.tabbar.menu.closeRight'),
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-right" />),
        disabled: tabIndex === tabCount - 1,
        onClick: () => onCloseToRight(tabId),
      },
    ],
  };
}
