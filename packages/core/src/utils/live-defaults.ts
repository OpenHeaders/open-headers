/**
 * Type-default builders for Live Workflow + Live Variable seeds.
 *
 * Mirrors `rule-defaults.ts` — every "+ New Live X" gesture mints a
 * structurally-valid seed via these helpers and routes through the
 * renderer-direct `applyLive*Create` path. The entity is real from the
 * first render; `published: false` until the user clicks Save.
 *
 * The seeds omit `uid` / `path` / `schemaVersion` because those are
 * minted at apply time by the write-client; `published` is intentionally
 * NOT set here so the helpers stay honest about "what the user asked
 * for" vs. "what the publication contract requires" — the write-client
 * forces `published: false` regardless.
 *
 * `LiveWorkflowSchema` requires `steps.length >= 1`; the editor needs a
 * placeholder step to render. Step + capture defaults live here so the
 * shape stays valid through the `isWorkflowComplete` predicate (which
 * rejects empty `requestUid` — the user must still pick a request, but
 * the structural slot is in place).
 */

import type { V5 } from '../types';
import { generateUid } from './workspace';

export type LiveWorkflowSeed = Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>;
export type LiveVariableSeed = Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>;

/**
 * Empty workflow seed with a single placeholder step. The step's
 * `requestUid` is `''` — incomplete by `isWorkflowComplete`'s contract,
 * which surfaces a "draft" sidebar tag until the user binds it. The
 * default refresh policy is `manual` so an unfinished workflow never
 * fires unsolicited requests against the user's network even if the
 * user toggles `published: true` before completing it (the
 * `isWorkflowEffective` gate would still block on `isWorkflowComplete`,
 * but defense-in-depth at the cadence layer matters).
 */
export function buildEmptyLiveWorkflow(name: string): LiveWorkflowSeed {
  return {
    name,
    steps: [
      {
        uid: generateUid(),
        id: 'step1',
        requestUid: '',
        captures: [],
      },
    ],
    refresh: { kind: 'manual' },
    enabled: true,
  };
}

/**
 * Empty LV seed bound to a specific workflow + step + capture. Caller
 * supplies the binding because LV creation is always relative to an
 * existing workflow's exposed captures (the `+ Expose as Live Variable`
 * gesture on a step's capture row, or the standalone `+ New Live
 * Variable` editor that requires the user to pick a binding before
 * Save). `name` defaults to the capture name when callers don't override.
 */
export interface BuildEmptyLiveVariableArgs {
  name: string;
  workflowUid: string;
  stepId: string;
  captureName: string;
}

export function buildEmptyLiveVariable(args: BuildEmptyLiveVariableArgs): LiveVariableSeed {
  return {
    name: args.name,
    workflowUid: args.workflowUid,
    stepId: args.stepId,
    captureName: args.captureName,
    enabled: true,
  };
}
