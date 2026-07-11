/**
 * Human formatters — compact single-purpose lines over the tool
 * results. The payload interfaces here are the CLI's read view of the
 * server's tool contract (mcp/tools/read-tools.ts projections); the
 * `--json` path bypasses all of this and emits the payload verbatim,
 * so these types never become a second machine schema.
 */

interface WorkspacesPayload {
  activeWorkspaceId: string | null;
  workspaces: { id: string; name: string; kind: string; active: boolean; loaded: boolean }[];
}

export function formatWorkspaces(payload: unknown): string[] {
  const { activeWorkspaceId, workspaces } = payload as WorkspacesPayload;
  const lines = workspaces.map(
    (ws) => `${ws.active ? '*' : ' '} ${ws.id}  ${ws.name} (${ws.kind})${ws.loaded ? '' : '  — not loaded'}`,
  );
  lines.push(`${workspaces.length} workspace(s) · active: ${activeWorkspaceId ?? 'none'}`);
  return lines;
}

interface RulesPayload {
  workspaceId: string;
  rules: { uid: string; name: string; type: string; enabled: boolean; published: boolean }[];
}

export function formatRules(payload: unknown): string[] {
  const { workspaceId, rules } = payload as RulesPayload;
  const lines = rules.map(
    (rule) =>
      `${rule.enabled ? 'on ' : 'off'}  ${rule.uid}  ${rule.name}  [${rule.type}]${rule.published ? '' : '  (draft)'}`,
  );
  const enabled = rules.filter((rule) => rule.enabled).length;
  lines.push(`${enabled} enabled · ${rules.length - enabled} disabled · workspace ${workspaceId}`);
  return lines;
}

interface EnvironmentsPayload {
  workspaceId: string;
  activeEnvironmentId: string | null;
  environments: { uid: string; name: string; variables: unknown[] }[];
}

export function formatEnvironments(payload: unknown): string[] {
  const { activeEnvironmentId, environments, workspaceId } = payload as EnvironmentsPayload;
  const lines = environments.map(
    (env) => `${env.uid === activeEnvironmentId ? '*' : ' '} ${env.uid}  ${env.name}  (${env.variables.length} vars)`,
  );
  lines.push(`${environments.length} environment(s) · workspace ${workspaceId}`);
  return lines;
}

interface ProjectedVariable {
  name: string;
  value?: string;
  masked: boolean;
}

interface VariablesPayload {
  workspaceId: string;
  vault: { name: string; kind: string }[];
  environments: { name: string; variables: ProjectedVariable[] }[];
  collections: { name: string; scope: string; variables: ProjectedVariable[] }[];
  workspace: ProjectedVariable[];
  live: { reference: string; workflowUid: string }[];
}

function variableLine(variable: ProjectedVariable): string {
  return variable.masked ? `  ${variable.name} (masked)` : `  ${variable.name} = ${variable.value ?? ''}`;
}

export function formatVariables(payload: unknown): string[] {
  const { vault, environments, collections, workspace, live } = payload as VariablesPayload;
  const lines: string[] = [];
  lines.push(`vault (${vault.length}):`);
  lines.push(...vault.map((secret) => `  ${secret.name} (${secret.kind})`));
  for (const env of environments) {
    lines.push(`environment "${env.name}" (${env.variables.length}):`);
    lines.push(...env.variables.map(variableLine));
  }
  for (const collection of collections) {
    lines.push(`collection "${collection.name}" [${collection.scope}] (${collection.variables.length}):`);
    lines.push(...collection.variables.map(variableLine));
  }
  lines.push(`workspace (${workspace.length}):`);
  lines.push(...workspace.map(variableLine));
  lines.push(`live (${live.length}):`);
  lines.push(...live.map((entry) => `  ${entry.reference} ← workflow ${entry.workflowUid}`));
  return lines;
}

interface RequestsPayload {
  workspaceId: string;
  requests: { uid: string; name: string; method: string; url: string }[];
}

