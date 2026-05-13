/**
 * Valibot schemas for Live Variables + Live Workflows.
 *
 * See docs/LIVE_VARIABLES_PLAN.md for the architectural motivation.
 *
 * ── Entity split ──────────────────────────────────────────────────
 *
 *   LiveWorkflow — a refreshable data source. Owns the ordered step
 *   list, the refresh schedule, and (at runtime) the cached step
 *   captures + failure state. A "single request LV" is internally a
 *   workflow with exactly one step; chains have many. Multiple
 *   LiveVariables can bind to one workflow and refresh atomically
 *   with it.
 *
 *   LiveVariable — a thin namespace projection. "Expose
 *   `<workflow>.<stepId>.<captureName>` as `{{live.<name>}}`." All
 *   extraction logic lives on the workflow's step captures; the LV
 *   is just the binding + UX metadata (manual override, sync-warm
 *   flag, enabled state).
 *
 * ── Identifier conventions ────────────────────────────────────────
 *
 *   - `stepId`, `captureName`, and `LiveVariable.name` all share a
 *     strict identifier shape (leading letter / underscore, followed
 *     by letters / digits / underscore / hyphen). No dots — the dot
 *     is the separator inside `{{step.<stepId>.<captureName>}}`, and
 *     the resolver splits on the first dot after `step.`, so any dot
 *     inside a stepId or capture name would ambiguate the reference.
 *   - `uid` width + charset live in `common.ts` (8-char lowercase
 *     alphanumeric, invariant #2).
 *   - `LiveVariable.name` doubles as the namespace key in `{{live.X}}`
 *     templates, so it must be a valid identifier AND unique within
 *     the workspace. Uniqueness is enforced by the store layer, not
 *     at the schema boundary (same as `Environment.name`).
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

// ── Shared identifier shapes ──────────────────────────────────────

/**
 * Step ids and capture names — both must be URL-safe identifiers
 * without dots, so `{{step.<id>.<capture>}}` parses unambiguously.
 */
const IDENT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const IDENT_MESSAGE =
  'Must start with a letter or underscore; only letters, digits, hyphens, and underscores are allowed.';

export const StepIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64), v.regex(IDENT_PATTERN, IDENT_MESSAGE));

export const CaptureNameSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(IDENT_PATTERN, IDENT_MESSAGE),
);

/**
 * Live Variable names double as the namespace key in `{{live.<name>}}`
 * templates. Same identifier shape as step ids + capture names.
 */
export const LiveVariableNameSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(IDENT_PATTERN, IDENT_MESSAGE),
);

// ── Extractor ─────────────────────────────────────────────────────

/**
 * Discriminated union over the five v1 extractor kinds.
 *
 * - `json-path` — `$.a.b`, `$.a[0]`, dotted paths. The v1 evaluator
 *   supports only a minimal subset (no wildcards, no filters); expand
 *   as real use cases justify the complexity.
 * - `header` — case-insensitive response-header lookup.
 * - `body-regex` — JavaScript `RegExp` over the text body; `group`
 *   defaults to 0 (whole match) when absent.
 * - `whole-body` — the text body verbatim. Errors if the body is
 *   binary (Content-Type doesn't decode as text).
 * - `status-code` — the numeric status code as a decimal string (e.g.
 *   `"200"`). Handy for rules that want to capture upstream liveness.
 */
export const ExtractorSchema = v.variant('kind', [
  v.object({
    kind: v.literal('json-path'),
    path: v.pipe(v.string(), v.minLength(1)),
  }),
  v.object({
    kind: v.literal('header'),
    name: v.pipe(v.string(), v.minLength(1)),
  }),
  v.object({
    kind: v.literal('body-regex'),
    pattern: v.pipe(v.string(), v.minLength(1)),
    /** RegExp group index to return; defaults to 0 (whole match). */
    group: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  }),
  v.object({
    kind: v.literal('whole-body'),
  }),
  v.object({
    kind: v.literal('status-code'),
  }),
]);

// ── Capture ───────────────────────────────────────────────────────

/**
 * A named extraction from one workflow step's response. Referenced
 * within later steps as `{{step.<stepId>.<captureName>}}`; exposed to
 * `{{live.X}}` only if a `LiveVariable` binds to it.
 */
export const CaptureSchema = v.object({
  uid: UidSchema,
  name: CaptureNameSchema,
  description: v.optional(v.string()),
  extractor: ExtractorSchema,
});

