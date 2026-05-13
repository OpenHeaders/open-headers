/**
 * Rule cache + persistence sink (Phase A Fw6b).
 *
 * Sits at the seam between the local oracle and `rule-store.ts`:
 *
 *   - Subscribes to the oracle's broadcast bus. Every committed
 *     envelope re-projects the oracle's full materialized state to a
 *     `Rule[]` and updates this module's in-memory cache.
 *   - Persists the projected `Rule[]` back to `chrome.storage.local`
 *     under the workspace's `rules` key — the existing storage layout
 *     stays intact so other subsystems (rule engine, badge, telemetry)
 *     continue reading from it without changes.
 *   - Notifies registered listeners after each cache update so
 *     `rule-store.ts` can fan out `onStoreChange` (which drives the
 *     bridge `rulesUpdated` broadcast and the orphan-test-run sweep).
 *
 * Hydration is the inverse: `seedFromPersistedRules(rules)` minimally
 * walks each persisted Rule, builds a `seedRule` batch via the
 * projection, and applies it through the oracle. The broadcasts that
 * fire during hydration replay through this same sink — the
 * write-back to `chrome.storage.local` is byte-identical and
 * idempotent.
 *
 * Per-workspace ownership: each `WorkspaceServiceState` owns exactly one
 * `RuleCache` for its workspace; consumers in `background/modules/` read
 * the runtime-Active workspace's cache via
 * `getActiveCacheForRegistration(RULE_REGISTRATION)` from `service.ts`.
 */

import { RuleSchema } from '@openheaders/core/schemas';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectRule, seedRule } from '@/shared/sync/rule-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RuleCacheListener = () => void;

export interface RuleCache {
  readonly workspaceId: string;
  getRules(): Rule[];
  seedFromPersistedRules(rules: Rule[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: RuleCacheListener): () => void;
  dispose(): void;
}

export function createRuleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RuleCache {
  const core = createFlatEntityCache<Rule, typeof RULE_ENTITY_TYPE>(workspaceId, oracle, broadcast, contextFactory, {
    entityType: RULE_ENTITY_TYPE,
    loggerTag: 'RuleCache',
    storageKey: (ws) => wsKeys(ws).rules,
    // Re-project only on rule envelopes. The legacy "fire on every
    // broadcast" stance was load-bearing for nothing — `projectRule`
    // is type-filtered, so cross-entity broadcasts (env, collection,
    // template, …) just produced redundant `extensionStorage.set`
    // calls with the same rule list. Worse, those redundant persists
    // could WRITE OVER user data with `[]` if they fired during a
    // narrow window where the oracle had been disposed but the cache
    // was still subscribed (workspace switch / SW eviction races) —
    // tightening to `true` shrinks the wipe surface to the genuine
    // "rule changed" lane.
    filterBroadcastByType: true,
    project: projectRule,
    seed: seedRule,
    loadFromStorage: (ws) =>
      extensionStorage.getValidatedArray(wsKeys(ws).rules, RuleSchema, {
        onError: driftRecorder({
          subsystem: 'rule-engine',
          statusSubsystem: 'rules',
          storageKey: wsKeys(ws).rules.key,
          workspaceId: ws,
        }),
      }),
  });
  return {
    workspaceId: core.workspaceId,
    getRules: core.getEntities,
    seedFromPersistedRules: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
