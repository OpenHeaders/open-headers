/**
 * Conflict tracking + resolve adapters for LiveWorkflow.
 *
 * Tracks workflow-level scalar leaves AND the steps + captures
 * nested set hierarchy. WorkflowStep + Capture both carry a stable
 * 8-char `uid` (schema/live.ts) — set membership keys off that.
 * `step.id` (the user-mutable `{{step.<id>.<capture>}}` reference)
 * is tracked as a leaf at `steps.<uid>.id`, so a rename surfaces as
 * a leaf conflict instead of delete + add. In-workflow references to
 * a renamed step are auto-rebound by `rebind-step-references.ts` at
 * edit time.
 *
 * Per-step opaque leaves (`dependsOn` / `runIf` / `priorityFrom`)
 * carry the JSON-stringified subtree as the leaf value. Catches the
 * "the gate changed" granularity without designing per-clause
 * tracking for the StepGateClause variant union — a future slice
 * can subdivide if the opaque-payload UX surfaces real friction.
 *
 * Captures are tracked as a nested `setByUid` per step, with leaves
 * at `steps.<stepUid>.captures.<captureUid>.{name,extractor}`. The
 * extractor is opaque (variant union); same trade-off as the gates.
 */

import { canonicalJson } from '@openheaders/core/sync';
import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';

const PATH_NAME = LIVE_WORKFLOW_FIELD.name;
const PATH_DESCRIPTION = LIVE_WORKFLOW_FIELD.description;
const PATH_ENABLED = LIVE_WORKFLOW_FIELD.enabled;
const PATH_REFRESH_KIND = 'refresh.kind';
const PATH_REFRESH_SECONDS = 'refresh.seconds';
const PATH_REFRESH_STEP_ID = 'refresh.stepId';
const PATH_REFRESH_CAPTURE_NAME = 'refresh.captureName';
const PATH_REFRESH_LEAD_SECONDS = 'refresh.leadSeconds';

const STEP_LEAF_RE =
  /^steps\.([a-z0-9]{8})\.(id|description|requestUid|dependsOn|runIf|priorityFrom|retry|timeoutMs|runScripts)$/;
const CAPTURE_LEAF_RE = /^steps\.([a-z0-9]{8})\.captures\.([a-z0-9]{8})\.(name|extractor)$/;

const STEP_SET_PATH = 'steps';
const stepCapturesSetPath = (stepUid: string): string => `steps.${stepUid}.captures`;

// ── Helpers ───────────────────────────────────────────────────────

/** Stable JSON for opaque-leaf payloads — object keys sorted
 *  recursively, array order preserved (it is semantic, e.g. dependsOn
 *  declares topological intent). Key order MUST be normalized:
 *  Chrome's storage round-trip alphabetizes object keys while
 *  form-built objects carry edit-insertion order, so a plain
 *  stringify reads the same structure as two different values. */
function opaqueStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  return canonicalJson(value);
}

function findStep(wf: LiveWorkflow, stepUid: string): WorkflowStep | undefined {
  return wf.steps.find((s) => s.uid === stepUid);
}

function findCapture(step: WorkflowStep, captureUid: string): WorkflowStep['captures'][number] | undefined {
  return step.captures.find((c) => c.uid === captureUid);
}

function readStepLeaf(step: WorkflowStep, leaf: string): string | null {
  switch (leaf) {
    case 'id':
      return step.id;
    case 'description':
      return step.description ?? '';
    case 'requestUid':
      return step.requestUid;
    case 'dependsOn':
      return opaqueStringify(step.dependsOn ?? []);
    case 'runIf':
      return opaqueStringify(step.runIf);
    case 'priorityFrom':
      return opaqueStringify(step.priorityFrom);
    case 'retry':
      return opaqueStringify(step.retry);
    case 'timeoutMs':
      return step.timeoutMs === undefined ? '' : String(step.timeoutMs);
    case 'runScripts':
      return step.runScripts === undefined ? '' : String(step.runScripts);
    default:
      return null;
  }
}

function readCaptureLeaf(capture: WorkflowStep['captures'][number], leaf: string): string | null {
  switch (leaf) {
    case 'name':
      return capture.name;
    case 'extractor':
      return opaqueStringify(capture.extractor);
    default:
      return null;
  }
}

