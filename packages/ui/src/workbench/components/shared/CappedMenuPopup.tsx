/**
 * CappedMenuPopup — `popupRender` shell for Dropdown menus capped by
 * `usePopoverViewportFit`. The shell carries the elevated popup chrome
 * and scrolls the menu in an inner `.oh-persistent-scroll` div, so the
 * persistent scrollbar paints inside the rounded box (inset from the
 * corners by the shell's vertical padding) instead of being clipped by
 * the menu's own border-radius.
 */

import { theme } from 'antd';
import type React from 'react';
import { type CSSProperties, cloneElement, isValidElement, type ReactNode } from 'react';

interface CappedMenuPopupProps {
  /** The rendered menu node antd hands to `popupRender`. */
  menu: ReactNode;
  /** Room below the trigger, from `usePopoverViewportFit`; uncapped while unmeasured. */
  maxHeight: number | undefined;
  /** Optional sticky footer — rendered below the scroller (divider
   *  included) so it stays visible while the menu scrolls. */
  footer?: ReactNode;
}

const CappedMenuPopup: React.FC<CappedMenuPopupProps> = ({ menu, maxHeight, footer }) => {
  const { token } = theme.useToken();
  // The shell owns elevation + background; flatten the menu's so the
  // scroller doesn't drag a second shadowed box around. Menu padding
  // moves to horizontal-only — the shell's vertical padding replaces it,
  // keeping the scrollbar track clear of the rounded corners.
  const flatMenu = isValidElement<{ style?: CSSProperties }>(menu)
    ? cloneElement(menu, { style: { boxShadow: 'none', backgroundColor: 'transparent', padding: '0 4px' } })
    : menu;
  return (
    <div
      style={{
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '4px 0',
      }}
    >
      <div className="oh-persistent-scroll" style={maxHeight != null ? { maxHeight } : undefined}>
        {flatMenu}
      </div>
      {footer != null && (
        <div style={{ borderTop: `1px solid ${token.colorSplit}`, marginTop: 4, padding: '4px 4px 0' }}>{footer}</div>
      )}
    </div>
  );
};

export default CappedMenuPopup;
