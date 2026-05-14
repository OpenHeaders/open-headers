/**
 * `ConflictTrackingAdapter<Rule>` — thin binding around the shared
 * action-entity factory in `shared/conflicts/action-entity-adapter.ts`.
 *
 * Rule + Template share the per-rule-type field components and observe
 * identical conflict structure; the factory captures the shape once and
 * each entity supplies an `ActionEntityAccessors` shim.
 */

import type { Rule, RuleCondition } from '@openheaders/core/types';
import { RULE_ACTION_PATHS } from '@openheaders/ui/shared/awareness';
import { createActionEntityAdapters } from '@openheaders/ui/shared/conflicts/action-entity-adapter';

const adapters = createActionEntityAdapters<Rule>(RULE_ACTION_PATHS, {
  signature: (r) => r.uid,
  getRuleType: (r) => r.type,
  discriminatorField: 'type',
  getName: (r) => r.name,
  getConditions: (r) => r.conditions,
  setName: (r, value) => {
    (r as { name: string }).name = value;
  },
  setConditions: (r, value) => {
    (r as { conditions: RuleCondition[] }).conditions = value;
  },
  getActionRoot: (r) => (r as unknown as { action?: Record<string, unknown> }).action,
  // Rule's `name` is externally owned (sidebar / breadcrumb rename).
  // The form has no `name` field, so name conflicts only resolve via
  // applyResolutionToEntity (diff dialog right-pane preview).
  nameFormName: null,
});

export const ruleConflictAdapter = adapters.tracking;
export const ruleResolveAdapterShared = adapters.resolve;
