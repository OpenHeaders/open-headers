/**
 * Conflict tracking + resolve adapters for V5.LiveVariable.
 *
 * Driven by the field-tree descriptor + generic walker. Save batch
 * sends scalar leaves: name, description, enabled,
 * requireFreshOnRuleBuild, workflowUid, stepId, captureName. Manual
 * override has its own out-of-band write path and is not part of the
 * editor's save diff. No set-modeled fields.
 */

import type { V5 } from '@openheaders/core/types';
import type { ConflictResolveAdapter, ConflictTrackingAdapter } from '@/shared/conflicts/conflict-adapters';
import { leaf, obj } from '@/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@/shared/conflicts/field-tree/make-conflict-adapter';

const LIVE_VARIABLE_SCHEMA = obj({
  name: leaf('string'),
  description: leaf('string'),
  enabled: leaf('boolean', { coercion: 'boolean-strict' }),
  requireFreshOnRuleBuild: leaf('boolean', { coercion: 'boolean-strict' }),
  workflowUid: leaf('string'),
  stepId: leaf('string'),
  captureName: leaf('string'),
});

const adapters = makeConflictAdapter<V5.LiveVariable>({
  schema: LIVE_VARIABLE_SCHEMA,
  signature: (e) => e.uid,
});

const LEAF_LABEL: Record<string, string> = {
  name: 'name',
  description: 'description',
  enabled: 'enabled',
  requireFreshOnRuleBuild: 'wait for fresh value',
  workflowUid: 'workflow',
  stepId: 'step',
  captureName: 'capture',
};

export const liveVariableConflictAdapter: ConflictTrackingAdapter<V5.LiveVariable> = adapters.tracking;

export const liveVariableResolveAdapter: ConflictResolveAdapter<V5.LiveVariable> = {
  ...adapters.resolve,
  prettyPath(_entity, path) {
    const label = LEAF_LABEL[path];
    return label ? `Live variable (${label})` : path;
  },
};
