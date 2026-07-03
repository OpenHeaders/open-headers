/**
 * Per-envelope oauth-bundle post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * The materialized form folds set items into arrays; consumers
 * (scheduler, executor, renderer mirror) want Records keyed by
 * `credentialRef`. The compose callback uses `oracle.liveSetItems` to
 * recover the `(credentialRef, value)` pairs and rebuild the three
 * maps.
 *
 * The bundle is §12.1 schema-marked sensitive in full; this projection
 * is consumed by the renderer mirror over the same-machine broadcast
 * channel and never crosses any sync transport.
 */

import type { SyncOAuthBundlePostState } from '@openheaders/core/protocol';
import {
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
} from '@openheaders/core/sync';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncOAuthBundlePostState>({
  entityType: OAUTH_BUNDLE_ENTITY_TYPE,
  entityId: OAUTH_BUNDLE_ID,
  compose: (_materialized, oracle) => {
    const tokens = recordFromLiveSet(oracle, OAUTH_TOKENS_PATH);
    const configs = recordFromLiveSet(oracle, OAUTH_CONFIGS_PATH);
    const refreshErrors = recordFromLiveSet(oracle, OAUTH_REFRESH_ERRORS_PATH);
    const refs = new Set<string>([...Object.keys(tokens), ...Object.keys(configs), ...Object.keys(refreshErrors)]);
    const credentialRefs = Array.from(refs).sort();
    return { tokens, configs, refreshErrors, credentialRefs };
  },
});

export const projectOAuthBundlePostState = projectors.projectPostState;
export const projectOAuthBundleSingleton = projectors.projectSingleton;

function recordFromLiveSet(oracle: Pick<EntityOracle, 'liveSetItems'>, path: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of oracle.liveSetItems(OAUTH_BUNDLE_ENTITY_TYPE, OAUTH_BUNDLE_ID, path)) {
    out[entry.itemId] = entry.item;
  }
  return out;
}
