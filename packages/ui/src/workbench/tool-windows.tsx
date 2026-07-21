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
  BranchesOutlined,
  CodeOutlined,
  GlobalOutlined,
  ScanOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import type { DesktopFeature } from '@openheaders/ui/shared/desktop-teaser';
import type { ToolWindowDef as GenericToolWindowDef } from '@openheaders/ui/shared/dock-layout';
import ActivityFeedIcon from './components/panels/ActivityFeedIcon';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon, WorkflowStatusIcon } from '@openheaders/ui/shared/icons';
import { NotificationsIcon } from '@openheaders/ui/shared/notifications';
import type { ToolWindowId } from './types';

export type ToolWindowDef = GenericToolWindowDef<ToolWindowId>;

/**
 * Default slot layout:
 *   - Left pane hosts the authoring surfaces: `http-rules` (core) on
 *     `left-top`, with `api-requests` and `workflows` on `left-bottom`.
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
  {
    id: 'http-rules',
    labelKey: 'workbench.toolWindows.httpRules',
    icon: <RequestRulesIcon />,
    core: true,
    defaultSlot: 'left-top',
  },
  {
    id: 'api-requests',
    labelKey: 'workbench.toolWindows.apiRequests',
    icon: <ApiRequestsIcon />,
    core: false,
    defaultSlot: 'left-bottom',
  },
  // A Workflow is the scheduled-refresh variable producer: a request
  // chain + extraction rule. Its output surfaces as a `{{live.X}}`
  // reference in the Scope panel's Live category via a Live Variable
  // binding. First-class left-bottom tab (below `api-requests`) so
  // users see it as a feature rather than a Variables sub-section.
  {
    id: 'workflows',
    labelKey: 'workbench.toolWindows.workflows',
    icon: <SisternodeOutlined />,
    core: false,
    defaultSlot: 'left-bottom',
  },
  // Registry order within a slot is the slot's tab order on first
  // open. `right-top` runs `notifications` then `docs`; `right-bottom`
  // runs `var-scope` (active by default) then `variables`.
  {
    id: 'notifications',
    labelKey: 'workbench.toolWindows.notifications',
    icon: <NotificationsIcon />,
    // Core: notifications must stay reachable — hiding the tab would
    // silently cut the user off from surfaced problems.
    core: true,
    defaultSlot: 'right-top',
  },
  { id: 'docs', labelKey: 'workbench.toolWindows.docs', icon: <BookOutlined />, core: false, defaultSlot: 'right-top' },
  {
    id: 'var-scope',
    labelKey: 'workbench.toolWindows.varScope',
    icon: <ScanOutlined />,
    core: false,
    defaultSlot: 'right-bottom',
  },
  {
    id: 'variables',
    labelKey: 'workbench.toolWindows.variables',
    icon: <VariablesIcon />,
    core: false,
    defaultSlot: 'right-bottom',
  },
  // Bottom dock, left pane: the host-process surfaces (a shell, the
  // workspace tree's git plane). Bottom dock, right pane: the live
  // observability surfaces (capture feed, workflow health, activity).
  // The three capability-gated windows below declare
  // `teaserWhenUnavailable`, so browser hosts keep their tabs and
  // render the desktop teaser instead of dropping the feature from
  // the dock — discoverability over silence.
  //
  // Integrated terminal — a real pty running the user's shell,
  // supplied by the host through the `terminal` capability. Only pty
  // hosts (the desktop renderer) register it. Dormant until opened,
  // like the other bottom-dock panels.
  {
    id: 'terminal',
    labelKey: 'workbench.toolWindows.terminal',
    icon: <CodeOutlined />,
    core: false,
    defaultSlot: 'bottom-left',
    openByDefault: false,
    requiresCapability: 'terminal',
    teaserWhenUnavailable: 'terminal',
  },
  // The git log/history surface over the workspace-tree verb table
  // (GIT_PLAN.md §9) — commit timeline + per-commit detail for the
  // active workspace's binding. Only hosts whose bridge reaches a
  // workspace-tree runtime register `workspaceGit`. Dormant until
  // opened, like the other bottom-dock panels.
  {
    id: 'git',
    labelKey: 'workbench.toolWindows.git',
    icon: <BranchesOutlined />,
    core: false,
    defaultSlot: 'bottom-left',
    openByDefault: false,
    requiresCapability: 'workspaceGit',
    teaserWhenUnavailable: 'git',
  },
  // The unified observability surface (Observability epic): every
  // source's live view in ONE window — connected browser tabs streamed
  // through the daemon spine's telemetry relay, plus the L7 wire
  // capture with its control strip. Gated on `liveNetwork`; the wire
  // source additionally checks `proxyCapture` inside the panel — every
  // host that registers one registers both (the desktop renderer,
  // which runs the spine in-process). Dormant until opened.
  {
    id: 'traffic-monitor',
    labelKey: 'workbench.toolWindows.trafficMonitor',
    icon: <GlobalOutlined />,
    core: false,
    defaultSlot: 'bottom-right',
    openByDefault: false,
    requiresCapability: 'liveNetwork',
    teaserWhenUnavailable: 'liveNetwork',
  },
  // Per-workflow circuit-breaker dashboard (state, consecutive
  // failures, openings, next-attempt countdown, manual Retry /
  // Reset-circuit actions).
  {
    id: 'workflow-status',
    labelKey: 'workbench.toolWindows.workflowStatus',
    icon: <WorkflowStatusIcon />,
    core: false,
    defaultSlot: 'bottom-right',
  },
  // Workspace-wide Activity Feed — inbound mutation log with classifier
  // highlights (sensitive-field rotations, permission-scope expansions,
  // local-edit supersedes). `openByDefault` is false so the panel stays
  // dormant until the user opens it via Shift+Alt+A or the bar icon —
  // discoverability rides the badge instead.
  {
    id: 'activity',
    labelKey: 'workbench.toolWindows.activity',
    tooltipKey: 'workbench.toolWindows.activityTooltip',
    icon: <ActivityFeedIcon />,
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

/**
 * The registry as seen by THIS host — capability-gated windows drop
 * out when their capability isn't registered, unless they declare
 * `teaserWhenUnavailable` (then the tab stays and the panel body
 * renders the desktop teaser, see `WorkbenchToolWindow`). Must be
 * read at mount time, not module scope: hosts install capabilities
 * during boot, after module graphs evaluate.
 */
export function availableToolWindows(): readonly ToolWindowDef[] {
  return TOOL_WINDOWS.filter(
    (def) =>
      !def.requiresCapability || hasCapability(def.requiresCapability) || def.teaserWhenUnavailable !== undefined,
  );
}

/** Whether this host renders `def` as a desktop teaser instead of the
 *  real panel — gated, capability absent, teaser declared. */
export function isToolWindowTeased(
  def: ToolWindowDef,
): def is ToolWindowDef & { teaserWhenUnavailable: DesktopFeature } {
  return (
    def.teaserWhenUnavailable !== undefined &&
    def.requiresCapability !== undefined &&
    !hasCapability(def.requiresCapability)
  );
}

/** Lookup map over {@link availableToolWindows} — absent ids read as
 *  `undefined`, which is how the layout normalizer drops them. */
export function availableToolWindowMap(): Record<ToolWindowId, ToolWindowDef> {
  return availableToolWindows().reduce(
    (acc, def) => {
      acc[def.id] = def;
      return acc;
    },
    {} as Record<ToolWindowId, ToolWindowDef>,
  );
}
