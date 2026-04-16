/**
 * Tool-window registry for the DevTools Inspector panel.
 *
 * Uses shared dock types from @/shared/dock-layout. The panel-specific
 * window IDs and their icons/labels/default slots are defined here.
 */

import { AuditOutlined, BookOutlined, CodeOutlined, GlobalOutlined, SearchOutlined } from '@ant-design/icons';
import type {
  DockSlot,
  DockState as GenericDockState,
  ToolLayoutState as GenericToolLayoutState,
  ToolWindowDef as GenericToolWindowDef,
  ToolRegion,
} from '@/shared/dock-layout';
import { ALL_DOCK_SLOTS, DOCK_LABELS, dockRegion } from '@/shared/dock-layout';

export type PanelToolWindowId = 'network' | 'rules' | 'search' | 'docs' | 'console';
export type PanelDockSlot = DockSlot;
export type PanelToolRegion = ToolRegion;
export type PanelDockState = GenericDockState<PanelToolWindowId>;
export type PanelToolLayoutState = GenericToolLayoutState<PanelToolWindowId>;

export type PanelToolWindowDef = GenericToolWindowDef<PanelToolWindowId>;

export const PANEL_TOOL_WINDOWS: readonly PanelToolWindowDef[] = [
  { id: 'network', label: 'Network', icon: <GlobalOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'rules', label: 'Rules', icon: <AuditOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'search', label: 'Search', icon: <SearchOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'console', label: 'Console', icon: <CodeOutlined />, core: false, defaultSlot: 'bottom-right' },
];

export const PANEL_TOOL_WINDOW_MAP: Record<PanelToolWindowId, PanelToolWindowDef> = PANEL_TOOL_WINDOWS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<PanelToolWindowId, PanelToolWindowDef>,
);

// Re-export shared constants for backwards compatibility.
export const ALL_PANEL_DOCK_SLOTS = ALL_DOCK_SLOTS;
export const PANEL_DOCK_LABELS = DOCK_LABELS;
export const panelDockRegion = dockRegion;
