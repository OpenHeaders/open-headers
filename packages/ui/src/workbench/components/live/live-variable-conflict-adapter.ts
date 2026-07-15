/**
 * Conflict tracking + resolve adapters for LiveVariable.
 *
 * Driven by the field-tree descriptor + generic walker. Save batch
 * sends scalar leaves: name, description, enabled,
 * requireFreshOnRuleBuild, workflowUid, stepId, captureName. Manual
 * override has its own out-of-band write path and is not part of the
 * editor's save diff. No set-modeled fields.
 */

import type { LiveVariable } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { leaf, obj } from '@openheaders/ui/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';

const LIVE_VARIABLE_SCHEMA = obj({
  name: leaf('string'),
  description: leaf('string'),
  enabled: leaf('boolean', { coercion: 'boolean-strict' }),
  requireFreshOnRuleBuild: leaf('boolean', { coercion: 'boolean-strict' }),
  workflowUid: leaf('string'),
  stepId: leaf('string'),
  captureName: leaf('string'),
});

const adapters = makeConflictAdapter<LiveVariable>({
  schema: LIVE_VARIABLE_SCHEMA,
  signature: (e) => e.uid,
});

const LEAF_LABEL: Record<string, MessageKey> = {
  name: 'shared.conflicts.label.liveVariable.field.name',
  description: 'shared.conflicts.label.liveVariable.field.description',
  enabled: 'shared.conflicts.label.liveVariable.field.enabled',
  requireFreshOnRuleBuild: 'shared.conflicts.label.liveVariable.field.requireFreshOnRuleBuild',
  workflowUid: 'shared.conflicts.label.liveVariable.field.workflowUid',
  stepId: 'shared.conflicts.label.liveVariable.field.stepId',
  captureName: 'shared.conflicts.label.liveVariable.field.captureName',
};

export const liveVariableConflictAdapter: ConflictTrackingAdapter<LiveVariable> = adapters.tracking;

export const liveVariableResolveAdapter: ConflictResolveAdapter<LiveVariable> = {
  ...adapters.resolve,
  prettyPath(t, _entity, path) {
    const labelKey = LEAF_LABEL[path];
    return labelKey ? t('shared.conflicts.label.liveVariable.leaf', { label: t(labelKey) }) : path;
  },
};
