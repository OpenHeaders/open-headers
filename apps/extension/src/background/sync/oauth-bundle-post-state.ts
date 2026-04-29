/**
 * Per-envelope oauth-bundle post-state projection (Phase B).
 *
 * Same shape as `vault-post-state.ts` for the singleton oauth-bundle
 * entity. The materialized form folds set items into arrays; consumers
 * (scheduler, executor, renderer mirror) want Records keyed by
 * `credentialRef`. We use `oracle.liveSetItems` to recover the
 * `(credentialRef, value)` pairs and rebuild the three maps.
 *
 * Tombstoned (singleton deletion is a workspace-teardown gesture only)
 * and non-matching envelopes return `null`.
 *
 * The bundle is §12.1 schema-marked sensitive in full; this projection
 * is consumed by the renderer mirror over the same-machine broadcast
 * channel and never crosses any sync transport.
 */

import type { SyncOAuthBundlePostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
} from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';

/**
 * Build the oauth-bundle post-state for `envelope` using `oracle`.
 * Returns `null` for non-matching envelopes, deletes (entity tombstoned),
 * and any envelope whose materialized record fails to project.
 */
export function projectOAuthBundlePostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncOAuthBundlePostState | null {
  if (envelope.body.type !== OAUTH_BUNDLE_ENTITY_TYPE) return null;
  return projectOAuthBundleSingleton(oracle);
}

/**
 * Build the oauth-bundle post-state for the singleton entity. Used by
 * the snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast lands. Returns `null` when the singleton hasn't
 * been materialized yet (cold oracle prior to seed).
 */
export function projectOAuthBundleSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncOAuthBundlePostState | null {
  const materialized = oracle.materializeOne(OAUTH_BUNDLE_ENTITY_TYPE, OAUTH_BUNDLE_ID);
  if (!materialized) return null;

  const tokens = recordFromLiveSet(oracle, OAUTH_TOKENS_PATH);
  const configs = recordFromLiveSet(oracle, OAUTH_CONFIGS_PATH);
  const refreshErrors = recordFromLiveSet(oracle, OAUTH_REFRESH_ERRORS_PATH);

  const refs = new Set<string>([
    ...Object.keys(tokens),
    ...Object.keys(configs),
    ...Object.keys(refreshErrors),
  ]);
  const credentialRefs = Array.from(refs).sort();

  return { tokens, configs, refreshErrors, credentialRefs };
}

function recordFromLiveSet(
  oracle: Pick<EntityOracle, 'liveSetItems'>,
  path: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of oracle.liveSetItems(OAUTH_BUNDLE_ENTITY_TYPE, OAUTH_BUNDLE_ID, path)) {
    out[entry.itemId] = entry.item;
  }
  return out;
}
