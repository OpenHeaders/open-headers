/**
 * build-tab-context-menu — the pure Ant Design menu-item factory for a
 * tab's right-click context menu (Duplicate, the Close family, split-
 * and-move, change-orientation, unsplit). Every handler and split-state
 * flag arrives in one options bag so the tab strip builds a menu per tab
 * without inlining ~180 lines of item config at the Dropdown site.
 */

import { CopyOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { WorkbenchTab } from '../../types';
import LayoutMenuIcon from '../shell/LayoutMenuIcon';
import { menuItemLabel } from '../shared/MenuItemShortcutLabel';

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

interface BuildTabContextMenuOptions {
  tab: WorkbenchTab;
  tabIndex: number;
  tabCount: number;
  onDuplicate?: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onSplitAndMoveRight?: (tabId: string) => void;
  onSplitAndMoveLeft?: (tabId: string) => void;
  onSplitAndMoveDown?: (tabId: string) => void;
  onSplitAndMoveUp?: (tabId: string) => void;
  onMoveToOppositeGroup?: (tabId: string) => void;
  oppositeDirection?: 'left' | 'right' | 'up' | 'down' | null;
  parentOrientation?: 'horizontal' | 'vertical' | null;
  onChangeSplitterOrientation?: () => void;
  onUnsplit?: () => void;
  onUnsplitAll?: () => void;
  canUnsplit?: boolean;
  canUnsplitAll?: boolean;
}

export function buildTabContextMenu(
  {
    tab,
    tabIndex,
    tabCount,
    onDuplicate,
    onClose,
    onCloseOther,
    onCloseAll,
    onCloseUnmodified,
    onCloseToLeft,
    onCloseToRight,
    onSplitAndMoveRight,
    onSplitAndMoveLeft,
    onSplitAndMoveDown,
    onSplitAndMoveUp,
    onMoveToOppositeGroup,
    oppositeDirection,
    parentOrientation,
    onChangeSplitterOrientation,
    onUnsplit,
    onUnsplitAll,
    canUnsplit,
    canUnsplitAll,
  }: BuildTabContextMenuOptions,
  t: Translate,
): { items: ItemType[] } {
  const splitDisabled = tabCount < 2;
  // "Duplicate Tab" only applies to Rules and Requests — the copy
  // lands as a scratch (never live, never a stored draft) regardless
  // of whether the source was published or still drafting.
  const isDuplicable =
    tab.mode === 'edit' ||
    tab.mode === 'rule-create' ||
    tab.mode === 'request-edit' ||
    tab.mode === 'request-create';
  return {
    items: [
      ...(isDuplicable && onDuplicate
        ? [
            {
              key: 'duplicate',
              label: t('workbench.tabbar.menu.duplicateTab'),
              icon: menuIconWrap(<CopyOutlined />),
              onClick: () => onDuplicate(tab.id),
            } satisfies ItemType,
            { type: 'divider' as const },
          ]
        : []),
      { key: 'close', label: menuItemLabel(t('workbench.tabbar.menu.close'), 'close-tab'), onClick: () => onClose(tab.id) },
      {
        key: 'close-other',
        label: t('workbench.tabbar.menu.closeOther'),
        disabled: tabCount <= 1,
        onClick: () => onCloseOther(tab.id),
      },
      { key: 'close-all', label: t('workbench.tabbar.menu.closeAll'), onClick: () => onCloseAll() },
      { key: 'close-unmodified', label: t('workbench.tabbar.menu.closeUnmodified'), onClick: () => onCloseUnmodified() },
      { type: 'divider' as const },
      {
        key: 'close-left',
        label: t('workbench.tabbar.menu.closeLeft'),
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-left" />),
        disabled: tabIndex === 0,
        onClick: () => onCloseToLeft(tab.id),
      },
      {
        key: 'close-right',
        label: t('workbench.tabbar.menu.closeRight'),
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-right" />),
        disabled: tabIndex === tabCount - 1,
        onClick: () => onCloseToRight(tab.id),
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
            onClick: () => onSplitAndMoveRight?.(tab.id),
          },
          {
            key: 'split-move-left',
            label: t('workbench.tabbar.menu.left'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-left" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveLeft?.(tab.id),
          },
          {
            key: 'split-move-down',
            label: t('workbench.tabbar.menu.down'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-down" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveDown?.(tab.id),
          },
          {
            key: 'split-move-up',
            label: t('workbench.tabbar.menu.up'),
            icon: menuIconWrap(<LayoutMenuIcon kind="split-up" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveUp?.(tab.id),
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
              onClick: () => onMoveToOppositeGroup?.(tab.id),
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
        onClick: () => onChangeSplitterOrientation?.(),
      },
      {
        key: 'unsplit',
        label: t('workbench.tabbar.menu.unsplit'),
        icon: parentOrientation
          ? menuIconWrap(
              <LayoutMenuIcon
                kind={parentOrientation === 'horizontal' ? 'unsplit-horizontal' : 'unsplit-vertical'}
              />,
            )
          : undefined,
        disabled: !canUnsplit,
        onClick: () => onUnsplit?.(),
      },
      ...(canUnsplitAll
        ? [
            {
              key: 'unsplit-all',
              label: t('workbench.tabbar.menu.unsplitAll'),
              icon: menuIconWrap(<LayoutMenuIcon kind="unsplit-all" />),
              onClick: () => onUnsplitAll?.(),
            } satisfies ItemType,
          ]
        : []),
    ],
  };
}
