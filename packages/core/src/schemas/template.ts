/**
 * Valibot schema for `Template` — saved rule configurations that
 * can be re-applied. Stores a snapshot of conditions + form values.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { RuleConditionSchema, RuleTypeSchema } from './rule';

export const TemplateIncludesSchema = v.object({
  conditions: v.boolean(),
  formValues: v.boolean(),
});

export const TemplateSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  ruleType: RuleTypeSchema,
  icon: v.string(),
  description: v.string(),
  includes: TemplateIncludesSchema,
  conditions: v.array(RuleConditionSchema),
  formValues: v.record(v.string(), v.unknown()),
  createdAt: v.string(),
  updatedAt: v.string(),
});
