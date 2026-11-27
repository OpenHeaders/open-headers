/**
 * A workflow run that lives in the workbench page (the workflow runs
 * plan, Laws — "The run lives with its session"). A run that holds a
 * session runs here, beside it: the pure runner, the window and the
 * captures in one realm. Each `call` step crosses to the service worker
 * and runs through the adapter the worker's own runs use; one call at
 * the end commits the outcome. An HTTP-only workflow never comes here —
 * its press goes to the worker untouched.
 *
 * A {@link HostBridge} DECORATOR, the session hosts' shape:
 *   - `refreshLiveWorkflowNow` for a workflow with a session step is
 *     answered here; every Refresh already calls that one channel.
 *   - `liveWorkflowRunEvent` subscribers are fed this page's runs
 *     directly — a broadcast never reaches the page that sent it.
 *   - `getLiveWorkflowRunProduct` answers from this page for a run it
 *     ran, from the worker for any other.
 *
 * The scopes a run resolves from are the workbench shell's
 * (`workflow-run-scope.ts`), read as the run begins — no editor is
 * needed open.
 */

import type {
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
  HostBridge,
  LiveWorkflowRunEventWire,
  LiveWorkflowRunOutcomeWire,
} from '@openheaders/core/bridge';
import {
  type ChainRunOutcome,
  type FetchAdapter,
  isListenStep,
  isSessionStep,
  type RunRefusal,
  type RunSession,
  runChain,
  runRefusalEvents,
  type SessionHost,
  StepExecutionError,
  type TemplateResolver,
} from '@openheaders/core/live';
import type { ChainWorkflow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { unresolvedReferenceLines } from '@openheaders/oracle/live/request-exec/unresolved-references';
import { checkWorkflowRun } from '@openheaders/oracle/live/run-check';
import {
  getWorkflowRunProduct,
  openWorkflowRunFeed,
  setWorkflowRunEventSink,
} from '@openheaders/oracle/live/workflow-run-feed';
import type { WorkflowRunScope } from '@openheaders/ui/workbench/components/live/workflow-run-scope';
import type { ExecutionPlaceReason } from '@openheaders/ui/workbench/execution-place/resolve-execution-place';

export interface WorkflowPageRunHost {
  /** The bridge beneath — the worker answers every channel this page does not. */
  base: HostBridge;
  /** The scopes the workbench shell publishes; `null` while it shows no workspace. */
  getScope(): WorkflowRunScope | null;
  /** Opens one run's sessions over this page's transports. `null` environment = "No environment". */
  sessionsFor(scope: WorkflowRunScope, environmentId: string | null): SessionHost;
  /** This page has a script runtime for a run's session. */
  runsScripts: boolean;
}

interface PagePress {
  workflowUid: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  runId?: string;
}

/**
 * A `listen` whose session no place opens for this page — asked of the
 * rule its request's Connect follows. Refused before the run, with the
 * rest of what this host cannot run, so nothing is triggered that cannot
 * be judged.
 */
function placeRefusals(workflow: ChainWorkflow, scope: WorkflowRunScope): RunRefusal[] {
  const refusals: RunRefusal[] = [];
  for (const step of workflow.steps) {
    if (!isListenStep(step)) continue;
    const request = scope.mqttRequests.find((each) => each.uid === step.sessionRequestUid);
    if (request === undefined) continue;
    const place = scope.mqttPlace(request);
    if (place.state === 'ready') continue;
    refusals.push({
      stepId: step.id,
      reason: `Step "${step.id}" cannot run here: "${request.name}" ${placeFault(place.reason)}`,
    });
  }
  return refusals;
}

/** Why no place opens the session; a page left to open it itself is asked for a raw TCP socket. */
function placeFault(reason: ExecutionPlaceReason): string {
  if (reason.kind === 'server-off') {
    return "is set to run on the workspace's server, which this device's settings keep requests off.";
  }
  if (reason.kind === 'preference-unavailable' && reason.preferred !== 'here') {
    const place = reason.preferred === 'desktop-app' ? 'the desktop app' : "the workspace's server";
    return `is set to run on ${place}, which is not connected.`;
  }
  return 'opens a raw TCP socket (mqtt:// or mqtts://), which a browser page cannot; the desktop app can run it.';
}

function recordsOf<V>(maps: ReadonlyMap<string, ReadonlyMap<string, V>>): Record<string, Record<string, V>> {
  const records: Record<string, Record<string, V>> = {};
  for (const [key, inner] of maps) records[key] = Object.fromEntries(inner);
  return records;
}

function outcomeWire(outcome: ChainRunOutcome): LiveWorkflowRunOutcomeWire {
  if (outcome.ok) {
    return {
      kind: 'passed',
      stepCaptures: recordsOf(outcome.stepCaptures),
      stepResponseBytes: Object.fromEntries(outcome.stepResponseBytes),
      stepAttempts: Object.fromEntries(outcome.stepAttempts),
      skippedStepIds: outcome.skippedStepIds,
      completedAt: outcome.completedAt,
    };
  }
  const { failedStepId, failedPhase, failedReason } = outcome;
  const failedStepStatus = outcome.partialStepStatuses.get(failedStepId);
  return {
    kind: 'failed',
    failedStepId,
    failedPhase,
    failedReason,
    ...(failedStepStatus !== undefined ? { failedStepStatus } : {}),
  };
}

export function createWorkflowRunBridge(host: WorkflowPageRunHost): {
  bridge: HostBridge;
  /** End every session a run of this page holds open — the page is going. */
  endOpenSessions(): void;
} {
  const { base } = host;
  const runEventSubscribers = new Set<(event: LiveWorkflowRunEventWire) => void>();
  const openSessions = new Set<RunSession>();

  setWorkflowRunEventSink((event) => {
    for (const handler of runEventSubscribers) handler(event);
  });

  /**
   * A `call` step, run by the worker. The worker tells this page when
   * the rate limit holds the call and when it is about to leave; the
   * leave is noted here — the runner stamps what opens at it — before
   * the worker is told to send.
   */
  function workerAdapter(target: {
    workspaceId: string;
    workflowUid: string;
    environmentId: string | null;
  }): FetchAdapter {
    return {
      async executeStep(step, stepCaptures, _context, send) {
        const callId = generateUid();
        const unsubscribe = base.subscribe('liveWorkflowStepSignal', (frame) => {
          if (frame.callId !== callId) return;
          if (frame.signal === 'held') {
            send?.onHeld();
            return;
          }
          send?.onLeave();
          void base.call('ackLiveWorkflowStepLeave', { callId });
        });
        try {
          const answer = await base.call('callLiveWorkflowStep', {
            callId,
            ...target,
            step,
            stepCaptures: recordsOf(stepCaptures),
            resend: send?.resend === true,
          });
          if (answer.success) return answer.response;
          if (answer.snapshot !== undefined) throw new StepExecutionError(answer.error, answer.snapshot);
          throw new Error(answer.error);
        } finally {
          unsubscribe();
        }
      },
    };
  }

  async function runInPage(
    scope: WorkflowRunScope,
    press: PagePress,
  ): Promise<BridgeRpcResponse<'refreshLiveWorkflowNow'>> {
    const { workspaceId } = scope;
    const { workflowUid, environmentId, runId } = press;
    const begun = await base.call('beginLiveWorkflowRun', { workflowUid, environmentId, workspaceId });
    if (!begun.success) return { success: false, error: begun.error };
    const { workflow, bypass } = begun;

    // A run lives here only on a person's press.
    const onEvent = openWorkflowRunFeed({ workspaceId, workflowUid, environmentId, runId, trigger: 'manual' });
    const commit = (outcome: LiveWorkflowRunOutcomeWire) =>
      base.call('commitLiveWorkflowRun', { workflowUid, environmentId, workspaceId, bypass, outcome });

    const findMqttRequest = (uid: string) => scope.mqttRequests.find((request) => request.uid === uid) ?? null;
    const checked = checkWorkflowRun(workflow, { findMqttRequest, runsScripts: host.runsScripts });
    const refusals = checked.ok ? placeRefusals(checked.workflow, scope) : checked.refusals;
    if (!checked.ok || refusals.length > 0) {
      for (const event of runRefusalEvents(workflow, Date.now(), refusals)) onEvent(event);
      return commit({ kind: 'refused', stepId: refusals[0].stepId, reason: refusals[0].reason });
    }

    let resolve: ReturnType<WorkflowRunScope['templates']> | null = null;
    const resolveTemplate: TemplateResolver = async (template, stepCaptures) => {
      resolve ??= scope.templates({ environmentId, stepCaptures });
      const resolved = resolve(template);
      // A reference no scope answers fails the step: a value compared as written would be a verdict on the wrong thing.
      if (resolved.errors.length > 0) throw new Error(unresolvedReferenceLines(resolved.errors).join(' '));
      return resolved.result;
    };

    const inner = host.sessionsFor(scope, environmentId);
    const mine = new Set<RunSession>();
    const sessions: SessionHost = {
      async open(step, opening) {
        const opened = await inner.open(step, opening);
        if (opened.ok) {
          mine.add(opened.session);
          openSessions.add(opened.session);
        }
        return opened;
      },
    };

    let outcome: ChainRunOutcome;
    try {
      outcome = await runChain({
        workflow: checked.workflow,
        adapter: workerAdapter({ workspaceId, workflowUid, environmentId }),
        context: { workflowUid, workspaceId, environmentId },
        onEvent,
        resolveTemplate,
        sessions,
      });
    } finally {
      for (const session of mine) openSessions.delete(session);
    }
    return commit(outcomeWire(outcome));
  }

  /** The scope a press runs under in this page, or `null` — the worker runs it. */
  function scopeOfPagePress(payload: BridgeRpcRequest<'refreshLiveWorkflowNow'>): WorkflowRunScope | null {
    const scope = host.getScope();
    if (scope === null || payload.workspaceId !== scope.workspaceId) return null;
    const workflow = scope.workflows.find((each) => each.uid === payload.workflowUid);
    return workflow?.steps.some(isSessionStep) === true ? scope : null;
  }

  const bridge: HostBridge = {
    call<K extends BridgeRpcType>(
      type: K,
      ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
    ): Promise<BridgeRpcResponse<K>> {
      if (type === 'refreshLiveWorkflowNow') {
        const payload = args[0] as BridgeRpcRequest<'refreshLiveWorkflowNow'>;
        const scope = scopeOfPagePress(payload);
        if (scope !== null) {
          return runInPage(scope, {
            workflowUid: payload.workflowUid,
            environmentId: payload.environmentId ?? null,
            ...(payload.runId !== undefined ? { runId: payload.runId } : {}),
          }) as Promise<BridgeRpcResponse<K>>;
        }
      }
      if (type === 'getLiveWorkflowRunProduct') {
        const payload = args[0] as BridgeRpcRequest<'getLiveWorkflowRunProduct'>;
        const product = getWorkflowRunProduct(payload.runId, payload.stepId);
        if (product !== null) return Promise.resolve({ product }) as Promise<BridgeRpcResponse<K>>;
      }
      return base.call(type, ...args);
    },
    broadcast: base.broadcast,
    subscribe<K extends BridgeBroadcastType>(
      subscribedType: K,
      handler: (payload: BridgeBroadcastPayload<K>) => void,
    ): () => void {
      if (subscribedType === 'liveWorkflowRunEvent') {
        const local = handler as (event: LiveWorkflowRunEventWire) => void;
        runEventSubscribers.add(local);
        // The worker's runs — an HTTP-only workflow, a scheduled fire — arrive on the base's broadcast.
        const unsubscribe = base.subscribe(subscribedType, handler);
        return () => {
          runEventSubscribers.delete(local);
          unsubscribe();
        };
      }
      return base.subscribe(subscribedType, handler);
    },
    presence: base.presence,
  };

  return {
    bridge,
    endOpenSessions() {
      for (const session of openSessions) void session.end();
    },
  };
}
