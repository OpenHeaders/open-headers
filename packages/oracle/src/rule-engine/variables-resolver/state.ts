/**
 * Per-workspace resolver state.
 *
 * Each resident workspace gets its own `ResolverState` — its own
 * `VariableResolver` (env/vars/vault scopes are workspace-scoped), its
 * own last-resolved memo, its own live-cache mirror, and its own
 * collection-uid bookkeeping. The state map is lazily populated and
 * cleared on `disposeResolverStateForWorkspace` (called from the SW
 * service's `finalizeDisposal` so a torn-down workspace's resolver
 * state goes with it). MWPT-FULL F-16 lint backstop: no module-level
 * resolver state remains; per-workspace warmup misses no resident
 * workspace because each workspace owns its own slot.
 *
 * Sentinel key for the "no active workspace" path — used by tests that
 * exercise the resolver without bootstrapping `workspace-store`, and
 * by SW-internal callers that race ahead of the bootstrap broadcast.
 * Production lookups that resolve through `peekActiveWorkspaceId()`
 * only see this sentinel during the cold-wake window before the first
 * active broadcast lands.
 */

import type { Rule } from '@openheaders/core/types';
import { type ResolutionError, VariableResolver } from '@openheaders/core/variables';
import type { WorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { peekActiveWorkspaceId } from '@openheaders/oracle/sync';

export interface ResolverState {
  workspaceId: string;
  resolver: VariableResolver;
  /**
   * Cached snapshot of the most recently resolved rule set for THIS
   * workspace. Downstream consumers (request-tracker pattern match,
   * badge verdicts, Inspector panel telemetry) need to see the SAME
   * resolved strings the DNR layer saw — otherwise a rule with
   * `{{API_HOST}}` in its domain condition would fire in DNR but the
   * tracker would match the raw token and fail to attribute the
   * request.
   *
   * Populated on every `resolveRulesForCompile` call. Empty before the
   * first compile.
   */
  lastResolvedRules: Rule[];
  /**
   * Per-rule resolution errors collected during the most recent
   * `resolveRulesForCompile` for THIS workspace. Keyed by rule uid so
   * callers can line up errors against specific rules without
   * re-walking the set. Errors for a rule with no unresolved
   * references are not stored — `has` → false.
   *
   * Cleared (reset to an empty map) at the start of every resolve pass
   * so the snapshot always matches `lastResolvedRules`.
   */
  lastResolutionErrors: Map<string, ResolutionError[]>;
  /**
   * Warm mirror of THIS workspace's live cache rows. Populated by the
   * `onLiveCacheStoreChange` listener (filtered to events tagged with
   * this workspaceId) so `buildLiveRegistry` stays synchronous.
   */
  cachedLiveRuns: WorkflowRunCache[];
  /**
   * Sentinel set used by `syncResolverFromStores` to detect collections
   * that were dropped between sync passes — the resolver's internal
   * collection-variable map needs explicit removes for collections that
   * no longer exist.
   */
  lastKnownCollectionUids: Set<string>;
}

const NO_WORKSPACE_KEY = '__no-workspace__';

export const states = new Map<string, ResolverState>();

function createState(workspaceId: string): ResolverState {
  return {
    workspaceId,
    resolver: new VariableResolver(),
    lastResolvedRules: [],
    lastResolutionErrors: new Map(),
    cachedLiveRuns: [],
    lastKnownCollectionUids: new Set(),
  };
}

export function getOrCreateState(workspaceId: string): ResolverState {
  let state = states.get(workspaceId);
  if (!state) {
    state = createState(workspaceId);
    states.set(workspaceId, state);
  }
  return state;
}

function activeKey(): string {
  return peekActiveWorkspaceId() ?? NO_WORKSPACE_KEY;
}

/**
 * Lookup the runtime-Active workspace's resolver state, lazily
 * materializing it on first reach. Public reads (e.g.
 * `getResolvedRules`) route through here so the state map stays
 * the single source of truth.
 */
export function activeState(): ResolverState {
  return getOrCreateState(activeKey());
}

/**
 * Drop a workspace's resolver state. Called from the SW service's
 * `finalizeDisposal` so a torn-down workspace's resolver memo + live-
 * cache mirror don't outlive their owning service. Idempotent.
 */
export function disposeResolverStateForWorkspace(workspaceId: string): void {
  states.delete(workspaceId);
}