// ── Step gate clauses (Phase I — conditional execution) ───────────

/**
 * HTTP status range — accepted by `status` gate clauses in either
 * class-literal form (`'2xx'`, `'4xx'`) or tuple form for exact /
 * negated / in-list matches. Tuple form serializes cleanly in YAML
 * (`match: [eq, 200]`) and the discriminating `'eq'` / `'ne'` / `'in'`
 * literal keeps the union unambiguous.
 */
export const StatusClassSchema = v.picklist(['2xx', '3xx', '4xx', '5xx'] as const);

const HttpStatusNumberSchema = v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(599));

export const StatusMatchSchema = v.union([
  StatusClassSchema,
  v.tuple([v.literal('eq'), HttpStatusNumberSchema]),
  v.tuple([v.literal('ne'), HttpStatusNumberSchema]),
  v.tuple([v.literal('in'), v.pipe(v.array(HttpStatusNumberSchema), v.minLength(1))]),
]);

/**
 * One clause inside a {@link StepGateSchema}. v1 ships four kinds;
 * future kinds (`capture-numeric-compare`, `capture-in-list`,
 * `header-contains`) land with their own schema variants later.
 *
 * Every clause references a `stepId` that must be a transitive
 * `dependsOn` ancestor of the gated step. Validator enforces this;
 * schema only enforces shape.
 */
export const StepGateClauseSchema = v.variant('kind', [
  v.object({
    kind: v.literal('status'),
    uid: UidSchema,
    stepId: StepIdSchema,
    match: StatusMatchSchema,
  }),
  v.object({
    kind: v.literal('capture-exists'),
    uid: UidSchema,
    stepId: StepIdSchema,
    captureName: CaptureNameSchema,
  }),
  v.object({
    kind: v.literal('capture-equals'),
    uid: UidSchema,
    stepId: StepIdSchema,
    captureName: CaptureNameSchema,
    value: v.string(),
  }),
  v.object({
    kind: v.literal('capture-matches'),
    uid: UidSchema,
    stepId: StepIdSchema,
    captureName: CaptureNameSchema,
    /** JavaScript `RegExp` source. Compiled at evaluation time. */
    pattern: v.pipe(v.string(), v.minLength(1)),
  }),
]);

/**
 * Step gate — an AND-of-clauses predicate. Empty list matches
 * everything (equivalent to no gate). `any: [...]` for OR semantics is
 * reserved for a future phase; the UI surfaces it as disabled.
 */
export const StepGateSchema = v.object({
  all: v.array(StepGateClauseSchema),
});

// ── Priority reference (Phase I — runtime ordering tiebreak) ──────

export const PrioritySortModeSchema = v.picklist(['numeric', 'lexicographic'] as const);

/**
 * Reads a value from an ancestor step's capture to decide ordering
 * among multiple ready-set steps. Missing capture at runtime → sorted
 * last; non-parseable under `numeric` → falls back to lexicographic
 * comparison. Both degradations are explicit non-errors — the runner
 * prefers "keep going" over "abort for metadata."
 */
export const PriorityRefSchema = v.object({
  stepId: StepIdSchema,
  captureName: CaptureNameSchema,
  sort: v.optional(PrioritySortModeSchema),
});

// ── Workflow step ─────────────────────────────────────────────────

export const WorkflowStepSchema = v.object({
  uid: UidSchema,
  id: StepIdSchema,
  description: v.optional(v.string()),
  /** Uid of the persisted `Request` this step invokes. */
  requestUid: UidSchema,
  captures: v.array(CaptureSchema),
  /**
   * Phase I — ordered DAG edges. stepIds of direct ancestors whose
   * completion this step waits on. Empty / absent = root step.
   * Validator rejects cycles + unknown stepIds; runner walks the
   * graph topologically. Declared array order is the canonical
   * serialization; execution order is determined by deps + priority.
   */
  dependsOn: v.optional(v.array(StepIdSchema)),
  /**
   * Phase I — conditional gate. AND-of-clauses predicate over prior
   * step captures / statuses. Absent = always run. Gate references
   * must resolve to transitive ancestors (validator enforces).
   */
  runIf: v.optional(StepGateSchema),
  /**
   * Phase I — runtime ordering tiebreak among ready-set steps.
   * Absent = declared-list position breaks ties.
   */
  priorityFrom: v.optional(PriorityRefSchema),
});

