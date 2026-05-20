/**
 * Live Variables + Workflows bridge RPCs (Phase B —
 * docs/LIVE_VARIABLES_PLAN.md). Workflows own the step list + refresh
 * schedule; `{{live.X}}` namespace bindings live on Live Variables.
 */

import type {
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
   */
  refreshLiveWorkflowNow: {
    req: { workflowUid: string; environmentId?: string | null; workspaceId?: string };
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
