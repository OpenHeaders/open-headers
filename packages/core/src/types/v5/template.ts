/**
 * Template types — saved rule configurations that can be re-applied.
 *
 * Templates mirror the Rule structure but store form field values
 * rather than a live rule action. They live in their own collections
 * (separate from rule collections) under a TEMPLATES sidebar section.
 *
 * On disk, each template is an item folder containing `template.yaml`.
 */

import type { RuleCondition, RuleType } from './rule';

// ── Template ──────────────────────────────────────────────────────

export interface Template {
  /** Persisted format version for `template.yaml`. */
  schemaVersion: number;
  /** 8-char lowercase-alphanumeric identity. Embedded in template.yaml. */
  uid: string;
  /** Relative path within the template collection hierarchy. Forward slashes. */
  path: string;
  name: string;
  /** Which rule type this template creates (header, block, redirect, etc.). */
  ruleType: RuleType;
  /** Emoji icon for display. */
  icon: string;
  /** User-provided description. */
  description: string;
  /** What this template includes when applied. */
  includes: {
    conditions: boolean;
    formValues: boolean;
  };
  /** Conditions snapshot (present when includes.conditions is true). */
  conditions: RuleCondition[];
  /** Form field values snapshot (present when includes.formValues is true). */
  formValues: Record<string, unknown>;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}
