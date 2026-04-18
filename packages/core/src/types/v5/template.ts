/**
 * Template types — saved rule configurations that can be re-applied.
 *
 * Templates mirror the Rule structure but store form field values
 * rather than a live rule action. They live in their own collections
 * (separate from rule collections) under a TEMPLATES sidebar section.
 *
 * On disk, each template is an item folder containing `template.yaml`.
 *
 * `Template` is derived from `TemplateSchema`.
 */

import type * as v from 'valibot';
import type { TemplateSchema } from '../../schemas/template';

// ── Template ──────────────────────────────────────────────────────

export type Template = v.InferOutput<typeof TemplateSchema>;