function readRefreshLeaf(refresh: LiveWorkflow['refresh'], path: string): string | null {
  switch (path) {
    case PATH_REFRESH_KIND:
      return refresh.kind;
    case PATH_REFRESH_SECONDS:
      return refresh.kind === 'interval' ? String(refresh.seconds) : '';
    case PATH_REFRESH_STEP_ID:
      return refresh.kind === 'expires-in' || refresh.kind === 'expires-at' ? refresh.stepId : '';
    case PATH_REFRESH_CAPTURE_NAME:
      return refresh.kind === 'expires-in' || refresh.kind === 'expires-at' ? refresh.captureName : '';
    case PATH_REFRESH_LEAD_SECONDS:
      return refresh.kind === 'expires-in' || refresh.kind === 'expires-at' ? String(refresh.leadSeconds) : '';
    default:
      return null;
  }
}

function readPath(wf: LiveWorkflow, path: string): string | null {
  switch (path) {
    case PATH_NAME:
      return wf.name;
    case PATH_DESCRIPTION:
      return wf.description ?? '';
    case PATH_ENABLED:
      return wf.enabled ? 'true' : 'false';
  }
  const refreshLeaf = readRefreshLeaf(wf.refresh, path);
  if (refreshLeaf !== null) return refreshLeaf;
  const stepMatch = STEP_LEAF_RE.exec(path);
  if (stepMatch) {
    const step = findStep(wf, stepMatch[1]);
    if (!step) return null;
    return readStepLeaf(step, stepMatch[2]);
  }
  const capMatch = CAPTURE_LEAF_RE.exec(path);
  if (capMatch) {
    const step = findStep(wf, capMatch[1]);
    if (!step) return null;
    const capture = findCapture(step, capMatch[2]);
    if (!capture) return null;
    return readCaptureLeaf(capture, capMatch[3]);
  }
  return null;
}

function extractBaseline(wf: LiveWorkflow): PathMap {
  const out: PathMap = {
    [PATH_NAME]: wf.name,
    [PATH_DESCRIPTION]: wf.description ?? '',
    [PATH_ENABLED]: wf.enabled ? 'true' : 'false',
    [PATH_REFRESH_KIND]: wf.refresh.kind,
  };
  switch (wf.refresh.kind) {
    case 'interval':
      out[PATH_REFRESH_SECONDS] = String(wf.refresh.seconds);
      break;
    case 'expires-in':
    case 'expires-at':
      out[PATH_REFRESH_STEP_ID] = wf.refresh.stepId;
      out[PATH_REFRESH_CAPTURE_NAME] = wf.refresh.captureName;
      out[PATH_REFRESH_LEAD_SECONDS] = String(wf.refresh.leadSeconds);
      break;
    case 'manual':
      break;
  }
  for (const step of wf.steps) {
    out[`steps.${step.uid}.id`] = step.id;
    out[`steps.${step.uid}.description`] = step.description ?? '';
    out[`steps.${step.uid}.requestUid`] = step.requestUid;
    out[`steps.${step.uid}.dependsOn`] = opaqueStringify(step.dependsOn ?? []);
    out[`steps.${step.uid}.runIf`] = opaqueStringify(step.runIf);
    out[`steps.${step.uid}.priorityFrom`] = opaqueStringify(step.priorityFrom);
    out[`steps.${step.uid}.retry`] = opaqueStringify(step.retry);
    out[`steps.${step.uid}.timeoutMs`] = step.timeoutMs === undefined ? '' : String(step.timeoutMs);
    out[`steps.${step.uid}.runScripts`] = step.runScripts === undefined ? '' : String(step.runScripts);
    for (const capture of step.captures) {
      out[`steps.${step.uid}.captures.${capture.uid}.name`] = capture.name;
      out[`steps.${step.uid}.captures.${capture.uid}.extractor`] = opaqueStringify(capture.extractor);
    }
  }
  return out;
}

function snapshotSets(wf: LiveWorkflow): readonly SetMemberSnapshot[] {
  const out: SetMemberSnapshot[] = [];
  const stepsMap = new Map<string, SetMember>();
  for (const step of wf.steps) {
    stepsMap.set(step.uid, {
      uid: step.uid,
      summary: step.id || '(unnamed step)',
      payload: step,
    });
  }
  out.push({ setPath: STEP_SET_PATH, byUid: stepsMap });
  for (const step of wf.steps) {
    const captures = new Map<string, SetMember>();
    for (const capture of step.captures) {
      captures.set(capture.uid, {
        uid: capture.uid,
        summary: capture.name || '(unnamed capture)',
        payload: capture,
      });
    }
    out.push({ setPath: stepCapturesSetPath(step.uid), byUid: captures });
  }
  return out;
}

