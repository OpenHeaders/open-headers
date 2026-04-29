/**
 * Token intent factories for oauth-bundle.
 *
 * Three primitives keyed by `credentialRef`:
 *
 *  • `setOAuthToken` — store/refresh a token bundle. Emitted as one
 *    atomic batch: addToSet on `tokens`, optional addToSet on `configs`
 *    when the caller carries the originating auth config, and a
 *    removeFromSet on `refreshErrors` so a successful exchange clears
 *    any stashed failure counter (matches the legacy `putTokenBundle`
 *    semantics — a successful put restarts backoff from zero).
 *
 *  • `deleteOAuthToken` — atomic batch removing the credentialRef from
 *    all three maps. Matches the legacy `deleteTokenBundle` shape.
 *
 *  • `recordOAuthRefreshError` — addToSet on `refreshErrors` only.
 *    Token + config maps stay intact so a stale access token remains
 *    the best thing to attach until the next successful refresh.
 *
 * Per-batch all-or-nothing at the local oracle (§11.2) means observers
 * never see "token added but config slot empty" or "tokens cleared but
 * config still present" intermediate states.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
} from './types';

export interface SetOAuthTokenArgs {
  credentialRef: string;
  /** `OAuth2TokenBundle` payload — opaque to the catalog. */
  bundle: unknown;
  /** Optional `V5.OAuth2Auth` sidecar — caller passes the live config
   *  when known so the scheduler can rebuild the refresh POST without
   *  walking the request tree. Omit for paths that already carry a
   *  trusted config (in-place refresh exchanges). */
  config?: unknown;
}

/**
 * Persist a token bundle under `credentialRef`. Always clears the
 * matching `refreshErrors` entry; conditionally writes the `configs`
 * sidecar when supplied.
 */
export function setOAuthToken(ctx: MutatorContext, args: SetOAuthTokenArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_TOKENS_PATH,
      itemId: args.credentialRef,
      item: args.bundle,
    },
    {
      kind: 'removeFromSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_REFRESH_ERRORS_PATH,
      itemId: args.credentialRef,
    },
  ];
  if (args.config !== undefined) {
    bodies.push({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_CONFIGS_PATH,
      itemId: args.credentialRef,
      item: args.config,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteOAuthTokenArgs {
  credentialRef: string;
}

/**
 * Drop every record for `credentialRef`. Atomic across the three maps.
 * Tombstones retain for the configured TTL (§9.2) so a reconnecting
 * offline node doesn't resurrect the entry via a stale `setOAuthToken`.
 */
export function deleteOAuthToken(ctx: MutatorContext, args: DeleteOAuthTokenArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_TOKENS_PATH,
      itemId: args.credentialRef,
    },
    {
      kind: 'removeFromSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_CONFIGS_PATH,
      itemId: args.credentialRef,
    },
    {
      kind: 'removeFromSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_REFRESH_ERRORS_PATH,
      itemId: args.credentialRef,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface RecordOAuthRefreshErrorArgs {
  credentialRef: string;
  /** `OAuthRefreshErrorState` payload — opaque to the catalog. */
  errorState: unknown;
}

/**
 * Scheduler-only: stash a failure counter without disturbing the
 * existing token / config slots. The runner's exponential backoff
 * reads this back via the cache.
 */
export function recordOAuthRefreshError(
  ctx: MutatorContext,
  args: RecordOAuthRefreshErrorArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: OAUTH_BUNDLE_ENTITY_TYPE,
        id: OAUTH_BUNDLE_ID,
        path: OAUTH_REFRESH_ERRORS_PATH,
        itemId: args.credentialRef,
        item: args.errorState,
      },
    ]),
    sideEffects: [],
  };
}
