/**
 * SelectionContextMenu — floating right-click menu for a text
 * selection, portal'd to `document.body` at the cursor position.
 *
 * Pure presenter: the caller supplies AntD menu items (each item's
 * `onClick` performs the action); this component owns placement
 * (viewport-clamped), outside-click / Esc dismissal, and closing after
 * any item click.
 */

import { Menu, type MenuProps, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 220;
const ITEM_HEIGHT = 32;

export interface SelectionContextMenuProps {
  x: number;
  y: number;
  items: NonNullable<MenuProps['items']>;
  onClose: () => void;
}

const SelectionContextMenu: React.FC<SelectionContextMenuProps> = ({ x, y, items, onClose }) => {
  const { token } = theme.useToken();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Viewport clamp from an item-count estimate — enough to keep the
  // menu on-screen next to grid rows near the window edges.
  const estimatedHeight = items.length * ITEM_HEIGHT + 8;
  const left = Math.max(4, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(4, Math.min(y, window.innerHeight - estimatedHeight - 8));

  return createPortal(
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: MENU_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        overflow: 'hidden',
      }}
    >
      <Menu
        selectable={false}
        items={items}
        onClick={() => onClose()}
        style={{ border: 'none', background: 'transparent' }}
      />
    </div>,
    document.body,
  );
};

export default SelectionContextMenu;
