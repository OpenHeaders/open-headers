/**
 * Draft shapes + reconciliation helpers for the Live Workflow editor.
 *
 * These platform-agnostic types + pure functions let a React (or
 * future desktop) editor represent a workflow under-edit as a flat
 * "DraftWorkflow", augment each capture with UI-only exposure state
 * (should this capture show up as `{{live.<NAME>}}`?), and compute the
 * minimum set of LiveVariable mutations that bring storage in line
 * with the draft on save.
 *
 * The LiveVariable entity stays a first-class, independently-owned
 * record (aliases + rename-safe public names + manual overrides keep
 * working). The editor only *owns the primary LV per capture* — one
 * LV whose (workflowUid, stepId, captureName) matches the draft
 * capture. Additional LVs pointing at the same capture (user-created
 * aliases via the Live Variables list page) are NOT touched by the
 * reconciliation.
 *
 * The reconciliation API is intentionally a pure **plan** (three
 * lists), not an imperative mutator call. The caller applies the plan
 * via its bridge/RPC of choice (extension vs desktop), decides on
 * concurrency + error handling, and could even show the plan to the
 * user as a preview.
 */

import type { Capture, Extractor, LiveVariable, LiveWorkflow, WorkflowStep } from '../types/v5/live';
import { generateUid } from '../utils/workspace';

// ── Draft types ───────────────────────────────────────────────────

/**
 * Capture augmented with UI-only exposure state. The extra fields are
 * stripped via `stripDraftSteps` before the draft is persisted — the
 * workflow schema never sees them.
 */
export interface DraftCapture extends Capture {
  /** Should this capture be exposed as `{{live.<liveName>}}`? Drives
   *  the reconcile plan: exposed → ensure an LV exists; unexposed +
   *  `liveUid` → delete that LV. */
  exposed: boolean;
  /** The `{{live.<name>}}` reference the user types in the editor.
   *  Defaults to the capture's name on first-expose. */
  liveName: string;
  /** uid of the primary LV bound to this capture, if one exists.
   *  Populated by `draftFromWorkflow` at init; the caller updates it
   *  with a newly-created LV's uid after running the plan. */
  liveUid?: string;
}

/** A workflow step whose captures are DraftCaptures. */
export interface DraftStep extends Omit<WorkflowStep, 'captures'> {
  captures: DraftCapture[];
}

/**
 * Full draft shape — every field the editor owns while the user is
 * editing. `uid` / `path` / `schemaVersion` / `version` are NOT here
 * because the editor doesn't change them; they flow through the
 * persisted workflow record.
 */
export interface DraftWorkflow {
  name: string;
  description: string;
  steps: DraftStep[];
  refresh: LiveWorkflow['refresh'];
  enabled: boolean;
}

// ── Factories + conversions ───────────────────────────────────────

/**
 * Build a DraftCapture by pairing a persisted Capture with its primary
 * LV (if any). When no LV matches, the capture starts `exposed: false`
 * — the user must explicitly flip the toggle. When an LV matches, we
 * inherit its `name` as the `liveName` so future edits default to the
 * user's chosen reference.
 */
export function toDraftCapture(c: Capture, existingLv: LiveVariable | null): DraftCapture {
  if (existingLv) {
    return { ...c, exposed: true, liveName: existingLv.name, liveUid: existingLv.uid };
  }
  return { ...c, exposed: false, liveName: c.name };
}

/**
 * Factory for a brand-new DraftCapture (the user just clicked
 * "+ Capture"). Defaults: `exposed: true`, `liveName === captureName`.
 * This is the common-path bias — most users want the capture exposed
 * under its own name.
 */
export function newDraftCapture(name: string, extractor: Extractor): DraftCapture {
  return { uid: generateUid(), name, extractor, exposed: true, liveName: name };
}

/**
 * Pick the primary LV for a capture out of the workflow's bound LV
 * set. Preference order:
 *   1. LV whose `name === captureName` (the common convention).
 *   2. Lowest-uid match by lexicographic sort (deterministic tiebreak
 *      so repeat calls pick the same primary).
 * Returns `null` when no LV matches (captureName changed without an
 * LV follow, or no LV was ever created).
 */
export function pickPrimaryLv(
  stepId: string,
  captureName: string,
  wfLvs: readonly LiveVariable[],
): LiveVariable | null {
  const matches = wfLvs.filter((lv) => lv.stepId === stepId && lv.captureName === captureName);
  if (matches.length === 0) return null;
  return (
    matches.find((lv) => lv.name === captureName) ??
    matches.slice().sort((a, b) => a.uid.localeCompare(b.uid))[0] ??
    null
  );
}

