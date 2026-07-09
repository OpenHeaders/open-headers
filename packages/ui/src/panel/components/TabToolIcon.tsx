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
import ResourceIcon from './traffic/ResourceIcon';

/** The tool window a tab's document kind belongs to. */
export function tabToolWindowId(tab: InspectorTab): PanelToolWindowId {
  return tab.kind === 'request' ? 'network' : 'storage';
}

/** Websocket pills swap the generic network globe for the request's own
 *  row icon — the upgraded connection is a distinct thing to track and
 *  should read the same in the tab bar as in the network list. */
function requestRowIconType(tab: InspectorTab): string | null {
  if (tab.kind !== 'request') return null;
  const rt = (tab.resourceType ?? '').toLowerCase();
  return rt === 'websocket' || rt === 'ws' ? rt : null;
}

export const TabToolIcon: React.FC<{ tab: InspectorTab; style?: React.CSSProperties }> = ({ tab, style }) => {
  const rowIconType = requestRowIconType(tab);
  return (
    <span className="dt-editor-tab-tool-icon" style={style}>
      {rowIconType !== null ? <ResourceIcon type={rowIconType} /> : PANEL_TOOL_WINDOW_MAP[tabToolWindowId(tab)].icon}
    </span>
  );
};