/**
 * Reconstruct set membership from a PathMap. Set members surface to
 * the form via their leaf paths — scanning for `steps.<uid>.id` keys
 * (the canonical per-step leaf every step always emits) yields the
 * full step uid set; ditto for captures via `steps.<uid>.captures.<uid>.name`.
 *
 * Form-side payloads are stub `{ uid }` objects — the live-side
 * snapshot carries the full payload that resolves consult; the
 * form-side snapshot only needs to expose membership for the tracker's
 * add/remove/reorder detection.
 */
function snapshotSetsFromForm(form: PathMap): readonly SetMemberSnapshot[] {
  const stepsMap = new Map<string, SetMember>();
  const capturesByStep = new Map<string, Map<string, SetMember>>();
  for (const path of Object.keys(form)) {
    const stepMatch = STEP_LEAF_RE.exec(path);
    if (stepMatch && stepMatch[2] === 'id') {
      const stepUid = stepMatch[1];
      if (!stepsMap.has(stepUid)) {
        stepsMap.set(stepUid, { uid: stepUid, summary: form[path] || '(unnamed step)', payload: { uid: stepUid } });
      }
      continue;
    }
    const capMatch = CAPTURE_LEAF_RE.exec(path);
    if (capMatch && capMatch[3] === 'name') {
      const stepUid = capMatch[1];
      const capUid = capMatch[2];
      let bucket = capturesByStep.get(stepUid);
      if (!bucket) {
        bucket = new Map();
        capturesByStep.set(stepUid, bucket);
      }
      if (!bucket.has(capUid)) {
        bucket.set(capUid, { uid: capUid, summary: form[path] || '(unnamed capture)', payload: { uid: capUid } });
      }
    }
  }
  const out: SetMemberSnapshot[] = [{ setPath: STEP_SET_PATH, byUid: stepsMap }];
  for (const [stepUid, captures] of capturesByStep) {
    out.push({ setPath: stepCapturesSetPath(stepUid), byUid: captures });
  }
  // Steps that have no captures still need an empty snapshot so
  // the tracker can detect "captures were added on the saved side"
  // for that step. Walk the step set and fill blanks.
  for (const stepUid of stepsMap.keys()) {
    if (!capturesByStep.has(stepUid)) {
      out.push({ setPath: stepCapturesSetPath(stepUid), byUid: new Map() });
    }
  }
  return out;
}

export const liveWorkflowConflictAdapter: ConflictTrackingAdapter<LiveWorkflow> = {
  signature: (e) => e.uid,
  extractBaseline,
  readPath,
  snapshotSets,
  snapshotSetsFromForm: (form) => snapshotSetsFromForm(form),
};

const LEAF_LABEL: Record<string, string> = {
  [PATH_NAME]: 'name',
  [PATH_DESCRIPTION]: 'description',
  [PATH_ENABLED]: 'enabled',
  [PATH_REFRESH_KIND]: 'refresh kind',
  [PATH_REFRESH_SECONDS]: 'refresh interval',
  [PATH_REFRESH_STEP_ID]: 'refresh step',
  [PATH_REFRESH_CAPTURE_NAME]: 'refresh capture',
  [PATH_REFRESH_LEAD_SECONDS]: 'refresh lead seconds',
};

const STEP_LEAF_LABEL: Record<string, string> = {
  id: 'id',
  description: 'description',
  requestUid: 'request',
  dependsOn: 'dependsOn',
  runIf: 'runIf',
  priorityFrom: 'priorityFrom',
  retry: 'retry policy',
  timeoutMs: 'timeout',
  runScripts: 'run scripts',
};

const CAPTURE_LEAF_LABEL: Record<string, string> = {
  name: 'name',
  extractor: 'extractor',
};

