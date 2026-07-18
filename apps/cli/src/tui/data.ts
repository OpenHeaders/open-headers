/**
 * Dashboard data plane — the same tool calls `oh workspace/env/rules`
 * make, through an injected caller so the module stays transport-free
 * and unit-testable. Payload shapes come from format.ts (the CLI's
 * read view of the tool contract) — the TUI never grows a private
 * schema. Fetching is read-tier only; errors are classified by the
 * caller's own error types (UnreachableError/AuthError pass through).
 */

import type { EnvironmentsPayload, RulesPayload, WorkspacesPayload } from '../format';

export type ToolCaller = (tool: string, args: Record<string, unknown>) => Promise<string>;

export interface DashboardSnapshot {
  readonly workspaces: WorkspacesPayload;
  readonly environments: EnvironmentsPayload;
  readonly rules: RulesPayload;
}

/**
 * One poll: the three read tools in parallel, all defaulting to the
 * daemon's active workspace — exactly what the dashboard shows.
 */
export async function fetchDashboardSnapshot(call: ToolCaller): Promise<DashboardSnapshot> {
  const [workspacesText, environmentsText, rulesText] = await Promise.all([
    call('workspaces_list', {}),
    call('environments_list', {}),
    call('rules_list', {}),
  ]);
  return {
    workspaces: JSON.parse(workspacesText) as WorkspacesPayload,
    environments: JSON.parse(environmentsText) as EnvironmentsPayload,
    rules: JSON.parse(rulesText) as RulesPayload,
  };
}

export interface RuleDetail {
  readonly workspaceId: string;
  readonly rule: Record<string, unknown>;
  /** Pretty-printed full definition — the honest human view, scrollable. */
  readonly definitionLines: readonly string[];
}

export async function fetchRuleDetail(call: ToolCaller, uid: string): Promise<RuleDetail> {
  const payloadText = await call('rules_get', { uid });
  const payload = JSON.parse(payloadText) as { workspaceId: string; rule: Record<string, unknown> };
  return {
    workspaceId: payload.workspaceId,
    rule: payload.rule,
    definitionLines: JSON.stringify(payload.rule, null, 2).split('\n'),
  };
}
