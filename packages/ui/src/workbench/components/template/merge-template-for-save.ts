/**
 * Per-field save merge for Template editors. Same architectural
 * shape as `merge-rule-for-save.ts` — Templates carry the same
 * uid-keyed set rows (conditions; formValues.requestHeaders /
 * responseHeaders / params) as Rules, plus a flat scalar metadata
 * surface (name, description, icon, includes) and a Record-shaped
 * `formValues` containing free-form extra leaves the editor doesn't
 * know about ahead of time.
 */

import type { RuleCondition, Template } from '@openheaders/core/types';
import { mergeRowsByIdentity, mergeScalarLeaves } from '@openheaders/ui/shared/forms/per-field-merge';

export interface TemplateSaveBatch {
  name: string;
  icon: string;
  description: string;
  includes: { conditions: boolean; formValues: boolean };
  conditions: RuleCondition[];
  formValues: Record<string, unknown>;
}

function projectTemplate(t: Template): TemplateSaveBatch {
  return {
    name: t.name,
    icon: t.icon,
    description: t.description,
    includes: t.includes,
    conditions: t.conditions,
    formValues: t.formValues,
  };
}

const UID_KEYED_FORM_VALUE_FIELDS = ['requestHeaders', 'responseHeaders', 'params'] as const;

function mergeFormValues(
  form: Record<string, unknown>,
  baseline: Record<string, unknown>,
  live: Record<string, unknown>,
): Record<string, unknown> {
  // First merge the uid-keyed set fields. The remaining keys merge as
  // scalar leaves.
  const setFields: Record<string, unknown> = {};
  const flatForm: Record<string, unknown> = { ...form };
  const flatBaseline: Record<string, unknown> = { ...baseline };
  const flatLive: Record<string, unknown> = { ...live };

  for (const field of UID_KEYED_FORM_VALUE_FIELDS) {
    const f = form[field];
    const b = baseline[field];
    const l = live[field];
    if (Array.isArray(f) && Array.isArray(b) && Array.isArray(l)) {
      setFields[field] = mergeRowsByIdentity(
        f as ReadonlyArray<Record<string, unknown>>,
        b as ReadonlyArray<Record<string, unknown>>,
        l as ReadonlyArray<Record<string, unknown>>,
        'uid',
      );
      delete flatForm[field];
      delete flatBaseline[field];
      delete flatLive[field];
    }
  }

  const scalar = mergeScalarLeaves(flatForm, flatBaseline, flatLive);
  return { ...scalar, ...setFields };
}

export function mergeTemplateForSave(
  form: TemplateSaveBatch,
  baseline: Template | null,
  live: Template | null,
): TemplateSaveBatch {
  if (!baseline || !live) return form;
  const baseProj = projectTemplate(baseline);
  const liveProj = projectTemplate(live);

  const conditions = mergeRowsByIdentity(
    form.conditions as ReadonlyArray<RuleCondition & Record<string, unknown>>,
    baseProj.conditions as ReadonlyArray<RuleCondition & Record<string, unknown>>,
    liveProj.conditions as ReadonlyArray<RuleCondition & Record<string, unknown>>,
    'uid',
  ) as RuleCondition[];

  const scalarForm: Record<string, unknown> = {
    name: form.name,
    icon: form.icon,
    description: form.description,
    includes: form.includes,
  };
  const scalarBase: Record<string, unknown> = {
    name: baseProj.name,
    icon: baseProj.icon,
    description: baseProj.description,
    includes: baseProj.includes,
  };
  const scalarLive: Record<string, unknown> = {
    name: liveProj.name,
    icon: liveProj.icon,
    description: liveProj.description,
    includes: liveProj.includes,
  };
  const mergedScalars = mergeScalarLeaves(scalarForm, scalarBase, scalarLive);

  const formValues = mergeFormValues(form.formValues, baseProj.formValues, liveProj.formValues);

  return {
    name: mergedScalars.name as string,
    icon: mergedScalars.icon as string,
    description: mergedScalars.description as string,
    includes: mergedScalars.includes as { conditions: boolean; formValues: boolean },
    conditions,
    formValues,
  };
}
