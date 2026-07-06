/**
 * build-tab-context-menu — the pure Ant Design menu-item factory for a
 * tab's right-click context menu (Duplicate, the Close family, split-
 * and-move, change-orientation, unsplit). Every handler and split-state
 * flag arrives in one options bag so the tab strip builds a menu per tab
 * without inlining ~180 lines of item config at the Dropdown site.
 */

import { CheckOutlined, CopyOutlined, GlobalOutlined, PushpinOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
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
  /** Environments for the "Pin Environment" submenu. Absent / empty →
   *  the submenu still renders with "No environment" so pin-to-none
   *  stays reachable, but only when `onPinEnvironment` is wired. */
  environments?: ReadonlyArray<{ uid: string; name: string }>;
  /** Writes a tab's env pin: env uid, `null` = pin "No environment",
   *  `undefined` = unpin. */
  onPinEnvironment?: (tabId: string, envId: string | null | undefined) => void;
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

export function buildTabContextMenu({
  tab,
  tabIndex,
  tabCount,
  onDuplicate,
  environments,
  onPinEnvironment,
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
}: BuildTabContextMenuOptions): { items: ItemType[] } {
  const splitDisabled = tabCount < 2;
  // "Duplicate Tab" only applies to Rules and Requests — the copy
  // lands as a scratch (never live, never a stored draft) regardless
  // of whether the source was published or still drafting.
  const isDuplicable =
    tab.mode === 'edit' ||
    tab.mode === 'rule-create' ||
    tab.mode === 'request-edit' ||
    tab.mode === 'request-create';
  // "Pin Environment" applies to the same entity-editor modes: a pinned
  // tab takes over the active environment while focused (clicking the
  // currently pinned entry toggles it off). Distinct from the env
  // selector's "pin to collection" — this one is tab-scoped.
  const isPinnable = isDuplicable;
  const pinItems: ItemType[] =
    isPinnable && onPinEnvironment
      ? [
          {
            key: 'pin-env',
            label: 'Pin Environment',
            icon: menuIconWrap(<PushpinOutlined />),
            children: [
              ...(environments ?? []).map(
                (env) =>
                  ({
                    key: `pin-env-${env.uid}`,
                    label: env.name,
                    icon: menuIconWrap(tab.pinnedEnvId === env.uid ? <CheckOutlined /> : null),
                    onClick: () => onPinEnvironment(tab.id, tab.pinnedEnvId === env.uid ? undefined : env.uid),
                  }) satisfies ItemType,
              ),
              {
                key: 'pin-env-none',
                label: 'No environment',
                icon: menuIconWrap(tab.pinnedEnvId === null ? <CheckOutlined /> : <GlobalOutlined />),
                onClick: () => onPinEnvironment(tab.id, tab.pinnedEnvId === null ? undefined : null),
              },
              ...(tab.pinnedEnvId !== undefined
                ? [
                    { type: 'divider' as const },
                    {
                      key: 'pin-env-unpin',
                      label: 'Unpin',
                      onClick: () => onPinEnvironment(tab.id, undefined),
                    } satisfies ItemType,
                  ]
                : []),
            ],
          } satisfies ItemType,
        ]
      : [];
  return {
    items: [
      ...(isDuplicable && onDuplicate
        ? [
            {
              key: 'duplicate',
              label: 'Duplicate Tab',
              icon: menuIconWrap(<CopyOutlined />),
              onClick: () => onDuplicate(tab.id),
            } satisfies ItemType,
          ]
        : []),
      ...pinItems,
      ...((isDuplicable && onDuplicate) || pinItems.length > 0 ? [{ type: 'divider' as const }] : []),
      { key: 'close', label: menuItemLabel('Close', 'close-tab'), onClick: () => onClose(tab.id) },
      {
        key: 'close-other',
        label: 'Close Other Tabs',
        disabled: tabCount <= 1,
        onClick: () => onCloseOther(tab.id),
      },
      { key: 'close-all', label: 'Close All Tabs', onClick: () => onCloseAll() },
      { key: 'close-unmodified', label: 'Close Unmodified Tabs', onClick: () => onCloseUnmodified() },
      { type: 'divider' as const },
      {
        key: 'close-left',
        label: 'Close Tabs to the Left',
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-left" />),
        disabled: tabIndex === 0,
        onClick: () => onCloseToLeft(tab.id),
      },
      {
        key: 'close-right',
        label: 'Close Tabs to the Right',
        icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-right" />),
        disabled: tabIndex === tabCount - 1,
        onClick: () => onCloseToRight(tab.id),
      },
      { type: 'divider' as const },
      {
        key: 'split-and-move',
        label: 'Split and Move',
        disabled: splitDisabled,
        children: [
          {
            key: 'split-move-right',
            label: 'Right',
            icon: menuIconWrap(<LayoutMenuIcon kind="split-right" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveRight?.(tab.id),
          },
          {
            key: 'split-move-left',
            label: 'Left',
            icon: menuIconWrap(<LayoutMenuIcon kind="split-left" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveLeft?.(tab.id),
          },
          {
            key: 'split-move-down',
            label: 'Down',
            icon: menuIconWrap(<LayoutMenuIcon kind="split-down" />),
            disabled: splitDisabled,
            onClick: () => onSplitAndMoveDown?.(tab.id),
          },
          {
            key: 'split-move-up',
            label: 'Up',
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
              label: 'Move To Opposite Group',
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
        label: 'Change Splitter Orientation',
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
        label: 'Unsplit',
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
              label: 'Unsplit All',
              icon: menuIconWrap(<LayoutMenuIcon kind="unsplit-all" />),
              onClick: () => onUnsplitAll?.(),
            } satisfies ItemType,
          ]
        : []),
    ],
  };
}
