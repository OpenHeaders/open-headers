/**
 * Conflict tracking + resolve adapters for V5.LiveWorkflow.
 *
 * Scope (this session): workflow-level scalar leaves only.
 *   - name, description, enabled
 *   - refresh.kind (discriminator)
 *   - refresh.seconds (interval)
 *   - refresh.stepId / refresh.captureName / refresh.leadSeconds
 *     (expires-in / expires-at)
 *
 * Out of scope (deferred): step set + per-capture leaves. WorkflowStep
 * has no stable uid (step.id is user-mutable), so set-by-uid identity
 * doesn't apply cleanly — renames look like delete + add. Designing
 * stable step identity is a separate epic; until then steps + captures
 * fall back to whole-form re-prime + LWW-at-save.
 */

import type { V5 } from '@openheaders/core/types';
import { LIVE_WORKFLOW_FIELD } from '@/shared/awareness/live-paths';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';

const PATH_NAME = LIVE_WORKFLOW_FIELD.name;
const PATH_DESCRIPTION = LIVE_WORKFLOW_FIELD.description;
const PATH_ENABLED = LIVE_WORKFLOW_FIELD.enabled;
const PATH_REFRESH_KIND = 'refresh.kind';
const PATH_REFRESH_SECONDS = 'refresh.seconds';
const PATH_REFRESH_STEP_ID = 'refresh.stepId';
const PATH_REFRESH_CAPTURE_NAME = 'refresh.captureName';
const PATH_REFRESH_LEAD_SECONDS = 'refresh.leadSeconds';

function readRefreshLeaf(refresh: V5.LiveWorkflow['refresh'], path: string): string | null {
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

function readPath(wf: V5.LiveWorkflow, path: string): string | null {
  switch (path) {
    case PATH_NAME:
      return wf.name;
    case PATH_DESCRIPTION:
      return wf.description ?? '';
    case PATH_ENABLED:
      return wf.enabled ? 'true' : 'false';
    default:
      return readRefreshLeaf(wf.refresh, path);
  }
}

function extractBaseline(wf: V5.LiveWorkflow): PathMap {
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
  return out;
}

function snapshotSets(): readonly SetMemberSnapshot[] {
  return [];
}

export const liveWorkflowConflictAdapter: ConflictTrackingAdapter<V5.LiveWorkflow> = {
  signature: (e) => e.uid,
  extractBaseline,
  readPath,
  snapshotSets,
  snapshotSetsFromForm: () => [],
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

export const liveWorkflowResolveAdapter: ConflictResolveAdapter<V5.LiveWorkflow> = {
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
      // refresh.kind: switching the discriminator changes the shape's
      // required fields. The dialog presents the saved-side shape as a
      // single payload via the "Use all saved" path, not as an isolated
      // leaf. Per-leaf accept here would leave the entity in an invalid
      // state. Skip; whole-form re-prime handles kind transitions.
      default:
        return false;
    }
  },
  prettyPath(_entity, path) {
    const label = LEAF_LABEL[path];
    return label ? `Workflow (${label})` : path;
  },
};
