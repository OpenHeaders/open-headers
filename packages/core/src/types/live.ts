/**
 * Live Variable + Live Workflow types.
 *
 * Derived from the valibot schemas in `../../schemas/live.ts` so the
 * runtime validator and the TypeScript type stay locked together.
 *
 * See the live-variables plan for the architectural motivation.
 */

import type * as v from 'valibot';
import type {
  CallWorkflowStepSchema,
  CaptureSchema,
  ExtractorSchema,
  LiveVariableOverrideSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  PriorityRefSchema,
  PrioritySortModeSchema,
  RefreshPolicySchema,
  RetryBackoffSchema,
  StatusClassSchema,
  StatusMatchSchema,
  StepGateClauseSchema,
  StepGateSchema,
  StepRetryPolicySchema,
  UnknownWorkflowStepSchema,
} from '../schemas/live';

/** One extraction pipeline applied to a step's response. */
export type Extractor = v.InferOutput<typeof ExtractorSchema>;

/** Discriminator for {@link Extractor}. */
export type ExtractorKind = Extractor['kind'];

/** A named extraction from a single workflow step's response. */
export type Capture = v.InferOutput<typeof CaptureSchema>;

/** A step that sends one saved request. */
export type CallWorkflowStep = v.InferOutput<typeof CallWorkflowStepSchema>;

/**
 * A step this build does not know. The type names the three keys a
 * reader may assume; the value holds every key it was written with.
 */
export type UnknownWorkflowStep = Pick<v.InferOutput<typeof UnknownWorkflowStepSchema>, 'uid' | 'id' | 'action'>;

/** One ordered step in a Live Workflow. */
export type WorkflowStep = CallWorkflowStep | UnknownWorkflowStep;

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

/** Delay progression between retry attempts — defaults to `'fixed'`. */
export type RetryBackoff = v.InferOutput<typeof RetryBackoffSchema>;

/** Per-step retry policy — see {@link StepRetryPolicySchema}. */
export type StepRetryPolicy = v.InferOutput<typeof StepRetryPolicySchema>;

/** How often (and by what trigger) a workflow re-runs. */
export type RefreshPolicy = v.InferOutput<typeof RefreshPolicySchema>;

/** Discriminator for {@link RefreshPolicy}. */
export type RefreshPolicyKind = RefreshPolicy['kind'];

/** Fixed-value override applied to a Live Variable for debugging. */
export type LiveVariableOverride = v.InferOutput<typeof LiveVariableOverrideSchema>;

/** A refreshable data source — one or more ordered steps + a schedule. */
export type LiveWorkflow = Omit<v.InferOutput<typeof LiveWorkflowSchema>, 'steps'> & { steps: WorkflowStep[] };

/** A workflow whose every step this build can run. */
export type RunnableWorkflow = Omit<LiveWorkflow, 'steps'> & { steps: CallWorkflowStep[] };

/** A namespace binding: exposes one workflow step capture as `{{live.<name>}}`. */
export type LiveVariable = v.InferOutput<typeof LiveVariableSchema>;
