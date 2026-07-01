/**
 * MenuItemShortcutLabel — standard label layout for Ant Design menu
 * items whose action is also bound to a keyboard shortcut.
 *
 * Why: menu items declared in antd drop their shortcut hint on the
 * floor by default — there's no first-class `shortcut` field on
 * `ItemType`. We used to scatter `useShortcutLabel('id')` calls across
 * every consumer and hand-roll the flex layout, which meant half the
 * eligible menus showed no hint at all and the ones that did were
 * visually inconsistent.
 *
 * This component resolves the chord reactively from
 * `useShortcutLabel` and renders `[text] [right-aligned chord]`, so a
 * menu item builder can pass it as the `label` and be done:
 *
 *   { key: 'close', label: <MenuItemShortcutLabel id="close-tab">Close</MenuItemShortcutLabel>, ... }
 *
 * For builders that don't have JSX in scope (e.g. tests), the
 * `menuItemLabel(text, id?)` factory below returns the same node and
 * also acts as an identity for plain strings when `id` is omitted.
 */

import type React from 'react';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';

interface MenuItemShortcutLabelProps {
  /** Workspace shortcut id (see `useWorkspaceShortcuts.SHORTCUTS`). */
  id: string;
  /** Menu item text. */
  children: React.ReactNode;
}

export const MenuItemShortcutLabel: React.FC<MenuItemShortcutLabelProps> = ({ id, children }) => {
  const chord = useShortcutLabel(id);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        minWidth: 0,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      {chord && (
        <span
          style={{
            flexShrink: 0,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 11,
            opacity: 0.65,
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {chord}
        </span>
      )}
    </span>
  );
};

/**
 * Factory for menu-item labels. Returns a React node that a caller
 * can pass straight into an antd `ItemType.label`. When `shortcutId`
 * is omitted the factory returns the plain string unchanged, so
 * callers can use it everywhere without branching:
 *
 *   { key: 'close',     label: menuItemLabel('Close', 'close-tab') }
 *   { key: 'close-all', label: menuItemLabel('Close All Tabs') }
 */
export function menuItemLabel(text: string, shortcutId?: string): React.ReactNode {
  if (!shortcutId) return text;
  return <MenuItemShortcutLabel id={shortcutId}>{text}</MenuItemShortcutLabel>;
}
