/**
 * Live Variables + Workflows bridge RPCs (Phase B —
 * the live-variables plan). Workflows own the step list + refresh
 * schedule; `{{live.X}}` namespace bindings live on Live Variables.
 */

import type { ChainRunFailure } from '../../live/chain-runner';
import type { StepResponse } from '../../live/extractor';
import type { StepProduct, WorkflowRunFact } from '../../live/run-events';
import type {
  CallWorkflowStep,
  ExecutedRequestSnapshot,
  LiveVariable,
  LiveVariableOverride,
  LiveWorkflow,
  RefreshPolicy,
  WorkflowRunCache,
  WorkflowStep,
} from '../../types';

/**
 * Wire shape of one cached workflow run. Named alias over the core
 * `WorkflowRunCache` domain type so callers reference a channel-local
 * name rather than reaching for the host's cache-store module path.
 */
export type LiveWorkflowRunSnapshot = WorkflowRunCache;

/**
 * One step event of a workflow run as it reaches a page (the workflow
 * runs plan, The Run view): the fact, tagged with the run it belongs to
 * and its place in that run's order. Bounded — a step's product is
 * fetched with `getLiveWorkflowRunProduct`, never carried here.
 */
export interface LiveWorkflowRunEventWire {
  workspaceId: string;
  workflowUid: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  /** The caller's id for a run it started, else one the host minted. */
  runId: string;
  /** Position in this run's events, from 0. */
  seq: number;
  fact: WorkflowRunFact;
}

/**
 * How a run that lived in a page ended, as it crosses to the realm that
 * holds the cache (the workflow runs plan, Laws — "The run lives with its
 * session"): what the one commit writes, and nothing else of the run.
 */
export type LiveWorkflowRunOutcomeWire =
  | {
      kind: 'passed';
      /** `stepId → captureName → value`, the completed steps'. */
      stepCaptures: Record<string, Record<string, string>>;
      stepResponseBytes: Record<string, number>;
      stepAttempts: Record<string, number>;
      skippedStepIds: string[];
      completedAt: number;
    }
  | {
      kind: 'failed';
      failedStepId: string;
      failedPhase: ChainRunFailure['failedPhase'];
      failedReason: string;
      /** The failing step's response status, when one arrived. */
      failedStepStatus?: number;
    }
  /** Refused before its first step, for a step the page's host cannot run. */
  | { kind: 'refused'; stepId: string; reason: string };

/**
 * What the rate limit did with one call of a run that lives in a page:
 * `held` — the call waits for a slot; `leaving` — it is about to leave for
 * the wire, and waits for the page's `ackLiveWorkflowStepLeave` first.
 */
export interface LiveWorkflowStepSignalWire {
  callId: string;
  signal: 'held' | 'leaving';
}

