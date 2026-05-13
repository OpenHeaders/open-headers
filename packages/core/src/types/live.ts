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
  PriorityRefSchema,
  PrioritySortModeSchema,
  RefreshPolicySchema,
  StatusClassSchema,
  StatusMatchSchema,
  StepGateClauseSchema,
  StepGateSchema,
  WorkflowStepSchema,
} from '../schemas/live';

/** One extraction pipeline applied to a step's response. */
export type Extractor = v.InferOutput<typeof ExtractorSchema>;

/** Discriminator for {@link Extractor}. */
export type ExtractorKind = Extractor['kind'];

/** A named extraction from a single workflow step's response. */
export type Capture = v.InferOutput<typeof CaptureSchema>;

/** One ordered step in a Live Workflow. */
export type WorkflowStep = v.InferOutput<typeof WorkflowStepSchema>;

/** HTTP status-class literal accepted by `status` gate clauses. */
export type StatusClass = v.InferOutput<typeof StatusClassSchema>;

/** Match expression for a `status` gate clause — class literal or tuple. */
export type StatusMatch = v.InferOutput<typeof StatusMatchSchema>;

/** One clause inside a {@link StepGate}. */
export type StepGateClause = v.InferOutput<typeof StepGateClauseSchema>;

/** Discriminator for {@link StepGateClause}. */
export type StepGateClauseKind = StepGateClause['kind'];

/** AND-of-clauses predicate that gates whether a step runs. */
export type StepGate = v.InferOutput<typeof StepGateSchema>;

/** Sort mode for {@link PriorityRef} — defaults to `'numeric'`. */
export type PrioritySortMode = v.InferOutput<typeof PrioritySortModeSchema>;

/** Reference to an ancestor step's capture, used for runtime ordering tiebreak. */
export type PriorityRef = v.InferOutput<typeof PriorityRefSchema>;

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
