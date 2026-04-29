/**
 * OAuth-bundle projection — `OAuthBundleSnapshot ⇄ MutationBatch`.
 *
 * The persisted blob (`oauth-token-store.ts`) holds three Records keyed
 * by `credentialRef`. The oracle stores each as a set-modeled path with
 * itemId = credentialRef. `seedOAuthBundle` walks the three Records and
 * emits one `addToSet` per entry under each path, plus one `create` for
 * the scalar shell (carries `schemaVersion`). All-or-nothing under the
 * oracle's per-entity lock.
 *
 * The materialized form folds set items back into arrays, but consumers
 * want Records. The post-state projector in `oauth-bundle-post-state.ts`
 * uses `oracle.liveSetItems` to recover the original `(credentialRef,
 * value)` pairs — projection is co-located there because it needs
 * oracle access; this file owns only seed.
 */

import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
} from '@openheaders/core/sync';

/** Persisted blob shape — kept in sync with `oauth-token-store.ts`. */
export interface OAuthBundleSnapshot {
  schemaVersion: number;
  tokens: Record<string, unknown>;
  configs: Record<string, unknown>;
  refreshErrors: Record<string, unknown>;
}

/**
 * Convert a persisted OAuth blob into a `MutationBatch` of one `create`
 * for the scalar shell + one `addToSet` per entry across the three
 * maps. All-or-nothing under the oracle's per-entity lock.
 */
export function seedOAuthBundle(snapshot: OAuthBundleSnapshot, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      payload: { schemaVersion: snapshot.schemaVersion },
    },
  ];
  for (const [credentialRef, bundle] of Object.entries(snapshot.tokens)) {
    bodies.push({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_TOKENS_PATH,
      itemId: credentialRef,
      item: bundle,
    });
  }
  for (const [credentialRef, config] of Object.entries(snapshot.configs)) {
    bodies.push({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_CONFIGS_PATH,
      itemId: credentialRef,
      item: config,
    });
  }
  for (const [credentialRef, errorState] of Object.entries(snapshot.refreshErrors)) {
    bodies.push({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_REFRESH_ERRORS_PATH,
      itemId: credentialRef,
      item: errorState,
    });
  }
  return mintBatch(ctx, bodies);
}
