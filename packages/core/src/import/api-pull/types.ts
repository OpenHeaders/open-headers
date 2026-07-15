export interface PullWorkspaceSummary {
  id: string;
  name: string;
  type?: string;
}

/** One item the plan will pull — deduped across workspaces. */
export interface PullPlanItem {
  item: 'collection' | 'environment';
  id: string;
  name?: string;
  /** Workspaces that listed the item (collections can be shared). */
  workspaceIds: string[];
}

export interface PostmanPullPlan {
  workspaces: PullWorkspaceSummary[];
  items: PullPlanItem[];
  /** The run's full call cost: 1 + 2W + C + E (detail + globals per workspace). */
  totalCalls: number;
}

/**
 * Budget state read from response headers — never hardcoded plan caps;
 * monthly caps drift across plan lineups.
 */
export interface PullRateBudget {
  limitMonth?: number;
  remainingMonth?: number;
  retryAfterSeconds?: number;
}

export type PullFailureKind =
  /** HTTP 429 minute-bucket — transient: honor RetryAfter and resume. */
  | 'rate-limited'
  /** Monthly service cap — terminal for the run: partial report, no retry. */
  | 'service-limit-exhausted'
  /** Key rejected — terminal; the message never echoes the key. */
  | 'unauthorized'
  /** Anything else — an item-level skip; the run continues. */
  | 'http-error';

export interface PullFailure {
  kind: PullFailureKind;
  status: number;
  reason: string;
  retryAfterSeconds?: number;
}

/** A pulled collection, unwrapped and ready for `parsePostman`. */
export interface PulledCollection {
  item: 'collection';
  id: string;
  name?: string;
  /** Collection v2.1 JSON. */
  json: string;
  /** Workspaces that listed the item — parity materialization lands it in each. */
  workspaceIds: string[];
}

/** A pulled environment, unwrapped and ready for `parsePostmanEnvironment`. */
export interface PulledEnvironment {
  item: 'environment';
  id: string;
  name?: string;
  json: string;
  /** Workspaces that listed the item — parity materialization lands it in each. */
  workspaceIds: string[];
}

/**
 * One workspace-global variable row, normalized to the Variable
 * vocabulary: `type: 'secret'` lands verbatim, `enabled` carries only
 * the explicit `false` (absent means enabled — the model's contract).
 */
export interface PullGlobalVariable {
  name: string;
  value: string;
  type: 'default' | 'secret';
  enabled?: boolean;
}

/**
 * One workspace's global variables, ready to land as workspace-scoped
 * variables. Globals are per-workspace on the wire (never shared), so
 * the attribution is a single id. An entry with zero variables is wire
 * truth — the workspace has no globals — and materializes nothing.
 */
export interface PulledWorkspaceGlobals {
  workspaceId: string;
  variables: PullGlobalVariable[];
}

/** An item that yielded no payload — always with the reason. */
export interface PostmanPullSkip {
  item: 'workspace' | 'collection' | 'environment';
  id: string;
  name?: string;
  reason: string;
  /**
   * Workspaces the skip concerns — routes it into those workspaces'
   * reports. Absent when unattributable (a malformed list entry);
   * such skips surface in every report of the run.
   */
  workspaceIds?: string[];
}

export type PostmanPullOutcome = 'complete' | 'partial' | 'failed';

export interface PostmanPullResult {
  outcome: PostmanPullOutcome;
  /** Present when the run stopped early — the clearly-labeled cause. */
  stopReason?: string;
  workspaces: PullWorkspaceSummary[];
  collections: PulledCollection[];
  environments: PulledEnvironment[];
  globals: PulledWorkspaceGlobals[];
  skipped: PostmanPullSkip[];
  budget: { limitMonth?: number; remainingMonth?: number };
  callsMade: number;
}

/**
 * A workspace preview for the pre-pull selection step: names + item
 * counts, so the user picks which vendor workspaces to import before
 * any payload is pulled.
 */
export interface PostmanWorkspacePreview {
  id: string;
  name: string;
  type?: string;
  collections: number;
  environments: number;
}

export type PostmanWorkspaceListResult =
  | { ok: true; workspaces: PostmanWorkspacePreview[]; budget: { limitMonth?: number; remainingMonth?: number } }
  | { ok: false; reason: string };

/** One materialized workspace of a run — 1:1 with a vendor workspace. */
export interface PostmanImportedWorkspace {
  workspaceId: string;
  workspaceName: string;
  collections: number;
  environments: number;
  requests: number;
  /** Saved responses minted as Response Examples under their requests. */
  examples: number;
  /** Global variables landed as workspace-scoped variables. */
  globals: number;
  /** That workspace's report drop count. */
  drops: number;
}

/**
 * What the parity materialization produced — one entry per vendor
 * workspace (exact-name counterparts), plus run totals.
 */
export interface PostmanImportSummary {
  workspaces: PostmanImportedWorkspace[];
  collections: number;
  environments: number;
  requests: number;
  /** Saved responses minted as Response Examples across the run. */
  examples: number;
  /** Global variables landed as workspace-scoped variables across the run. */
  globals: number;
  /** Total drop count across the run — the "view report" teaser number. */
  drops: number;
}

/**
 * Progress vocabulary for the background-tasks surface: per-item
 * progress, the 429 pause countdown, the remaining monthly budget, and
 * the landing-workspace materialization tail. The `migrationPullEvent`
 * broadcast carries exactly these events to every connected surface.
 * The puller emits everything up to `finished`; the run orchestrator
 * emits the `importing` / `imported` / `import-failed` tail.
 */
export type PostmanPullEvent =
  | { kind: 'enumerating'; step: 'workspace-list' | 'workspace-detail' | 'workspace-globals'; completedCalls: number }
  | { kind: 'planned'; workspaces: number; collections: number; environments: number; totalCalls: number }
  | {
      kind: 'item-progress';
      item: 'collection' | 'environment';
      id: string;
      name?: string;
      status: 'pulled' | 'skipped';
      reason?: string;
      completedItems: number;
      totalItems: number;
    }
  | { kind: 'rate-limit-pause'; retryAfterSeconds: number }
  | { kind: 'budget'; limitMonth?: number; remainingMonth?: number }
  | {
      kind: 'finished';
      outcome: PostmanPullOutcome;
      stopReason?: string;
      collections: number;
      environments: number;
      skipped: number;
    }
  | { kind: 'importing' }
  | { kind: 'imported'; summary: PostmanImportSummary }
  | { kind: 'import-failed'; reason: string };