export function formatRequests(payload: unknown): string[] {
  const { workspaceId, requests } = payload as RequestsPayload;
  const lines = requests.map((req) => `${req.uid}  ${req.method.padEnd(7)} ${req.url}  ${req.name}`);
  lines.push(`${requests.length} request(s) · workspace ${workspaceId}`);
  return lines;
}

interface WorkflowsPayload {
  workspaceId: string;
  workflows: {
    uid: string;
    name: string;
    enabled: boolean;
    published: boolean;
    stepCount: number;
    liveVariables: string[];
  }[];
}

export function formatWorkflows(payload: unknown): string[] {
  const { workspaceId, workflows } = payload as WorkflowsPayload;
  const lines = workflows.map((wf) => {
    const vars = wf.liveVariables.length > 0 ? `  → ${wf.liveVariables.join(', ')}` : '';
    return `${wf.enabled ? 'on ' : 'off'}  ${wf.uid}  ${wf.name}  ${wf.stepCount} step(s)${wf.published ? '' : '  (draft)'}${vars}`;
  });
  lines.push(`${workflows.length} workflow(s) · workspace ${workspaceId}`);
  return lines;
}

interface RunsPayload {
  workspaceId: string;
  runs: {
    workflowUid: string;
    extractedAt: number;
    consecutiveFailures: number;
    lastErrorMessage: string | null;
    refreshHealth: string;
  }[];
}

export function formatWorkflowRuns(payload: unknown): string[] {
  const { workspaceId, runs } = payload as RunsPayload;
  const lines = runs.map((run) => {
    const error = run.lastErrorMessage ? `  err: ${run.lastErrorMessage}` : '';
    return `${run.workflowUid}  ${run.refreshHealth}  fail×${run.consecutiveFailures}  extracted ${new Date(run.extractedAt).toISOString()}${error}`;
  });
  lines.push(`${runs.length} run record(s) · workspace ${workspaceId}`);
  return lines;
}

interface ActivityPayload {
  workspaceId: string;
  entries: {
    observedAt: number;
    kind: string;
    entityType: string;
    entityId: string;
    summary?: string;
  }[];
}

export function formatActivity(payload: unknown): string[] {
  const { workspaceId, entries } = payload as ActivityPayload;
  const lines = entries.map((entry) => {
    const what = entry.summary ?? `${entry.kind} ${entry.entityType} ${entry.entityId}`;
    return `${new Date(entry.observedAt).toISOString()}  ${what}`;
  });
  lines.push(`${entries.length} entries · workspace ${workspaceId}`);
  return lines;
}

/** Detail commands (`rules get`, `request get`) — the full definition IS the honest human view. */
export function formatPayloadJson(payloadText: string): string[] {
  return [payloadText];
}

interface RuleTogglePayload {
  workspaceId: string;
  uid: string;
  enabled: boolean;
  published: boolean;
}

/** Agent-honest: rules apply on connected browser extensions, never "the desktop intercepts". */
export function formatRuleToggle(payload: unknown): string[] {
  const { workspaceId, uid, enabled, published } = payload as RuleTogglePayload;
  const effect = published ? ' — live on connected browser extensions' : '  (draft — no effect on live traffic)';
  return [`rule ${uid} → ${enabled ? 'on' : 'off'}${effect} · workspace ${workspaceId}`];
}

interface EnvironmentSwitchPayload {
  workspaceId: string;
  environment: { uid: string; name: string } | null;
}

export function formatEnvironmentSwitch(payload: unknown): string[] {
  const { workspaceId, environment } = payload as EnvironmentSwitchPayload;
  const which = environment === null ? 'none' : `${environment.name} (${environment.uid})`;
  return [`active environment: ${which} · workspace ${workspaceId}`];
}

interface VariableSetPayload {
  workspaceId: string;
  scope: string;
  collection?: { uid: string; name: string };
  variable: { name: string; type: string; updated: boolean };
}

export function formatVariableSet(payload: unknown): string[] {
  const { workspaceId, scope, collection, variable } = payload as VariableSetPayload;
  const where = collection ? `collection "${collection.name}" [${scope}]` : 'workspace scope';
  const secret = variable.type === 'secret' ? ' (secret)' : '';
  return [`${variable.updated ? 'updated' : 'added'} ${variable.name}${secret} in ${where} · workspace ${workspaceId}`];
}

