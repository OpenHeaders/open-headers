/**
 * `ConflictTrackingAdapter<V5.Template>` + `ConflictResolveAdapter<V5.Template>`
 * — thin bindings around the shared action-entity factory.
 *
 * Templates persist action data under `formValues.*` (vs Rule's
 * `action.*`) and use `queryParams` rather than `params` for query
 * params. Both axes are encoded by `TEMPLATE_ACTION_PATHS`. The form
 * owns `templateName` so name conflicts resolve to the form (unlike
 * Rule where `name` is externally owned by the sidebar).
 */

import type { V5 } from '@openheaders/core/types';
import { TEMPLATE_ACTION_PATHS } from '@/shared/awareness';
import { createActionEntityAdapters } from '@/shared/conflicts/action-entity-adapter';

const adapters = createActionEntityAdapters<V5.Template>(TEMPLATE_ACTION_PATHS, {
  signature: (t) => t.uid,
  getRuleType: (t) => t.ruleType,
  discriminatorField: 'ruleType',
  getName: (t) => t.name,
  getConditions: (t) => t.conditions,
  setName: (t, value) => {
    (t as { name: string }).name = value;
  },
  setConditions: (t, value) => {
    (t as { conditions: V5.RuleCondition[] }).conditions = value;
  },
  getActionRoot: (t) => t.formValues as Record<string, unknown>,
  nameFormName: 'templateName',
});

export const templateConflictAdapter = adapters.tracking;
export const templateResolveAdapter = adapters.resolve;
