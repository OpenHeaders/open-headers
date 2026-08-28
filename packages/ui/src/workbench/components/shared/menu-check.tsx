/**
 * Checkable-menu convention for option menus (IDE reference): a ✓ in
 * the icon slot marks the enabled state — highlight is hover-only,
 * never persisted. Unchecked items reserve the glyph's width so labels
 * stay aligned, and {@link menuIconGutter} reserves the same slot on
 * rows that carry neither a glyph nor a check, so every label in a
 * menu starts on one x.
 */

import { CheckOutlined } from '@ant-design/icons';
import type React from 'react';

export function menuIconGutter(): React.ReactNode {
  return <span aria-hidden style={{ display: 'inline-block', width: 11 }} />;
}

export function menuCheckIcon(checked: boolean): React.ReactNode {
  if (checked) return <CheckOutlined style={{ fontSize: 11 }} />;
  return menuIconGutter();
}
