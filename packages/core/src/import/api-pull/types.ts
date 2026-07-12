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
  /** The run's full call cost: 1 + W + C + E. */
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
}

/** A pulled environment, unwrapped and ready for `parsePostmanEnvironment`. */
export interface PulledEnvironment {
  item: 'environment';
  id: string;
  name?: string;
  json: string;
}

/** An item that yielded no payload — always with the reason. */
export interface PostmanPullSkip {
  item: 'workspace' | 'collection' | 'environment';
  id: string;
  name?: string;
  reason: string;
}

export type PostmanPullOutcome = 'complete' | 'partial' | 'failed';

export interface PostmanPullResult {
  outcome: PostmanPullOutcome;
  /** Present when the run stopped early — the clearly-labeled cause. */
  stopReason?: string;
  workspaces: PullWorkspaceSummary[];
  collections: PulledCollection[];
  environments: PulledEnvironment[];
  skipped: PostmanPullSkip[];
  budget: { limitMonth?: number; remainingMonth?: number };
  callsMade: number;
}

/**
 * Progress vocabulary for the background-tasks surface: per-item
 * progress, the 429 pause countdown, and the remaining monthly budget.
 * The broadcast protocol message (built with the surfaces) carries
 * exactly these events to every connected surface.
 */
export type PostmanPullEvent =
  | { kind: 'enumerating'; step: 'workspace-list' | 'workspace-detail'; completedCalls: number }
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
    };
