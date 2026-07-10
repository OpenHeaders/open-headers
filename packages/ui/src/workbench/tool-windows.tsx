/**
 * Tool-window registry for the workbench.html shell.
 *
 * The registry is the single source of truth for which tool windows exist,
 * where they live by default, whether they can be hidden, and how they are
 * presented (icon + label). useToolLayout uses this to seed a fresh profile,
 * to validate persisted state on load, and to restore hidden windows to a
 * sensible slot when the user un-hides them.
 */

import {
  BookOutlined,
  DashboardOutlined,
  FundViewOutlined,
  ScanOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import { DOCK_LABELS as _LABELS, type ToolWindowDef as GenericToolWindowDef } from '@openheaders/ui/shared/dock-layout';
import ActivityFeedIcon from './components/panels/ActivityFeedIcon';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon } from '@openheaders/ui/shared/icons';
import { NotificationsIcon } from '@openheaders/ui/shared/notifications';
import type { ToolWindowId } from './types';

export type ToolWindowDef = GenericToolWindowDef<ToolWindowId>;

/**
 * Default slot layout:
 *   - Left pane hosts the authoring surfaces: `http-rules` (core) on
 *     `left-top`, with `workflows` and `api-requests` on `left-bottom`.
 *   - Right pane hosts the inspectors that annotate the active tab:
 *     `right-top` stacks `notifications` and `docs`; `right-bottom`
 *     stacks `var-scope` and `variables` (collapsed by default).
 *
 * `var-scope` is the inspector that shows variables referenced in the
 * active rule + all scopes resolved against current env/workspace/vault
 * state. Surfaced as "Variable Scope" to disambiguate from the
 * "Variables" library — Variables is the catalogue (what exists),
 * Variable Scope is what's actually in scope for the current tab.
 */
export const TOOL_WINDOWS: readonly ToolWindowDef[] = [
  { id: 'http-rules', label: 'HTTP Rules', icon: <RequestRulesIcon />, core: true, defaultSlot: 'left-top' },
  // A Workflow is the scheduled-refresh variable producer: a request
  // chain + extraction rule. Its output surfaces as a `{{live.X}}`
  // reference in the Scope panel's Live category via a Live Variable
  // binding. First-class left-bottom tab so users see it as a feature
  // rather than a Variables sub-section. `api-requests` sits below it,
  // just above the Workflow Status chip on the rail.
  { id: 'workflows', label: 'Workflows', icon: <SisternodeOutlined />, core: false, defaultSlot: 'left-bottom' },
  { id: 'api-requests', label: 'API Requests', icon: <ApiRequestsIcon />, core: false, defaultSlot: 'left-bottom' },
  // Registry order within a slot is the slot's tab order on first
  // open. `right-top` runs `notifications` then `docs`; `right-bottom`
  // runs `var-scope` (active by default) then `variables`.
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <NotificationsIcon />,
    // Core: notifications must stay reachable — hiding the tab would
    // silently cut the user off from surfaced problems.
    core: true,
    defaultSlot: 'right-top',
  },
  { id: 'docs', label: 'Docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  { id: 'var-scope', label: 'Variable Scope', icon: <ScanOutlined />, core: false, defaultSlot: 'right-bottom' },
  { id: 'variables', label: 'Variables', icon: <VariablesIcon />, core: false, defaultSlot: 'right-bottom' },
  // Per-workflow circuit-breaker dashboard (state, consecutive
  // failures, openings, next-attempt countdown, manual Retry /
  // Reset-circuit actions).
  {
    id: 'workflow-status',
    label: 'Workflow Status',
    icon: <DashboardOutlined />,
    core: false,
    defaultSlot: 'bottom-left',
  },
  // Workspace-wide Activity Feed — inbound mutation log with classifier
  // highlights (sensitive-field rotations, permission-scope expansions,
  // local-edit supersedes). Bottom-right slot pairs it with Deep Network Inspection
  // so both inbound surfaces sit together; `openByDefault` is false so
  // the panel stays dormant until the user opens it via Shift+Alt+A or
  // the bar icon — discoverability rides the badge instead.
  {
    id: 'activity',
    label: 'Activity',
    tooltip: 'Activity Feed — inbound changes from peers',
    icon: <ActivityFeedIcon />,
    core: false,
    defaultSlot: 'bottom-right',
    openByDefault: false,
  },
  {
    id: 'deep-network-inspection',
    label: 'Deep Network Inspection',
    icon: <FundViewOutlined />,
    core: false,
    defaultSlot: 'bottom-right',
    openByDefault: false,
  },
];

export const TOOL_WINDOW_MAP: Record<ToolWindowId, ToolWindowDef> = TOOL_WINDOWS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<ToolWindowId, ToolWindowDef>,
);

// Re-export the subset of shared dock-layout constants that workbench
// surfaces consume directly via `../tool-windows`. Keeping this alias
// lets `StatusBar.tsx` import `DOCK_LABELS` alongside `TOOL_WINDOW_MAP`
// without reaching into `@openheaders/ui/shared/dock-layout` explicitly.
export const DOCK_LABELS = _LABELS;
