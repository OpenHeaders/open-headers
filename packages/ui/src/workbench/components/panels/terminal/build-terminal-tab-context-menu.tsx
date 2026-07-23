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
  onSplitAndMove: (tabId: string, direction: 'left' | 'right' | 'top' | 'bottom') => void;
  onMoveToOppositeGroup: (tabId: string) => void;
  oppositeDirection: 'left' | 'right' | 'up' | 'down' | null;
  parentOrientation: 'horizontal' | 'vertical' | null;
  onChangeSplitterOrientation: () => void;
  onUnsplit: () => void;
  onUnsplitAll: () => void;
  canUnsplit: boolean;
  canUnsplitAll: boolean;
}

export function buildTerminalTabContextMenu(
  {
    tabId,
    tabIndex,
    tabCount,
    onRename,
    onClose,
    onCloseOther,
    onCloseAll,
    onCloseToLeft,
    onCloseToRight,
    onSplitAndMove,
    onMoveToOppositeGroup,
    oppositeDirection,
    parentOrientation,
    onChangeSplitterOrientation,
    onUnsplit,
    onUnsplitAll,
    canUnsplit,
    canUnsplitAll,
  }: BuildTerminalTabContextMenuOptions,
  t: Translate,
): { items: ItemType[] } {
  const splitDisabled = tabCount < 2;
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
      { type: 'divider' as const },
      {
        key: 'split-and-move',
        label: t('workbench.tabbar.menu.splitAndMove'),
        disabled: splitDisabled,
        children: [
          {
            key: 'split-move-right',
            label: t('workbench.tabbar.menu.right'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-right" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMove(tabId, 'right'),
          },
          {
            key: 'split-move-left',
            label: t('workbench.tabbar.menu.left'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-left" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMove(tabId, 'left'),
          },
          {
            key: 'split-move-down',
            label: t('workbench.tabbar.menu.down'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-down" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMove(tabId, 'bottom'),
          },
          {
            key: 'split-move-up',
            label: t('workbench.tabbar.menu.up'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-up" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMove(tabId, 'top'),
          },
        ],
      },
      ...(oppositeDirection
        ? [
            {
              key: 'move-opposite',
              label: t('workbench.tabbar.menu.moveOpposite'),
              icon: menuIconWrap(
                <LayoutMenuIcon
                  kind={
                    oppositeDirection === 'right'
                      ? 'split-right'
                      : oppositeDirection === 'left'
                        ? 'split-left'
                        : oppositeDirection === 'down'
                          ? 'split-down'
                          : 'split-up'
                  }
                />,
              ),
              onClick: () => onMoveToOppositeGroup(tabId),
            } satisfies ItemType,
          ]
        : []),
      {
        key: 'flip-orientation',
        label: t('workbench.tabbar.menu.changeSplitterOrientation'),
        icon: parentOrientation
          ? menuIconWrap(
              <LayoutMenuIcon kind={parentOrientation === 'horizontal' ? 'split-horizontal' : 'split-vertical'} />,
            )
          : undefined,
        disabled: !canUnsplit,
        onClick: () => onChangeSplitterOrientation(),
      },
      {
        key: 'unsplit',
        label: t('workbench.tabbar.menu.unsplit'),
        icon: parentOrientation
          ? menuIconWrap(
              <LayoutMenuIcon kind={parentOrientation === 'horizontal' ? 'unsplit-horizontal' : 'unsplit-vertical'} />,
            )
          : undefined,
        disabled: !canUnsplit,
        onClick: () => onUnsplit(),
      },
      ...(canUnsplitAll
        ? [
            {
              key: 'unsplit-all',
              label: t('workbench.tabbar.menu.unsplitAll'),
              icon: menuIconWrap(<LayoutMenuIcon kind="unsplit-all" />),
              onClick: () => onUnsplitAll(),
            } satisfies ItemType,
          ]
        : []),
    ],
  };
}