function writeStepLeaf(step: WorkflowStep, leaf: string, value: string): boolean {
  switch (leaf) {
    case 'id':
      step.id = value;
      return true;
    case 'description':
      step.description = value === '' ? undefined : value;
      return true;
    case 'requestUid':
      step.requestUid = value;
      return true;
    case 'dependsOn':
    case 'runIf':
    case 'priorityFrom':
    case 'retry': {
      try {
        const parsed = value === '' ? undefined : (JSON.parse(value) as unknown);
        if (leaf === 'dependsOn') step.dependsOn = parsed as WorkflowStep['dependsOn'];
        else if (leaf === 'runIf') step.runIf = parsed as WorkflowStep['runIf'];
        else if (leaf === 'retry') step.retry = parsed as WorkflowStep['retry'];
        else step.priorityFrom = parsed as WorkflowStep['priorityFrom'];
        return true;
      } catch {
        return false;
      }
    }
    case 'timeoutMs': {
      if (value === '') {
        step.timeoutMs = undefined;
        return true;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return false;
      step.timeoutMs = parsed;
      return true;
    }
    case 'runScripts':
      step.runScripts = value === '' ? undefined : value === 'true';
      return true;
    default:
      return false;
  }
}

function writeCaptureLeaf(capture: WorkflowStep['captures'][number], leaf: string, value: string): boolean {
  switch (leaf) {
    case 'name':
      capture.name = value;
      return true;
    case 'extractor': {
      try {
        capture.extractor = JSON.parse(value) as WorkflowStep['captures'][number]['extractor'];
        return true;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export const liveWorkflowResolveAdapter: ConflictResolveAdapter<LiveWorkflow> = {
  applyResolutionToForm: () => false,
  applyResolutionToEntity(entity, path, conflict) {
    const value = conflict.theirs;
    switch (path) {
      case PATH_NAME:
        entity.name = value;
        return true;
      case PATH_DESCRIPTION:
        entity.description = value;
        return true;
      case PATH_ENABLED:
        entity.enabled = value === 'true';
        return true;
      case PATH_REFRESH_SECONDS:
        if (entity.refresh.kind === 'interval') {
          entity.refresh = { ...entity.refresh, seconds: Number(value) };
          return true;
        }
        return false;
      case PATH_REFRESH_STEP_ID:
        if (entity.refresh.kind === 'expires-in' || entity.refresh.kind === 'expires-at') {
          entity.refresh = { ...entity.refresh, stepId: value };
          return true;
        }
        return false;
      case PATH_REFRESH_CAPTURE_NAME:
        if (entity.refresh.kind === 'expires-in' || entity.refresh.kind === 'expires-at') {
          entity.refresh = { ...entity.refresh, captureName: value };
          return true;
        }
        return false;
      case PATH_REFRESH_LEAD_SECONDS:
        if (entity.refresh.kind === 'expires-in' || entity.refresh.kind === 'expires-at') {
          entity.refresh = { ...entity.refresh, leadSeconds: Number(value) };
          return true;
        }
        return false;
    }
    const stepMatch = STEP_LEAF_RE.exec(path);
    if (stepMatch) {
      const step = findStep(entity, stepMatch[1]);
      if (!step) return false;
      return writeStepLeaf(step, stepMatch[2], value);
    }
    const capMatch = CAPTURE_LEAF_RE.exec(path);
    if (capMatch) {
      const step = findStep(entity, capMatch[1]);
      if (!step) return false;
      const capture = findCapture(step, capMatch[2]);
      if (!capture) return false;
      return writeCaptureLeaf(capture, capMatch[3], value);
    }
    // refresh.kind: switching the discriminator changes the shape's
    // required fields. Whole-form re-prime handles kind transitions.
    return false;
  },
  prettyPath(entity, path) {
    const label = LEAF_LABEL[path];
    if (label) return `Workflow (${label})`;
    const stepMatch = STEP_LEAF_RE.exec(path);
    if (stepMatch) {
      const step = findStep(entity, stepMatch[1]);
      const stepLabel = step?.id || `step ${stepMatch[1].slice(0, 4)}`;
      return `Step ${stepLabel} (${STEP_LEAF_LABEL[stepMatch[2]] ?? stepMatch[2]})`;
    }
    const capMatch = CAPTURE_LEAF_RE.exec(path);
    if (capMatch) {
      const step = findStep(entity, capMatch[1]);
      const stepLabel = step?.id || `step ${capMatch[1].slice(0, 4)}`;
      const capture = step ? findCapture(step, capMatch[2]) : undefined;
      const capLabel = capture?.name || `capture ${capMatch[2].slice(0, 4)}`;
      return `Step ${stepLabel} → ${capLabel} (${CAPTURE_LEAF_LABEL[capMatch[3]] ?? capMatch[3]})`;
    }
    return path;
  },
};
