/**
 * Tool-window registry for the DevTools Inspector panel.
 *
 * Uses shared dock types from @openheaders/ui/shared/dock-layout. The panel-specific
 * window IDs and their icons/label keys/default slots are defined here.
 */

import { AuditOutlined, BookOutlined, DatabaseOutlined, GlobalOutlined, SearchOutlined } from '@ant-design/icons';
import type {
  DockSlot,
  DockState as GenericDockState,
  ToolLayoutState as GenericToolLayoutState,
  ToolWindowDef as GenericToolWindowDef,
  ToolRegion,
} from '@openheaders/ui/shared/dock-layout';
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
  {
    id: 'network',
    labelKey: 'panel.toolWindows.network',
    icon: <GlobalOutlined />,
    core: true,
    defaultSlot: 'left-top',
  },
  {
    id: 'storage',
    labelKey: 'panel.toolWindows.storage',
    icon: <DatabaseOutlined />,
    core: false,
    defaultSlot: 'left-bottom',
  },
  {
    id: 'console',
    labelKey: 'panel.toolWindows.console',
    icon: <ConsoleIcon />,
    core: false,
    defaultSlot: 'left-bottom',
  },
  {
    id: 'search',
    labelKey: 'panel.toolWindows.search',
    icon: <SearchOutlined />,
    core: false,
    defaultSlot: 'left-bottom',
  },
  {
    id: 'notifications',
    labelKey: 'panel.toolWindows.notifications',
    icon: <NotificationsIcon />,
    core: false,
    defaultSlot: 'right-top',
  },
  { id: 'docs', labelKey: 'panel.toolWindows.docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-bottom' },
  {
    id: 'rules',
    labelKey: 'panel.toolWindows.ruleActivity',
    icon: <AuditOutlined />,
    core: false,
    defaultSlot: 'bottom-left',
  },
  {
    id: 'matched-rules',
    labelKey: 'panel.toolWindows.matchedRules',
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
