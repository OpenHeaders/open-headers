/**
 * build-pane-tab-context-menu — the shared Ant Design menu-item
 * factory for a dock-panel tab's right-click menu, extracted from the
 * terminal builder (itself mirroring the editor tab strip): the close
 * family, Split and Move, Move To Opposite Group, splitter
 * orientation, and unsplit verbs. Panels prepend their own leading
 * items (the terminal's Rename) and gate Close per tab (the git log's
 * permanent primary tab).
 */

import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import LayoutMenuIcon from '../../shell/LayoutMenuIcon';

export const menuIconWrap = (node: React.ReactNode): React.ReactElement => (
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

export interface BuildPaneTabContextMenuOptions {
  tabId: string;
  tabIndex: number;
  tabCount: number;
  /** Items rendered before the close family (terminal: Rename). */
  leading?: ItemType[];
  /** Disables Close for this tab (permanent tabs); the bulk closes
   *  stay enabled — the panel's close-many handler skips permanents. */
  closeDisabled?: boolean;
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

export function buildPaneTabContextMenu(
  {
    tabId,
    tabIndex,
    tabCount,
    leading,
    closeDisabled = false,
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
  }: BuildPaneTabContextMenuOptions,
  t: Translate,
): { items: ItemType[] } {
  const splitDisabled = tabCount < 2;
  return {
    items: [
      ...(leading !== undefined && leading.length > 0 ? [...leading, { type: 'divider' as const }] : []),
      {
        key: 'close',
        label: t('workbench.tabbar.menu.close'),
        disabled: closeDisabled,
        onClick: () => onClose(tabId),
      },
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
