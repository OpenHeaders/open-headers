/**
 * Live Variable + Live Workflow types (v5).
 *
 * Derived from the valibot schemas in `../../schemas/live.ts` so the
 * runtime validator and the TypeScript type stay locked together.
 *
 * See docs/LIVE_VARIABLES_PLAN.md for the architectural motivation.
 */

import type * as v from 'valibot';
import type {
  CaptureSchema,
  ExtractorSchema,
  LiveVariableOverrideSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  RefreshPolicySchema,
  WorkflowStepSchema,
} from '../../schemas/live';

/** One extraction pipeline applied to a step's response. */
export type Extractor = v.InferOutput<typeof ExtractorSchema>;

/** Discriminator for {@link Extractor}. */
export type ExtractorKind = Extractor['kind'];

/** A named extraction from a single workflow step's response. */
export type Capture = v.InferOutput<typeof CaptureSchema>;

/** One ordered step in a Live Workflow. */
export type WorkflowStep = v.InferOutput<typeof WorkflowStepSchema>;

/** How often (and by what trigger) a workflow re-runs. */
export type RefreshPolicy = v.InferOutput<typeof RefreshPolicySchema>;

/** Discriminator for {@link RefreshPolicy}. */
export type RefreshPolicyKind = RefreshPolicy['kind'];

/** Fixed-value override applied to a Live Variable for debugging. */
export type LiveVariableOverride = v.InferOutput<typeof LiveVariableOverrideSchema>;

/** A refreshable data source — one or more ordered steps + a schedule. */
export type LiveWorkflow = v.InferOutput<typeof LiveWorkflowSchema>;

/** A namespace binding: exposes one workflow step capture as `{{live.<name>}}`. */
export type LiveVariable = v.InferOutput<typeof LiveVariableSchema>;
