/**
 * Conflict tracking + resolve adapters for V5.LiveVariable.
 *
 * Save batch — `useLiveVariables.updateVariable` — sends scalar leaves:
 * name, description, enabled, requireFreshOnRuleBuild, workflowUid,
 * stepId, captureName. Manual override has its own out-of-band write
 * path (`setOverride`) and is not part of the editor's save diff;
 * skipped here.
 *
 * No set-modeled fields. `snapshotSets` returns empty — set-add /
 * set-remove / set-reorder don't apply.
 */

import type { V5 } from '@openheaders/core/types';
import { LIVE_VARIABLE_FIELD } from '@/shared/awareness';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';

const LV_LEAVES = [
  'name',
  'description',
  'enabled',
  'requireFreshOnRuleBuild',
  'workflowUid',
  'stepId',
  'captureName',
] as const;
type LvLeaf = (typeof LV_LEAVES)[number];

function readLeaf(lv: V5.LiveVariable, leaf: LvLeaf): string {
  switch (leaf) {
    case 'name':
      return String(lv.name ?? '');
    case 'description':
      return String(lv.description ?? '');
    case 'enabled':
      return lv.enabled ? 'true' : 'false';
    case 'requireFreshOnRuleBuild':
      return lv.requireFreshOnRuleBuild ? 'true' : 'false';
    case 'workflowUid':
      return String(lv.workflowUid ?? '');
    case 'stepId':
      return String(lv.stepId ?? '');
    case 'captureName':
      return String(lv.captureName ?? '');
  }
}

const LEAF_PATH: Record<LvLeaf, string> = {
  name: LIVE_VARIABLE_FIELD.name,
  description: LIVE_VARIABLE_FIELD.description,
  enabled: LIVE_VARIABLE_FIELD.enabled,
  requireFreshOnRuleBuild: LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild,
  workflowUid: LIVE_VARIABLE_FIELD.workflowUid,
  stepId: LIVE_VARIABLE_FIELD.stepId,
  captureName: LIVE_VARIABLE_FIELD.captureName,
};

const PATH_TO_LEAF = new Map<string, LvLeaf>(LV_LEAVES.map((l) => [LEAF_PATH[l], l]));

function readPath(lv: V5.LiveVariable, path: string): string | null {
  const leaf = PATH_TO_LEAF.get(path);
  return leaf ? readLeaf(lv, leaf) : null;
}

function extractBaseline(lv: V5.LiveVariable): PathMap {
  const out: PathMap = {};
  for (const leaf of LV_LEAVES) out[LEAF_PATH[leaf]] = readLeaf(lv, leaf);
  return out;
}

function snapshotSets(): readonly SetMemberSnapshot[] {
  return [];
}

export const liveVariableConflictAdapter: ConflictTrackingAdapter<V5.LiveVariable> = {
  signature: (e) => e.uid,
  extractBaseline,
  readPath,
  snapshotSets,
  snapshotSetsFromForm: () => [],
};

const LEAF_LABEL: Record<LvLeaf, string> = {
  name: 'name',
  description: 'description',
  enabled: 'enabled',
  requireFreshOnRuleBuild: 'wait for fresh value',
  workflowUid: 'workflow',
  stepId: 'step',
  captureName: 'capture',
};

export const liveVariableResolveAdapter: ConflictResolveAdapter<V5.LiveVariable> = {
  // The editor uses controlled `useState<EditDraft>` (not antd Form);
  // resolution writes go through the entity-clone path and the editor
  // projects back into its draft.
  applyResolutionToForm: () => false,
  applyResolutionToEntity(entity, path, conflict) {
    const leaf = PATH_TO_LEAF.get(path);
    if (!leaf) return false;
    const value = conflict.theirs;
    const target = entity as V5.LiveVariable & Record<string, unknown>;
    if (leaf === 'enabled' || leaf === 'requireFreshOnRuleBuild') {
      target[leaf] = value === 'true';
    } else if (leaf === 'description') {
      target.description = value;
    } else {
      target[leaf] = value;
    }
    return true;
  },
  prettyPath(_entity, path) {
    const leaf = PATH_TO_LEAF.get(path);
    return leaf ? `Live variable (${LEAF_LABEL[leaf]})` : path;
  },
};