// ── Refresh policy ────────────────────────────────────────────────

/**
 * Minimum refresh interval in seconds. Chrome's packed MV3 build
 * clamps `chrome.alarms.create` to a 30-second floor; schemas mirror
 * that so editors can't persist sub-floor values.
 */
export const MIN_REFRESH_INTERVAL_SECONDS = 30;

/**
 * Discriminated union over the four refresh cadences.
 *
 * - `interval` — fire every N seconds.
 * - `expires-in` — read a numeric seconds value from a step's capture
 *   and fire `leadSeconds` BEFORE that many seconds have passed since
 *   the last refresh. Classic OAuth `expires_in` shape.
 * - `expires-at` — read an absolute milliseconds value from a
 *   capture (e.g. a JWT `exp` field) and fire at
 *   `value - leadSeconds * 1000`.
 * - `manual` — never auto-fire; the user refreshes explicitly.
 */
export const RefreshPolicySchema = v.variant('kind', [
  v.object({
    kind: v.literal('interval'),
    seconds: v.pipe(v.number(), v.integer(), v.minValue(MIN_REFRESH_INTERVAL_SECONDS)),
  }),
  v.object({
    kind: v.literal('expires-in'),
    stepId: StepIdSchema,
    captureName: CaptureNameSchema,
    leadSeconds: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  v.object({
    kind: v.literal('expires-at'),
    stepId: StepIdSchema,
    captureName: CaptureNameSchema,
    leadSeconds: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  v.object({
    kind: v.literal('manual'),
  }),
]);

// ── LiveWorkflow ──────────────────────────────────────────────────

export const LiveWorkflowSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.string()),
  steps: v.pipe(v.array(WorkflowStepSchema), v.minLength(1)),
  refresh: RefreshPolicySchema,
  enabled: v.boolean(),
  /**
   * Publication gate (CMS pattern). The refresh scheduler + every
   * downstream consumer (LV resolver, sync-warm path) filter on
   * `isWorkflowEffective`, which gates on `published === true`. New
   * workflows from `+ New Live Workflow` start `published: false` so
   * per-keystroke edits stream into a real entity without firing
   * scheduled requests against the user's network. Type-level
   * `published?: boolean`; runtime contract is "anything not `=== true`
   * is draft." See `memory/project_publication_gate_decision.md`.
   */
  published: v.optional(v.boolean()),
  /**
   * Phase I — reserved for a future parallel-execution runner.
   * Accepted in the schema so UI-side YAML edits round-trip, but the
   * v1 validator (`validateWorkflowShape`) rejects `true` with a
   * structured `parallel-not-yet-implemented` error. Absent / false =
   * sequential execution (today's behavior).
   */
  parallelExecution: v.optional(v.boolean()),
});

// ── LiveVariable ──────────────────────────────────────────────────

/**
 * Manual-override fixed value — while active, the resolver serves
 * `value` for `{{live.<name>}}`. The scheduler keeps refreshing the
 * backing workflow regardless, so toggling the override off exposes a
 * fresh cached value with no warm-up gap. If `until` is set, the
 * override expires at that wall-clock ms; absent means indefinite.
 */
export const LiveVariableOverrideSchema = v.object({
  value: v.string(),
  until: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const LiveVariableSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  /** Namespace key: referenced as `{{live.<name>}}`. Unique within the workspace. */
  name: LiveVariableNameSchema,
  description: v.optional(v.string()),
  /** Uid of the owning workflow. */
  workflowUid: UidSchema,
  /** Which step of the workflow this LV reads from. */
  stepId: StepIdSchema,
  /** Which capture within that step supplies the value. */
  captureName: CaptureNameSchema,
  /**
   * When true, rule compile blocks on the backing workflow's refresh
   * if its cache is stale (sync-warm path). Default: async-warm.
   */
  requireFreshOnRuleBuild: v.optional(v.boolean()),
  manualOverride: v.optional(LiveVariableOverrideSchema),
  enabled: v.boolean(),
  /**
   * Publication gate (CMS pattern). Variable resolvers (rule compile,
   * inspector chain) filter on `isLiveVariableEffective`, which gates
   * on `published === true`. New variables from `+ New Live Variable`
   * start `published: false` so per-keystroke edits don't expose
   * half-typed bindings to live `{{live.<name>}}` resolution. Same
   * contract as the workflow gate above.
   */
  published: v.optional(v.boolean()),
});