export interface LiveRpc {
  /**
   * List every Live Workflow definition for the active workspace.
   * Workflows own the step list + refresh schedule; `{{live.X}}`
   * namespace bindings live on `listLiveVariables`.
   */
  listLiveWorkflows: {
    req: Record<string, never>;
    res: { workflows: LiveWorkflow[] };
  };
  getLiveWorkflow: {
    req: { uid: string };
    res: { workflow: LiveWorkflow | null };
  };
  createLiveWorkflow: {
    req: {
      name: string;
      description?: string;
      steps?: WorkflowStep[];
      refresh?: RefreshPolicy;
      enabled?: boolean;
    };
    res: { success: boolean; workflow?: LiveWorkflow; error?: string };
  };
  updateLiveWorkflow: {
    req: {
      uid: string;
      updates: Partial<Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { success: true; workflow: LiveWorkflow }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
  };
  deleteLiveWorkflow: {
    req: { uid: string };
    res: { success: boolean };
  };

  listLiveVariables: {
    req: Record<string, never>;
    res: { variables: LiveVariable[] };
  };
  getLiveVariable: {
    req: { uid: string };
    res: { variable: LiveVariable | null };
  };
  createLiveVariable: {
    req: {
      name: string;
      workflowUid: string;
      stepId: string;
      captureName: string;
      description?: string;
      requireFreshOnRuleBuild?: boolean;
      enabled?: boolean;
    };
    res: { success: boolean; variable?: LiveVariable; error?: string };
  };
  updateLiveVariable: {
    req: {
      uid: string;
      updates: Partial<Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { success: true; variable: LiveVariable }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
  };
  deleteLiveVariable: {
    req: { uid: string };
    res: { success: boolean };
  };
  /**
   * Pin an LV to a fixed value (debug override) or clear an existing
   * override. Pass `null` to clear.
   */
  setLiveVariableOverride: {
    req: { uid: string; override: LiveVariableOverride | null };
    res:
      | { success: true; variable: LiveVariable }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
  };
  /**
   * Every cached run for a workflow — one entry per active environment
   * that has ever produced a cache. Callers use this to render the
   * countdown + last-error state in the LV editor.
   */
  getLiveCacheForWorkflow: {
    req: { workflowUid: string; workspaceId?: string };
    res: { runs: LiveWorkflowRunSnapshot[] };
  };
  /**
   * Manual "refresh now" from the UI. Phase B ships a stub that
   * returns a `scheduler-not-ready` error — Phase C wires it to the
   * chain runner. Signature is stable across both phases so UI can
   * plumb it today.
   *
   * `workspaceId?` — workbench gestures from a diverged tab pass the
   * editing-scope id so the SW resolves the workflow + cache against
   * that workspace's projection (MWPT-FULL session #11). Omit ⇒
   * runtime-Active fallback (system surfaces, legacy callers).
   *
   * `runId?` — a caller-minted id the run's `liveWorkflowRunEvent`
   * frames are tagged with, so the caller knows its own run from the
   * first frame. Omit ⇒ the host mints one.
   */
  refreshLiveWorkflowNow: {
    req: { workflowUid: string; environmentId?: string | null; workspaceId?: string; runId?: string };
    res: { success: true; run: LiveWorkflowRunSnapshot } | { success: false; error: string };
  };

  /**
   * What one step of a run produced, by the run's id — asked for as the
   * step's settle arrives. Answered by the realm that ran the step, which
   * holds a workflow's products until that workflow runs again there;
   * `null` when it holds none for that step.
   */
  getLiveWorkflowRunProduct: {
    req: { runId: string; stepId: string };
    res: { product: StepProduct | null };
  };

  /**
   * The first half of a manual refresh whose run lives in the calling
   * page (the workflow runs plan, Laws — "The run lives with its
   * session"): the press rule up to the run — the offline refusal, the
   * circuit, the probe start — answered with the workflow as this host
   * holds it and whether the press overrides an open circuit.
   * {@link commitLiveWorkflowRun} is the other half.
   */
  beginLiveWorkflowRun: {
    req: { workflowUid: string; environmentId: string | null; workspaceId: string };
    res: { success: true; workflow: LiveWorkflow; bypass: boolean } | { success: false; error: string };
  };

  /**
   * One `call` step of a run that lives in the calling page, executed as
   * a call of this host's own runs is — the same adapter, the same rate
   * limit. `callId` tags the `liveWorkflowStepSignal` frames of this
   * call. A failure that kept the executor's record answers it too.
   */
  callLiveWorkflowStep: {
    req: {
      callId: string;
      workflowUid: string;
      environmentId: string | null;
      workspaceId: string;
      step: CallWorkflowStep;
      /** `stepId → captureName → value`, the run's captures so far. */
      stepCaptures: Record<string, Record<string, string>>;
      /** A poll sends the call again: the rate limit does not count this start. */
      resend: boolean;
    };
    res:
      | { success: true; response: StepResponse }
      | { success: false; error: string; snapshot?: ExecutedRequestSnapshot };
  };

  /**
   * The page noted that a call is leaving — it stamped what opens at the
   * leave — so the call may go to the wire. `success: false` when no call
   * by that id waits.
   */
  ackLiveWorkflowStepLeave: {
    req: { callId: string };
    res: { success: boolean };
  };

  /**
   * The one commit of a run that lived in the calling page: the cache
   * write, the live variables it publishes, the circuit and the health,
   * as a run of this host's own commits. Answers as
   * {@link refreshLiveWorkflowNow} does.
   */
  commitLiveWorkflowRun: {
    req: {
      workflowUid: string;
      environmentId: string | null;
      workspaceId: string;
      /** What {@link beginLiveWorkflowRun} answered. */
      bypass: boolean;
      outcome: LiveWorkflowRunOutcomeWire;
    };
    res: { success: true; run: LiveWorkflowRunSnapshot } | { success: false; error: string };
  };

  /**
   * "Reset circuit" — clears consecutiveFailures / consecutiveOpenings
   * / nextAttemptAt on the target cache row so the next scheduled or
   * manual refresh starts from a CLOSED circuit. Does not run a probe;
   * the user can click Refresh next. Surfaced on the Workflow Status
   * sidebar per-row action menu.
   *
   * `workspaceId?` — same threading contract as
   * {@link refreshLiveWorkflowNow}.
   */
  resetLiveWorkflowCircuit: {
    req: { workflowUid: string; environmentId?: string | null; workspaceId?: string };
    res: { success: true } | { success: false; error: string };
  };
}
