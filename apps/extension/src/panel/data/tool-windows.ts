/**
 * Tool-window registry for the DevTools Inspector panel.
 * Same pattern as the workspace's tool-windows.tsx.
 */

import type React from 'react';

export type PanelDockSlot = 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom' | 'bottom-left' | 'bottom-right';
export type PanelToolWindowId = 'network' | 'rules' | 'search' | 'docs' | 'console';
export type PanelToolRegion = 'left' | 'right' | 'bottom';

export interface PanelToolWindowDef {
  id: PanelToolWindowId;
  label: string;
  svgIcon: string;
  core: boolean;
  defaultSlot: PanelDockSlot;
}

export const PANEL_TOOL_WINDOWS: readonly PanelToolWindowDef[] = [
  { id: 'network', label: 'Network', svgIcon: 'network', core: true, defaultSlot: 'left-top' },
  { id: 'rules', label: 'Rules', svgIcon: 'rules', core: false, defaultSlot: 'left-bottom' },
  { id: 'search', label: 'Search', svgIcon: 'search', core: false, defaultSlot: 'bottom-left' },
  { id: 'docs', label: 'Docs', svgIcon: 'docs', core: false, defaultSlot: 'right-top' },
  { id: 'console', label: 'Console', svgIcon: 'console', core: false, defaultSlot: 'bottom-right' },
];

export const PANEL_TOOL_WINDOW_MAP: Record<PanelToolWindowId, PanelToolWindowDef> = PANEL_TOOL_WINDOWS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<PanelToolWindowId, PanelToolWindowDef>,
);

export const ALL_PANEL_DOCK_SLOTS: readonly PanelDockSlot[] = [
  'left-top',
  'left-bottom',
  'right-top',
  'right-bottom',
  'bottom-left',
  'bottom-right',
];

export const PANEL_DOCK_LABELS: Record<PanelDockSlot, string> = {
  'left-top': 'Left Top',
  'left-bottom': 'Left Bottom',
  'right-top': 'Right Top',
  'right-bottom': 'Right Bottom',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
};

export function panelDockRegion(slot: PanelDockSlot): PanelToolRegion {
  if (slot === 'left-top' || slot === 'left-bottom') return 'left';
  if (slot === 'right-top' || slot === 'right-bottom') return 'right';
  return 'bottom';
}

export function renderToolWindowIcon(svgIcon: string): React.ReactNode {
  // Returns null — icons are rendered inline in App.tsx via SVG elements
  return null;
}
