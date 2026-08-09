/**
 * Checkable-menu convention for the Git tool window's option menus
 * (IDE reference): a ✓ prefix marks the enabled state — highlight is
 * hover-only, never persisted. Unchecked items reserve the glyph's
 * width so labels stay aligned.
 */

import { CheckOutlined } from '@ant-design/icons';
import type React from 'react';

export function menuCheckIcon(checked: boolean): React.ReactNode {
  if (checked) return <CheckOutlined style={{ fontSize: 11 }} />;
  return <span aria-hidden style={{ display: 'inline-block', width: 11 }} />;
}
