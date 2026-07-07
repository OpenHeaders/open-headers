/**
 * Read-tier MCP tools — the Phase 1 catalog. Every tool reads the same
 * snapshot projections the renderer mirror plane seeds from
 * (`@openheaders/oracle/sync/service`), so an agent sees exactly what
 * the Workbench sees.
 *
 * Workspace resolution: every workspace-scoped tool takes an optional
 * `workspaceId` and defaults to the runtime-active workspace. Snapshots
 * only exist for workspaces materialized on this host — a valid-but-
 * unloaded workspace returns a distinct error (not a silent `[]`) so
 * the agent doesn't mistake "not hydrated" for "empty".
 *
 * Secret discipline (read tier): vault values and TOTP seeds are never
 * returned — names/kinds only. Variables typed `secret` in any scope
 * report `masked: true` with no value. Everything else is the user's
 * own plaintext workspace data.
 */

import type { ActivityEntry } from '@openheaders/core/sync';
import type {
  Environment,
  LiveWorkflow,
  Request,
  Rule,
  Variable,
  VaultSecret,
  WorkflowRunCache,
} from '@openheaders/core/types';
import { getActiveEnvironmentId, getDefaultEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { listWorkflowRunCaches } from '@openheaders/oracle/live/live-cache-store';
import { peekActiveWorkspaceId } from '@openheaders/oracle/sync';
import {
  getOracleForWorkspace,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import { getSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { getActiveWorkspaceId, listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import { requireWorkspace, resolveWorkspaceIdArg, WORKSPACE_ID_PROPERTY } from './common';

// ── Secret-safe variable projection ────────────────────────────────

interface ProjectedVariable {
  readonly name: string;
  readonly value?: string;
  readonly masked: boolean;
}

function projectVariable(variable: Variable): ProjectedVariable {
  if (variable.type === 'secret') {
    return { name: variable.name, masked: true };
  }
  return { name: variable.name, value: variable.value, masked: false };
}

function projectVaultSecret(secret: VaultSecret): { name: string; kind: VaultSecret['kind'] } {
  return { name: secret.name, kind: secret.kind };
}

// ── Entity list projections ─────────────────────────────────────────

function projectRuleRow(rule: Rule): Record<string, unknown> {
  return {
    uid: rule.uid,
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
    // `published !== true` is "draft" by contract — normalize so agents
    // never reason about a tri-state.
    published: rule.published === true,
    path: rule.path,
    conditionCount: rule.conditions.length,
  };
}

function projectRequestRow(request: Request): Record<string, unknown> {
  return {
    uid: request.uid,
    name: request.name,
    method: request.method,
    url: request.url,
    path: request.path,
  };
}

function projectEnvironmentRow(environment: Environment): Record<string, unknown> {
  return {
    uid: environment.uid,
    name: environment.name,
    variables: environment.variables.map(projectVariable),
  };
}

function projectWorkflowRow(workflow: LiveWorkflow, liveVariableNames: readonly string[]): Record<string, unknown> {
  return {
    uid: workflow.uid,
    name: workflow.name,
    description: workflow.description,
    enabled: workflow.enabled,
    published: workflow.published === true,
    stepCount: workflow.steps.length,
    refresh: workflow.refresh,
    liveVariables: liveVariableNames,
  };
}

/**
 * Read-tier projection of a cached workflow run. Capture NAMES only —
 * captured values often carry credentials (that is the live-variable
 * use case) and belong to the execute tier's fresh-run result.
 */
function projectRunRecord(run: WorkflowRunCache): Record<string, unknown> {
  const captureNames: Record<string, string[]> = {};
  for (const [stepId, captures] of Object.entries(run.stepCaptures)) {
    captureNames[stepId] = Object.keys(captures);
  }
  return {
    workflowUid: run.workflowUid,
    environmentId: run.environmentId,
    extractedAt: run.extractedAt,
    expiresAt: run.expiresAt,
    captureNames,
    stepResponseBytes: run.stepResponseBytes,
    consecutiveFailures: run.consecutiveFailures,
    lastErrorAt: run.lastErrorAt,
    lastErrorMessage: run.lastErrorMessage,
    lastErrorStepId: run.lastErrorStepId,
    lastExtractorOk: run.lastExtractorOk,
    refreshHealth: run.refreshHealth,
    definitionallyStale: run.definitionallyStale,
  };
}

// ── Tool definitions ────────────────────────────────────────────────

export function createReadToolDefinitions(): McpToolDefinition[] {
  const workspaceScoped: Pick<McpToolDefinition, 'tier' | 'resolveWorkspaceId'> = {
    tier: 'read',
    resolveWorkspaceId: resolveWorkspaceIdArg,
  };

  return [
    {
      name: 'workspaces_list',
      title: 'List workspaces',
      description:
        'List every workspace on this Open Headers host: id, name, kind, and which one is active. ' +
        'Workspace ids feed the optional workspaceId argument of every other tool.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      tier: 'read',
      capability: 'workspace.list',
      resolveWorkspaceId: () => null,
      handler: async () => {
        const activeWorkspaceId = getActiveWorkspaceId() ?? null;
        return {
          activeWorkspaceId,
          workspaces: listWorkspaces().map((ws) => ({
            id: ws.id,
            name: ws.name,
            kind: ws.kind,
            description: ws.description,
            active: ws.id === activeWorkspaceId,
            loaded: getOracleForWorkspace(ws.id) !== null,
          })),
        };
      },
    },
    {
      name: 'rules_list',
      title: 'List rules',
      description:
        'List the traffic rules in a workspace (header, block, redirect, query-param, inject, delay, ' +
        'request-body, response, ws, sse, auth). Returns lean rows — uid, name, type, enabled, published, ' +
        'path, condition count. Use rules_get for the full definition. Rules are executed by connected ' +
        'browser extensions, not by the desktop app itself.',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        return {
          workspaceId,
          rules: snapshotRulePostStates(workspaceId).map((ps) => projectRuleRow(ps.rule)),
        };
      },
    },
    {
      name: 'rules_get',
      title: 'Get rule',
      description: 'Fetch one rule by uid — the full definition: conditions, action payload, and flags.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Rule uid from rules_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = typeof args.uid === 'string' ? args.uid : '';
        const match = snapshotRulePostStates(workspaceId).find((ps) => ps.rule.uid === uid);
        if (!match) {
          throw new McpToolInputError(`no rule with uid '${uid}' in workspace '${workspaceId}' — see rules_list`);
        }
        return { workspaceId, rule: match.rule };
      },
    },
    {
      name: 'requests_list',
      title: 'List API requests',
      description:
        'List the saved API requests in a workspace: uid, name, method, url, path. ' +
        'Use requests_get for the full definition (headers, params, auth, body, scripts).',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        return {
          workspaceId,
          requests: snapshotRequestPostStates(workspaceId).map((ps) => projectRequestRow(ps.request)),
        };
      },
    },
    {
      name: 'requests_get',
      title: 'Get API request',
      description:
        'Fetch one saved API request by uid — the full definition: headers, query params, auth config, ' +
        'body, and pre/post scripts. Values may reference {{variables}} resolved at send time.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Request uid from requests_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = typeof args.uid === 'string' ? args.uid : '';
        const match = snapshotRequestPostStates(workspaceId).find((ps) => ps.request.uid === uid);
        if (!match) {
          throw new McpToolInputError(`no request with uid '${uid}' in workspace '${workspaceId}' — see requests_list`);
        }
        return { workspaceId, request: match.request };
      },
    },
    {
      name: 'environments_list',
      title: 'List environments',
      description:
        'List the environments in a workspace with their variables (secret-typed values are masked). ' +
        'Active/default environment pointers are reported for the runtime-active workspace.',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        // The environment entity store's active/default pointers are
        // hydrated for the runtime-active workspace only — report them
        // there and stay silent (null) for background workspaces.
        const isRuntimeActive = workspaceId === peekActiveWorkspaceId();
        return {
          workspaceId,
          activeEnvironmentId: isRuntimeActive ? getActiveEnvironmentId() : null,
          defaultEnvironmentId: isRuntimeActive ? getDefaultEnvironmentId() : null,
          environments: snapshotEnvironmentPostStates(workspaceId).map((ps) => projectEnvironmentRow(ps.environment)),
        };
      },
    },
    {
      name: 'variables_list',
      title: 'List variables (all scopes)',
      description:
        'List every variable scope in a workspace in resolution-priority order: vault (names only, values ' +
        'never returned), environment, collection, and workspace variables, plus live variables ' +
        '(referenced as {{live.<name>}}, produced by workflows). Secret-typed values are masked. ' +
        'Collection uids listed here feed the collectionId argument of variables_set.',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const vault = snapshotVaultPostStates(workspaceId).flatMap((ps) => ps.vault.secrets.map(projectVaultSecret));
        const environments = snapshotEnvironmentPostStates(workspaceId).map((ps) => ({
          uid: ps.environment.uid,
          name: ps.environment.name,
          variables: ps.environment.variables.map(projectVariable),
        }));
        const collections = [
          ...snapshotCollectionPostStates(workspaceId).map((ps) => ({ scope: 'rules', collection: ps.collection })),
          ...snapshotRequestCollectionPostStates(workspaceId).map((ps) => ({
            scope: 'requests',
            collection: ps.collection,
          })),
          // Empty collections stay listed — their uid is how an agent
          // targets a collection scope for its FIRST variable.
        ].map(({ scope, collection }) => ({
          uid: collection.uid,
          name: collection.name,
          scope,
          variables: collection.variables.map(projectVariable),
        }));
        const workspaceVariables = snapshotWorkspaceVariablesPostStates(workspaceId).flatMap((ps) =>
          ps.workspaceVariables.variables.map(projectVariable),
        );
        const live = snapshotLiveVariablePostStates(workspaceId).map((ps) => ({
          name: ps.liveVariable.name,
          reference: `{{live.${ps.liveVariable.name}}}`,
          workflowUid: ps.liveVariable.workflowUid,
          description: ps.liveVariable.description,
        }));
        return { workspaceId, vault, environments, collections, workspace: workspaceVariables, live };
      },
    },
    {
      name: 'workflows_list',
      title: 'List live workflows',
      description:
        'List the live workflows in a workspace — chained request runs that publish {{live.*}} variables ' +
        'on a refresh schedule. Returns uid, name, enabled/published flags, step count, refresh policy, ' +
        'and the live variables each workflow feeds.',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const liveVariables = snapshotLiveVariablePostStates(workspaceId).map((ps) => ps.liveVariable);
        return {
          workspaceId,
          workflows: snapshotLiveWorkflowPostStates(workspaceId).map((ps) =>
            projectWorkflowRow(
              ps.workflow,
              liveVariables.filter((lv) => lv.workflowUid === ps.workflow.uid).map((lv) => lv.name),
            ),
          ),
        };
      },
    },
    {
      name: 'workflows_history',
      title: 'Workflow run history',
      description:
        'Read the cached run records of live workflows: last successful extraction time, derived expiry, ' +
        'consecutive failures, the last error (message + failing step), and refresh health. Reports the ' +
        'capture NAMES each run produced per step, never the captured values (run a workflow via ' +
        'workflows_run to obtain values). One record per workflow × environment.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Optional workflow uid from workflows_list — omit for all.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = typeof args.uid === 'string' && args.uid.length > 0 ? args.uid : null;
        const runs = (await listWorkflowRunCaches(workspaceId)).filter((run) => !uid || run.workflowUid === uid);
        return { workspaceId, runs: runs.map(projectRunRecord) };
      },
    },
    {
      name: 'activity_list',
      title: 'List recent activity',
      description:
        'List the most recent change activity in a workspace (newest first): entity created/updated/' +
        'deleted events with their source. Useful for seeing what changed recently before acting.',
      inputSchema: {
        type: 'object',
        properties: {
          ...WORKSPACE_ID_PROPERTY,
          limit: { type: 'number', description: 'Max entries to return (default 50).' },
        },
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const log = getSyncPersistenceProvider().createActivityLog?.() ?? null;
        if (!log) return { workspaceId, entries: [] };
        const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 500) : 50;
        const entries: ActivityEntry[] = await log.list(workspaceId, { limit });
        return { workspaceId, entries };
      },
    },
  ];
}