/** Build the editor's draft view from a persisted workflow + the
 *  workspace's full LiveVariable set. Captures are paired with their
 *  primary LV via `pickPrimaryLv`. */
export function draftFromWorkflow(wf: LiveWorkflow, liveVariables: readonly LiveVariable[]): DraftWorkflow {
  const wfLvs = liveVariables.filter((lv) => lv.workflowUid === wf.uid);
  return {
    name: wf.name,
    description: wf.description ?? '',
    steps: wf.steps.map((step) => ({
      ...step,
      captures: step.captures.map((c) => toDraftCapture(c, pickPrimaryLv(step.id, c.name, wfLvs))),
    })),
    refresh: wf.refresh,
    enabled: wf.enabled,
  };
}

/**
 * Strip the draft-only exposure fields from every capture so the
 * draft's step list can round-trip through the workflow schema. The
 * output is a clean `WorkflowStep[]` suitable for
 * `createWorkflow` / `updateWorkflow`.
 */
export function stripDraftSteps(steps: readonly DraftStep[]): WorkflowStep[] {
  return steps.map((s) => ({
    ...s,
    captures: s.captures.map((c) => {
      const { exposed: _exposed, liveName: _liveName, liveUid: _liveUid, ...persisted } = c;
      return persisted;
    }),
  }));
}

// ── Reconciliation plan ───────────────────────────────────────────

/** One LV to create from a newly-exposed capture. */
export interface LvCreateOp {
  stepId: string;
  captureName: string;
  liveName: string;
}

/** One LV to mutate — its pointer and/or public name drifted from the
 *  capture's draft state. */
export interface LvUpdateOp {
  liveUid: string;
  stepId: string;
  captureName: string;
  liveName: string;
}

/**
 * The full set of mutations needed to reconcile the LV store with the
 * draft's exposure state. Apply in any order — operations are
 * independent. In practice callers run creates + updates + deletes
 * sequentially for simpler error reporting; concurrency is safe but
 * the server's name-uniqueness check could trip on a rename+create
 * race.
 */
export interface LvReconcilePlan {
  creates: LvCreateOp[];
  updates: LvUpdateOp[];
  /** LV uids to delete. */
  deletes: string[];
}

/**
 * Compute the minimum reconciliation plan for a draft. Rules:
 *
 *   - Exposed capture with a `liveUid` pointing at a real LV whose
 *     (name, stepId, captureName) match the draft → no-op.
 *   - Exposed capture with a `liveUid` but any of those three fields
 *     drifted → `update`.
 *   - Exposed capture with no `liveUid` (or `liveUid` pointing at a
 *     vanished LV) → `create`.
 *   - Unexposed capture with a `liveUid` pointing at a real LV →
 *     `delete`.
 *   - Unexposed capture with no `liveUid` → no-op.
 *
 * LVs pointing at the workflow but NOT in the draft's `liveUid` set
 * are left alone (aliases owned by the LV list page, not by the
 * workflow editor).
 */
export function planLiveVariableReconcile(
  workflowUid: string,
  draft: DraftWorkflow,
  allVariables: readonly LiveVariable[],
): LvReconcilePlan {
  const existingByUid = new Map(allVariables.map((v) => [v.uid, v] as const));
  const creates: LvCreateOp[] = [];
  const updates: LvUpdateOp[] = [];
  const deletes: string[] = [];
  // Track which existing-LV uids the draft owns, so we can tell the
  // "user flipped this LV off in this session" case from the "LV was
  // never tracked by this editor" case (aliases).
  for (const step of draft.steps) {
    for (const c of step.captures) {
      if (c.exposed) {
        const existing = c.liveUid ? existingByUid.get(c.liveUid) : undefined;
        // Guard: the LV must still point at this workflow. If it
        // doesn't (the uid was recycled by storage somehow), fall
        // through to create a fresh one.
        if (existing && existing.workflowUid === workflowUid) {
          const drifted =
            existing.name !== c.liveName || existing.stepId !== step.id || existing.captureName !== c.name;
          if (drifted) {
            updates.push({
              liveUid: c.liveUid!,
              stepId: step.id,
              captureName: c.name,
              liveName: c.liveName,
            });
          }
        } else {
          creates.push({
            stepId: step.id,
            captureName: c.name,
            liveName: c.liveName,
          });
        }
      } else if (c.liveUid) {
        const existing = existingByUid.get(c.liveUid);
        if (existing && existing.workflowUid === workflowUid) {
          deletes.push(c.liveUid);
        }
      }
    }
  }
  return { creates, updates, deletes };
}
