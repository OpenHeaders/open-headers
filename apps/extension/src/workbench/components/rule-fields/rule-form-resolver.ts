/**
 * Rule conflict-resolution write helpers.
 *
 * Thin wrappers around `ruleResolveAdapter.applyResolutionToForm` /
 * `applyResolutionToEntity`. The adapter is the generic-shape
 * (`ConflictResolveAdapter<V5.Rule>`); these named exports preserve the
 * pre-refactor names for direct rule callers.
 */

import type { FormInstance } from 'antd';
import type { V5 } from '@openheaders/core/types';
import type { PathConflict } from '@/shared/conflicts/types';
import { ruleResolveAdapter } from './rule-resolve-adapter';

export function applyResolutionToForm(
  form: FormInstance,
  rule: V5.Rule,
  path: string,
  conflict: PathConflict,
): boolean {
  return ruleResolveAdapter.applyResolutionToForm(form, rule, path, conflict);
}

export function applyResolutionToRule(rule: V5.Rule, path: string, conflict: PathConflict): boolean {
  return ruleResolveAdapter.applyResolutionToEntity(rule, path, conflict);
}
