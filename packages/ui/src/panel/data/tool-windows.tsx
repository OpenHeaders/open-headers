/**
 * Tool-window registry for the DevTools Inspector panel.
 *
 * Uses shared dock types from @openheaders/ui/shared/dock-layout. The panel-specific
 * window IDs and their icons/labels/default slots are defined here.
 */

import { AuditOutlined, BookOutlined, DatabaseOutlined, GlobalOutlined, SearchOutlined } from '@ant-design/icons';
import type {
  DockSlot,
  DockState as GenericDockState,
  ToolLayoutState as GenericToolLayoutState,
  ToolWindowDef as GenericToolWindowDef,
  ToolRegion,
} from '@openheaders/ui/shared/dock-layout';
import { ALL_DOCK_SLOTS, DOCK_LABELS, dockRegion } from '@openheaders/ui/shared/dock-layout';
import { RequestRulesIcon } from '@openheaders/ui/shared/icons';
import { NotificationsIcon } from '@openheaders/ui/shared/notifications';
import { ConsoleIcon } from './tool-window-icons';

export type PanelToolWindowId =
  | 'network'
  | 'console'
  | 'storage'
  | 'rules'
  | 'search'
  | 'notifications'
  | 'docs'
  | 'matched-rules';
export type PanelDockSlot = DockSlot;
export type PanelToolRegion = ToolRegion;
export type PanelDockState = GenericDockState<PanelToolWindowId>;
export type PanelToolLayoutState = GenericToolLayoutState<PanelToolWindowId>;

export type PanelToolWindowDef = GenericToolWindowDef<PanelToolWindowId>;

export const PANEL_TOOL_WINDOWS: readonly PanelToolWindowDef[] = [
  // Registry order within a slot is the slot's tab order on first
  // open. Left rail: `network` alone on top, then `storage` /
  // `console` / `search`, with `rules` on the bottom dock. Right
  // rail: `notifications` on top, `docs` below, `matched-rules` on
  // the bottom dock.
  { id: 'network', label: 'Network', icon: <GlobalOutlined />, core: true, defaultSlot: 'left-top' },
  { id: 'storage', label: 'Storage', icon: <DatabaseOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'console', label: 'Console', icon: <ConsoleIcon />, core: false, defaultSlot: 'left-bottom' },
  { id: 'search', label: 'Search', icon: <SearchOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon />, core: false, defaultSlot: 'right-top' },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-bottom' },
  { id: 'rules', label: 'Rule Activity', icon: <AuditOutlined />, core: false, defaultSlot: 'bottom-left' },
  {
    id: 'matched-rules',
    label: 'Matched Rules',
    icon: <RequestRulesIcon />,
    core: false,
    defaultSlot: 'bottom-right',
  },
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
