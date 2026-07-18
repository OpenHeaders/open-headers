/**
 * Dashboard data plane — the same tool calls `oh workspace/env/rules`
 * make, through an injected caller so the module stays transport-free
 * and unit-testable. Payload shapes come from format.ts (the CLI's
 * read view of the tool contract) — the TUI never grows a private
 * schema. Errors are classified by the caller's own error types
 * (UnreachableError/AuthError pass through). Write wrappers return the
 * ack payload verbatim — the daemon's post-write state is what renders.
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

// ── Write wrappers (Phase 4 verbs) ───────────────────────────────────

export interface RuleWriteAck {
  readonly uid: string;
  readonly enabled: boolean;
  readonly published: boolean;
}

export async function toggleRule(call: ToolCaller, uid: string, enabled: boolean): Promise<RuleWriteAck> {
  const ackText = await call('rules_toggle', { uid, enabled });
  const ack = JSON.parse(ackText) as { uid: string; enabled: boolean; published: boolean };
  return { uid: ack.uid, enabled: ack.enabled, published: ack.published === true };
}

export async function publishRule(call: ToolCaller, uid: string, published: boolean): Promise<RuleWriteAck> {
  const ackText = await call('rules_update', { uid, updates: { published } });
  const ack = JSON.parse(ackText) as { rule: Record<string, unknown> };
  return { uid, enabled: ack.rule.enabled === true, published: ack.rule.published === true };
}

export interface EnvironmentSwitchAck {
  /** Null = "No environment". */
  readonly environmentId: string | null;
}

export async function switchEnvironment(call: ToolCaller, environmentId: string | null): Promise<EnvironmentSwitchAck> {
  const ackText = await call('environments_switch', { environmentId });
  const ack = JSON.parse(ackText) as { environment: { uid: string } | null };
  return { environmentId: ack.environment === null ? null : ack.environment.uid };
}

export interface WorkspaceSwitchAck {
  readonly workspaceId: string;
}

export async function switchWorkspace(call: ToolCaller, workspaceId: string): Promise<WorkspaceSwitchAck> {
  const ackText = await call('workspaces_switch', { workspaceId });
  const ack = JSON.parse(ackText) as { workspace: { id: string } };
  return { workspaceId: ack.workspace.id };
}
