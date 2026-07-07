/**
 * SelectionContextMenu — floating right-click menu for a text
 * selection, portal'd to `document.body` at the cursor position.
 *
 * Compact custom rows (12 px, 26 px line) rather than an AntD Menu —
 * a context menu reads as system chrome, not as navigation, so it
 * matches the snippets-popover density instead of the nav-menu one.
 *
 * Pure presenter: the caller supplies rows (each row's `onClick`
 * performs the action); this component owns placement (viewport-
 * clamped), outside-click / Esc dismissal, and closing after any row
 * click.
 */

import { theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 200;
const ROW_HEIGHT = 26;

export type SelectionMenuRow =
  | { type?: 'item'; key: string; label: string; disabled?: boolean; onClick: () => void }
  | { type: 'divider' };

export interface SelectionContextMenuProps {
  x: number;
  y: number;
  items: SelectionMenuRow[];
  onClose: () => void;
}

const SelectionContextMenu: React.FC<SelectionContextMenuProps> = ({ x, y, items, onClose }) => {
  const { token } = theme.useToken();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

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

  const estimatedHeight = items.reduce((h, row) => h + (row.type === 'divider' ? 9 : ROW_HEIGHT), 8);
  const left = Math.max(4, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(4, Math.min(y, window.innerHeight - estimatedHeight - 8));

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
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
        padding: 4,
      }}
    >
      {items.map((row, index) =>
        row.type === 'divider' ? (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: dividers carry no identity
            key={`divider-${index}`}
            style={{ height: 1, margin: '4px 6px', background: token.colorBorderSecondary }}
          />
        ) : (
          <button
            key={row.key}
            type="button"
            role="menuitem"
            disabled={row.disabled}
            onMouseEnter={() => setHoverKey(row.key)}
            onMouseLeave={() => setHoverKey((k) => (k === row.key ? null : k))}
            onClick={() => {
              if (row.disabled) return;
              row.onClick();
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              height: ROW_HEIGHT,
              padding: '0 10px',
              background: hoverKey === row.key && !row.disabled ? token.colorFillTertiary : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: row.disabled ? 'not-allowed' : 'pointer',
              color: row.disabled ? token.colorTextDisabled : token.colorText,
              fontSize: 12,
              lineHeight: `${ROW_HEIGHT}px`,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
};

export default SelectionContextMenu;
