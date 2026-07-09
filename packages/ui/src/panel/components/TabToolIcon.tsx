/**
 * TabToolIcon — the dock tool window an inspector tab was opened from,
 * rendered as the pill's leading icon so mixed tab bars (network
 * requests next to storage documents) tell apart at a glance. Reuses
 * the dock registry's own icons so a tab always carries the exact
 * glyph of its source window.
 */

import type React from 'react';
import type { InspectorTab } from '../data/inspector-tab';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from '../data/tool-windows';

/** The tool window a tab's document kind belongs to. */
export function tabToolWindowId(tab: InspectorTab): PanelToolWindowId {
  return tab.kind === 'request' ? 'network' : 'storage';
}

export const TabToolIcon: React.FC<{ tab: InspectorTab; style?: React.CSSProperties }> = ({ tab, style }) => (
  <span className="dt-editor-tab-tool-icon" style={style}>
    {PANEL_TOOL_WINDOW_MAP[tabToolWindowId(tab)].icon}
  </span>
);
