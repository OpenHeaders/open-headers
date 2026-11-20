/**
 * Where a service row's reveal arrow leads (the activity monitor plan
 * §7, fork 6): the surface that owns the service — a tool window or a
 * Settings category. Reveal fronts it; nothing is confirmed and
 * nothing ends. Kept apart from the panel so the shell reads the map
 * without loading the panel.
 */

import type { ActivityMonitorServiceKind } from '@openheaders/core/activity-monitor';
import type { MessageKey } from '@openheaders/i18n';
import type { ToolWindowId } from '../../../types';

export type ServiceRevealTarget =
  | { toolWindow: ToolWindowId; labelKey: MessageKey }
  | { settingsCategory: string; labelKey: MessageKey };

export const SERVICE_REVEAL_TARGETS: Record<ActivityMonitorServiceKind, ServiceRevealTarget> = {
  'sync-server': { settingsCategory: 'backend', labelKey: 'workbench.settings.category.backend.label' },
  workflows: { toolWindow: 'workflow-status', labelKey: 'workbench.toolWindows.workflowStatus' },
  git: { toolWindow: 'git', labelKey: 'workbench.toolWindows.git' },
  // The switch lives on the group's Access page; the arrow names the group a person knows.
  'mcp-server': { settingsCategory: 'mcpAccess', labelKey: 'workbench.settings.category.mcp.label' },
  'proxy-capture': { toolWindow: 'traffic-monitor', labelKey: 'workbench.toolWindows.trafficMonitor' },
};
