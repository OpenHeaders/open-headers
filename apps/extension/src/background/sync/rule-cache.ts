/**
 * Rule cache + persistence sink (Phase A Fw6b).
 *
 * Sits at the seam between the local oracle and `rule-store.ts`:
 *
 *   - Subscribes to the oracle's broadcast bus. Every committed
 *     envelope re-projects the oracle's full materialized state to a
 *     `V5.Rule[]` and updates this module's in-memory cache.
 *   - Persists the projected `V5.Rule[]` back to `chrome.storage.local`
 *     under the workspace's `rules` key — the existing storage layout
 *     stays intact so other subsystems (rule engine, badge, telemetry)
 *     continue reading from it without changes.
 *   - Notifies registered listeners after each cache update so
 *     `rule-store.ts` can fan out `onStoreChange` (which drives the
 *     bridge `rulesUpdated` broadcast and the orphan-test-run sweep).
 *
 * Hydration is the inverse: `seedFromPersistedRules(rules)` minimally
 * walks each persisted V5.Rule, builds a `seedRule` batch via the
 * projection, and applies it through the oracle. The broadcasts that
 * fire during hydration replay through this same sink — the
 * write-back to `chrome.storage.local` is byte-identical and idempotent
 * (same V5.Rule[] in, same V5.Rule[] out), so the cost is one extra
 * `extensionStorage.set` per cold wake. Acceptable for Phase A;
 * compaction lands in Phase D.
 *
 * Workspace switch contract: the sync service constructs one cache per
 * workspace (`createRuleCache(workspaceId, oracle, broadcast)`) and
 * disposes the previous one. Callers that want the active cache go
 * through {@link getActiveRuleCache} — that returns null between
 * `dispose()` and the next `createRuleCache` so reads during the
 * transient window fall through to the legacy paths instead of seeing
 * stale data.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { RuleOracle } from './oracle';
import { projectRule, seedRule } from '@/shared/sync/rule-projection';
import type { SwMutatorContextFactory } from './sw-context';

export type RuleCacheListener = () => void;

export interface RuleCache {
  readonly workspaceId: string;
  /** Snapshot of the cached rules in stable (uid) order. */
  getRules(): V5.Rule[];
  /** Replace the cache from a list of rule snapshots and seed the
   *  oracle. Drives boot-time hydration and the workspace-switch path. */
  seedFromPersistedRules(rules: V5.Rule[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. Returns an unsubscribe function. */
  onChange(listener: RuleCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

/**
 * Build a cache wired to a specific workspace's oracle + broadcast.
 *
 * The cache subscribes to broadcast on construction so any mutation
 * applied between construction and the first explicit hydration call
 * still flows through. (In practice the SW only emits mutations after
 * hydration has populated the oracle, so this is belt-and-braces — but
 * the alternative ordering would have a real race window.)
 */
export function createRuleCache(
  workspaceId: string,
  oracle: RuleOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RuleCache {
  let rules: V5.Rule[] = [];
  const listeners = new Set<RuleCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllRules(oracle.materializeAll());
    rules = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('RuleCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  // Re-project on every committed broadcast event. Cost is one
  // materializeAll + one extensionStorage.set per envelope; for typical
  // workspaces (< 100 rules) this is microseconds. We can coalesce by
  // batchId later if profiling demands it; correctness first.
  const unsubscribe = broadcast.subscribe((_event: BroadcastEvent) => {
    refreshFromOracle();
  });

  return {
    workspaceId,
    getRules: () => rules,

    async seedFromPersistedRules(persisted: V5.Rule[]): Promise<void> {
      // Apply each rule's seed batch through the oracle. The broadcast
      // subscription above will re-build `rules` from materializeAll
      // after every envelope — by the time this loop returns, the
      // cache reflects exactly what was just seeded (modulo the
      // synthetic itemIds the oracle keeps internally for set members).
      for (const rule of persisted) {
        const batch = seedRule(rule, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'RuleCache',
            `seedFromPersistedRules: rule ${rule.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      // Last-line refresh is redundant in the happy path — the per-rule
      // broadcasts already drove refreshFromOracle. Kept as a guard
      // against zero-rules workspaces (no broadcasts → no refresh →
      // listeners never told the cache is "ready") so listeners always
      // see a consistent post-hydration state.
      refreshFromOracle();
      logger.info('RuleCache', `Seeded ${persisted.length} rules for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: RuleCache | null = null;

/** Set the active cache — called by the sync service on init. */
export function setActiveRuleCache(cache: RuleCache | null): void {
  active = cache;
}

/** Read the active cache. `null` between dispose and re-init. */
export function getActiveRuleCache(): RuleCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAllRules(materialized: MaterializedEntity[]): V5.Rule[] {
  const out: V5.Rule[] = [];
  for (const m of materialized) {
    if (m.type !== RULE_ENTITY_TYPE) continue;
    const rule = projectRule(m);
    if (rule) out.push(rule);
  }
  // Stable order by uid so consumers (badge, exporter, tests)
  // observe deterministic outputs across SW lifetimes.
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, rules: V5.Rule[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).rules, rules);
  } catch (err) {
    // chrome.storage.local writes can fail under quota pressure or
    // during extension reload teardown. Log but don't throw — the
    // in-memory cache is still consistent; the next mutation will
    // attempt another write.
    logger.info('RuleCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
