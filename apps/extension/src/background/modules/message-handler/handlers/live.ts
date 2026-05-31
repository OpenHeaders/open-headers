/** Live Variables + Workflows RPCs (Phase B). */

import type {
  LiveVariable,
  LiveVariableOverride,
  LiveWorkflow,
  RefreshPolicy,
  WorkflowStep,
} from '@openheaders/core/types';
import {
  clearWorkflowRunCache,
  getWorkflowRunCache,
  listCachesForWorkflow as listLiveCacheForWorkflow,
} from '@openheaders/oracle/live/live-cache-store';
import {
  createLiveVariable,
  deleteLiveVariable,
  getLiveVariable,
  getLiveVariables,
  setLiveVariableOverride,
  updateLiveVariable,
} from '@openheaders/oracle/live/live-variable-store';
import {
  createLiveWorkflow,
  deleteLiveWorkflow,
  getLiveWorkflow,
  getLiveWorkflows,
  updateLiveWorkflow,
} from '@openheaders/oracle/live/live-workflow-store';
import { refreshLiveWorkflowByUser, resetCircuitForWorkflow } from '../../live-refresh-scheduler';
import { getActiveWorkspaceId } from '../../workspace-store';
import type { HandlerMap } from '../types';

export const liveHandlers: HandlerMap = {
  listLiveWorkflows: ({ respond }) => {
    respond({ workflows: getLiveWorkflows() });
    return true;
  },

  getLiveWorkflow: ({ message, respond }) => {
    respond({ workflow: getLiveWorkflow(message.uid as string) });
    return true;
  },

  createLiveWorkflow: ({ message, respond }) => {
    void (async () => {
      try {
        const workflow = await createLiveWorkflow({
          name: message.name as string,
          description: message.description as string | undefined,
          steps: message.steps as WorkflowStep[] | undefined,
          refresh: message.refresh as RefreshPolicy | undefined,
          enabled: message.enabled as boolean | undefined,
        });
        respond({ success: true, workflow });
      } catch (err) {
        respond({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  },

  updateLiveWorkflow: ({ message, respond }) => {
    const req = message as {
      uid: string;
      updates: Partial<Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;
    };
    updateLiveWorkflow(req.uid, req.updates)
      .then((result) => {
        if (result.ok) {
          respond({ success: true, workflow: result.workflow });
        } else if (result.reason === 'not-found') {
          respond({ success: false, reason: 'not-found' });
        } else {
          respond({ success: false, reason: 'other', error: result.message });
        }
      })
      .catch((err: Error) => respond({ success: false, reason: 'other', error: err.message }));
    return true;
  },

  deleteLiveWorkflow: ({ message, respond }) => {
    deleteLiveWorkflow(message.uid as string)
      .then((removed) => {
        if (removed) {
          // Cache entries for the deleted workflow are now orphaned — purge
          // them so the scheduler + resolver never serve values from a
          // workflow that no longer exists.
          void clearWorkflowRunCache(message.uid as string);
        }
        respond({ success: removed });
      })
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  listLiveVariables: ({ respond }) => {
    respond({ variables: getLiveVariables() });
    return true;
  },

  getLiveVariable: ({ message, respond }) => {
    respond({ variable: getLiveVariable(message.uid as string) });
    return true;
  },

  createLiveVariable: ({ message, respond }) => {
    void (async () => {
      try {
        const variable = await createLiveVariable({
          name: message.name as string,
          workflowUid: message.workflowUid as string,
          stepId: message.stepId as string,
          captureName: message.captureName as string,
          description: message.description as string | undefined,
          requireFreshOnRuleBuild: message.requireFreshOnRuleBuild as boolean | undefined,
          enabled: message.enabled as boolean | undefined,
        });
        respond({ success: true, variable });
      } catch (err) {
        respond({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  },

  updateLiveVariable: ({ message, respond }) => {
    const req = message as {
      uid: string;
      updates: Partial<Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;
    };
    updateLiveVariable(req.uid, req.updates)
      .then((result) => {
        if (result.ok) {
          respond({ success: true, variable: result.variable });
        } else if (result.reason === 'not-found') {
          respond({ success: false, reason: 'not-found' });
        } else {
          respond({ success: false, reason: 'other', error: result.message });
        }
      })
      .catch((err: Error) => respond({ success: false, reason: 'other', error: err.message }));
    return true;
  },

  deleteLiveVariable: ({ message, respond }) => {
    deleteLiveVariable(message.uid as string)
      .then((removed) => respond({ success: removed }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  setLiveVariableOverride: ({ message, respond }) => {
    const req = message as {
      uid: string;
      override: LiveVariableOverride | null;
    };
    setLiveVariableOverride(req.uid, req.override)
      .then((result) => {
        if (result.ok) {
          respond({ success: true, variable: result.variable });
        } else if (result.reason === 'not-found') {
          respond({ success: false, reason: 'not-found' });
        } else {
          respond({ success: false, reason: 'other', error: result.message });
        }
      })
      .catch((err: Error) => respond({ success: false, reason: 'other', error: err.message }));
    return true;
  },

  getLiveCacheForWorkflow: ({ message, respond }) => {
    // Workbench tab editing W2 reads W2's cache; system surfaces +
    // legacy callers omit workspaceId and fall back to runtime-Active
    // inside `listCachesForWorkflow` (MWPT-FULL session #11).
    const wsArg = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
    listLiveCacheForWorkflow(message.workflowUid as string, wsArg)
      .then((runs) => respond({ runs }))
      .catch((err: Error) => respond({ runs: [], error: err.message }));
    return true;
  },

  resetLiveWorkflowCircuit: ({ message, respond }) => {
    // "Reset circuit" action from the Workflow Status sidebar.
    // Clears consecutiveFailures + consecutiveOpenings + nextAttemptAt
    // on the target (workflow, env) pair so the next scheduled or
    // manual refresh starts from a clean slate. Does NOT run a probe.
    const req = message as { workflowUid: string; environmentId?: string | null; workspaceId?: string };
    void (async () => {
      // Workbench tab editing W2 resets W2's circuit; system surfaces
      // omit workspaceId and fall back to runtime-Active (MWPT-FULL #11).
      const wsId = req.workspaceId ?? getActiveWorkspaceId();
      const envId = req.environmentId ?? null;
      try {
        await resetCircuitForWorkflow(wsId, req.workflowUid, envId);
        respond({ success: true });
      } catch (err) {
        respond({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  },

  refreshLiveWorkflowNow: ({ message, respond }) => {
    // Manual refresh from the "Refresh now" button — route through
    // `refreshLiveWorkflowByUser` which bypasses the canSchedule
    // binding gate (the alarm path keeps the gate to avoid burning
    // quota on orphan workflows, but a user-initiated refresh should
    // work even before any LV is bound — common diagnostic flow).
    // Thrown errors are the source of truth for success/failure;
    // the cache row carries extra context (step uid on chain
    // failures) when available.
    const req = message as { workflowUid: string; environmentId?: string | null; workspaceId?: string };
    void (async () => {
      // Same threading contract as `resetLiveWorkflowCircuit` —
      // workbench gestures from a diverged tab pass the editing-scope
      // workspaceId; system surfaces fall back to runtime-Active.
      const wsId = req.workspaceId ?? getActiveWorkspaceId();
      const envId = req.environmentId ?? null;
      try {
        await refreshLiveWorkflowByUser(wsId, req.workflowUid, envId);
        const run = await getWorkflowRunCache(req.workflowUid, envId, wsId);
        respond({ success: true, run });
      } catch (err) {
        const run = await getWorkflowRunCache(req.workflowUid, envId, wsId);
        const thrownMessage = err instanceof Error ? err.message : String(err);
        respond({ success: false, error: run?.lastErrorMessage ?? thrownMessage });
      }
    })();
    return true;
  },
};
