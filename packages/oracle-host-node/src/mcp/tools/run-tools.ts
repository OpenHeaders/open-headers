/**
 * Runner MCP tool — the daemon face of the standalone-runner surface
 * (`oh run collection|folder|workflow`). One execute-tier tool,
 * `runs_execute`: resolve the target, run it headless on this host,
 * and return ONE structured run report whose `items` array is the
 * ordered event list — the CLI formats the reporters (human / JSON /
 * JUnit) from it and never grows a private protocol.
 *
 * The execution capabilities are injected by the host shell, mirroring
 * `execute-tools`: `runSuite` is the suite loop (transport + script
 * capability live host-side), `runWorkflow` the same chain runner
 * `workflows_run` uses — a workflow run through this tool IS a normal
 * run (atomic cache commit, publish-on-run), reshaped as report items.
 */

import type { LiveWorkflow, Request } from '@openheaders/core/types';
import { getWorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { snapshotLiveWorkflowPostStates } from '@openheaders/oracle/sync/service';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import {
  requireStringArg,
  requireWorkspace,
  resolveEnvironmentArg,
  resolveWorkspaceIdArg,
  WORKSPACE_ID_PROPERTY,
} from './common';
import { ENVIRONMENT_ID_PROPERTY, type McpWorkflowRunArgs, type McpWorkflowRunOutcome } from './execute-tools';
import { resolveSuitePlan } from './run-plan';

export type RunTargetKind = 'collection' | 'folder' | 'workflow';

/** One report row — a suite request or a workflow step. */
export interface McpRunItem {
  kind: 'request' | 'step';
  uid: string;
  name: string;
  path?: string;
  method?: string;
  url?: string;
  status: 'passed' | 'failed' | 'skipped';
  httpStatus?: number;
  durationMs?: number;
  assertions?: Array<{ name: string; passed: boolean; message?: string }>;
  error?: string;
}

/** Contract of the injected suite runner — the host's execution loop
 *  (daemon `suite-runner.ts`), mirroring the `runWorkflow` injection. */
export interface McpSuiteRunArgs {
  workspaceId: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  requests: readonly Request[];
  bail: boolean;
}

export interface McpSuiteRunResult {
  scripts: { available: boolean; mode?: string };
  items: McpRunItem[];
}

export interface McpRunToolDeps {
  /** Host suite loop for collection/folder targets. */
  runSuite: (args: McpSuiteRunArgs) => Promise<McpSuiteRunResult>;
  /** Host chain runner for workflow targets — same injection as `workflows_run`. */
  runWorkflow: (args: McpWorkflowRunArgs) => Promise<McpWorkflowRunOutcome>;
}

function resolveWorkflowRef(workspaceId: string, ref: string): LiveWorkflow {
  const workflows = snapshotLiveWorkflowPostStates(workspaceId).map((ps) => ps.workflow);
  const byUid = workflows.find((workflow) => workflow.uid === ref);
  if (byUid) return byUid;
  const byName = workflows.filter((workflow) => workflow.name === ref);
  const [match] = byName;
  if (match !== undefined && byName.length === 1) return match;
  if (byName.length > 1) {
    throw new McpToolInputError(
      `workflow name '${ref}' is ambiguous — use a uid: ${byName.map((workflow) => workflow.uid).join(', ')}`,
    );
  }
  throw new McpToolInputError(`no workflow matching '${ref}' in workspace '${workspaceId}' — see workflows_list`);
}

function requireKindArg(args: Record<string, unknown>): RunTargetKind {
  const raw = args.kind;
  if (raw === 'collection' || raw === 'folder' || raw === 'workflow') return raw;
  throw new McpToolInputError(`'kind' must be 'collection', 'folder', or 'workflow'`);
}

function totalsFor(items: readonly McpRunItem[]): { items: number; passed: number; failed: number; skipped: number } {
  return {
    items: items.length,
    passed: items.filter((item) => item.status === 'passed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
  };
}

/** Reshape one workflow run as report items — atomic semantics made
 *  visible: on failure only the failing step ran to a verdict; every
 *  other step's work was discarded with the cache commit, so it
 *  reports `skipped`, never a phantom pass. */
function workflowItems(workflow: LiveWorkflow, outcome: McpWorkflowRunOutcome): McpRunItem[] {
  return workflow.steps.map((step) => {
    if (outcome.ok) {
      const status = outcome.skippedStepIds.includes(step.id) ? ('skipped' as const) : ('passed' as const);
      return { kind: 'step' as const, uid: step.uid, name: step.id, status };
    }
    if (step.id === outcome.failedStepId) {
      return {
        kind: 'step' as const,
        uid: step.uid,
        name: step.id,
        status: 'failed' as const,
        error: `${outcome.failedPhase}: ${outcome.message}`,
      };
    }
    return { kind: 'step' as const, uid: step.uid, name: step.id, status: 'skipped' as const };
  });
}

export function createRunToolDefinitions(deps: McpRunToolDeps): McpToolDefinition[] {
  return [
    {
      name: 'runs_execute',
      title: 'Run request suite or workflow',
      description:
        'Run a request collection, a folder, or a live workflow headless on this host and return a ' +
        'structured run report (per-item status, timing, assertions, totals) — the CI runner surface. ' +
        'Collection/folder items run sequentially in sidebar tree order; scripts and their oh.test ' +
        'assertions execute when the host has a script runtime (scripts.available reports it). An item ' +
        'fails on a transport/script/assertion error, or on HTTP status >= 400 when it has no assertions; ' +
        'explicit assertions outrank the status code. ref accepts a name or uid (folders also a ' +
        "'Collection/Folder' path); bail stops at the first failure and reports the rest skipped. A " +
        'workflow target runs exactly like workflows_run (atomic captures, publish-on-run), reported as ' +
        'per-step items.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['collection', 'folder', 'workflow'],
            description: 'What ref names: a request collection, a folder inside one, or a live workflow.',
          },
          ref: {
            type: 'string',
            description:
              "Target: name or uid; folders also accept a 'Collection/Folder[/Subfolder]' name path " +
              'when a bare name is ambiguous.',
          },
          bail: {
            type: 'boolean',
            description: 'Stop at the first failed item; remaining items report skipped. Default false.',
          },
          ...ENVIRONMENT_ID_PROPERTY,
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['kind', 'ref'],
        additionalProperties: false,
      },
      tier: 'execute',
      resolveWorkspaceId: resolveWorkspaceIdArg,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const kind = requireKindArg(args);
        const ref = requireStringArg(args, 'ref');
        const environmentId = resolveEnvironmentArg(workspaceId, args);
        const bail = args.bail === true;
        const startedAt = Date.now();

        if (kind === 'workflow') {
          const workflow = resolveWorkflowRef(workspaceId, ref);
          const outcome = await deps.runWorkflow({ workspaceId, workflow, environmentId });
          const items = workflowItems(workflow, outcome);
          const cache = outcome.ok ? await getWorkflowRunCache(workflow.uid, environmentId, workspaceId) : null;
          return {
            workspaceId,
            target: { kind, uid: workflow.uid, name: workflow.name },
            environmentId,
            bail,
            ok: outcome.ok,
            startedAt,
            durationMs: Date.now() - startedAt,
            items,
            totals: totalsFor(items),
            ...(cache ? { extractedAt: cache.extractedAt } : {}),
          };
        }

        const plan = resolveSuitePlan(workspaceId, kind, ref);
        if (plan.requests.length === 0) {
          throw new McpToolInputError(`${kind} '${plan.name}' contains no requests — nothing to run`);
        }
        const result = await deps.runSuite({ workspaceId, environmentId, requests: plan.requests, bail });
        const totals = totalsFor(result.items);
        return {
          workspaceId,
          target: { kind, uid: plan.uid, name: plan.name, path: plan.path },
          environmentId,
          bail,
          ok: totals.failed === 0,
          startedAt,
          durationMs: Date.now() - startedAt,
          scripts: result.scripts,
          items: result.items,
          totals,
        };
      },
    },
  ];
}