interface WorkspaceSwitchPayload {
  previousWorkspaceId: string | null;
  workspace: { id: string; name?: string; loaded: boolean };
}

export function formatWorkspaceSwitch(payload: unknown): string[] {
  const { previousWorkspaceId, workspace } = payload as WorkspaceSwitchPayload;
  const from =
    previousWorkspaceId !== null && previousWorkspaceId !== workspace.id ? ` · was ${previousWorkspaceId}` : '';
  const loading = workspace.loaded ? '' : '  — still loading';
  return [`active workspace: ${workspace.name ?? workspace.id} (${workspace.id})${loading}${from}`];
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RequestSendPayload {
  workspaceId: string;
  request: { uid: string; name: string; method: string; url: string };
  response: {
    status: number;
    statusText: string;
    url: string;
    bodyBytes: number;
    durationMs: number;
    bodyTruncated: boolean;
  };
}

/** Success line only — a failed send never reaches here (checkFailure → exit 1). */
export function formatRequestSend(payload: unknown): string[] {
  const { workspaceId, request, response } = payload as RequestSendPayload;
  const truncated = response.bodyTruncated ? '  (body truncated — use --json for the capped body)' : '';
  return [
    `${request.method} ${response.url} → ${response.status} ${response.statusText} · ` +
      `${humanBytes(response.bodyBytes)} · ${Math.round(response.durationMs)} ms${truncated} · workspace ${workspaceId}`,
  ];
}

interface WorkflowRunPayload {
  workspaceId: string;
  workflowUid: string;
  skippedStepIds: string[];
  extractedAt: number | null;
  stepCaptures: Record<string, Record<string, unknown>>;
  liveVariables: { name: string; reference: string; published: boolean }[];
}

/** Capture names, never values — same discipline as workflow history; `--json` carries values. */
export function formatWorkflowRun(payload: unknown): string[] {
  const { workspaceId, workflowUid, skippedStepIds, extractedAt, stepCaptures, liveVariables } =
    payload as WorkflowRunPayload;
  const captureCount = Object.values(stepCaptures).reduce((sum, captures) => sum + Object.keys(captures).length, 0);
  const skipped = skippedStepIds.length > 0 ? ` · skipped: ${skippedStepIds.join(', ')}` : '';
  const extracted = extractedAt === null ? '' : ` · extracted ${new Date(extractedAt).toISOString()}`;
  const lines = [`workflow ${workflowUid} ran ok · ${captureCount} capture(s)${extracted}${skipped}`];
  for (const lv of liveVariables) {
    lines.push(`  ${lv.reference} ${lv.published ? '(published)' : '(draft)'}`);
  }
  lines.push(`workspace ${workspaceId}`);
  return lines;
}

interface DiffIdentity {
  id: string;
  name: string;
}

interface WorkspaceDiffPayload {
  workspaceId: string;
  otherWorkspaceId: string;
  diff: Record<string, { added: DiffIdentity[]; removed: DiffIdentity[]; changed: DiffIdentity[] }>;
}

export function formatWorkspaceDiff(payload: unknown): string[] {
  const { workspaceId, otherWorkspaceId, diff } = payload as WorkspaceDiffPayload;
  const lines: string[] = [];
  let total = 0;
  for (const [family, familyDiff] of Object.entries(diff)) {
    const count = familyDiff.added.length + familyDiff.removed.length + familyDiff.changed.length;
    if (count === 0) continue;
    total += count;
    lines.push(`${family}: +${familyDiff.added.length} −${familyDiff.removed.length} ~${familyDiff.changed.length}`);
    for (const row of familyDiff.added) lines.push(`  + ${row.name} (${row.id})`);
    for (const row of familyDiff.removed) lines.push(`  − ${row.name} (${row.id})`);
    for (const row of familyDiff.changed) lines.push(`  ~ ${row.name} (${row.id})`);
  }
  if (total === 0) lines.push('no differences');
  lines.push(`${total} difference(s) · ${workspaceId} vs ${otherWorkspaceId}`);
  return lines;
}
