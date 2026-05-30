/**
 * Offline-fallback priority reader + auto-seed apply (WS-C C14 data plane).
 *
 * Two host-neutral entry points over the synced `live-fallback-priority`
 * singleton:
 *
 *   • `getFallbackPriorityForWorkspace` — the derived `Principal.id[]`
 *     ranking the live-refresh scheduler's offline election reads (its
 *     *frozen, last-synced* copy: with the backend offline no new members
 *     arrive, so the cache holds the last converged state).
 *
 *   • `maybeEnlistSelfInFallbackPriority` — the auto-seed. A same-device
 *     host that holds an exclusive workflow's consumed seed appends itself
 *     (once, idempotently) so the partitioned browsers can later elect a
 *     single offline runner from this ranking. Append order is
 *     `max(existing) + 1`; concurrent same-order appends converge via the
 *     reader's `(order, principalId)` sort. Append-only — removal + reorder
 *     ride the commit-3 management UI; a stale entry is benign (§C.4: the
 *     election re-checks seed eligibility, so a listed host that lost its
 *     seed simply isn't elected).
 *
 * The host (extension) gates the *call* on "backend configured + connected"
 * so the mutation actually syncs up; this module owns only the engine
 * logic (identity, eligibility rollup, membership, mutation), keeping the
 * connection concern at the host boundary.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import type { MutatorContext } from '@openheaders/core/sync';
import {
  buildEnlistFallbackPriorityBatch,
  type LiveFallbackPriorityMutationPayload,
} from '@openheaders/core/sync-builders/live-fallback-priority-mutations';
import {
  maxFallbackPriorityOrder,
  orderFallbackPriorityMembers,
} from '@openheaders/core/sync-builders/live-fallback-priority-projection';
import { logger } from '@openheaders/core/utils';
import { LIVE_FALLBACK_PRIORITY_REGISTRATION } from '../sync/entity-registry';
import type { LiveFallbackPriorityCache } from '../sync/live-fallback-priority-cache';
import { getCacheForWorkspace, getOracleForWorkspace, nextSwMutatorContextForWorkspace } from '../sync/service';
import { workspaceHoldsExclusiveFallbackSeed } from './execution-policy-resolver';

function readMembers(workspaceId: string): ReturnType<LiveFallbackPriorityCache['getSnapshot']>['members'] | null {
  const cache = getCacheForWorkspace<LiveFallbackPriorityCache>(LIVE_FALLBACK_PRIORITY_REGISTRATION, workspaceId);
  return cache ? cache.getSnapshot().members : null;
}

/**
 * The frozen, last-synced offline-fallback ranking for a workspace —
 * `Principal.id[]` sorted `(order, principalId)`. Empty when no service is
 * materialized or no host has enlisted yet (the safe `no-list` default the
 * election treats as "no fallback, banner, never a race").
 */
export function getFallbackPriorityForWorkspace(workspaceId: string): string[] {
  const members = readMembers(workspaceId);
  return members ? orderFallbackPriorityMembers(members) : [];
}

/**
 * Enlist THIS host in the workspace's offline-fallback ranking when it is
 * eligible and not already listed. Returns whether a mutation was emitted.
 *
 * Idempotent: a no-op when this host is already a member, holds no
 * exclusive workflow's seed, has no known identity, or the workspace has
 * no materialized oracle. The caller is responsible for the
 * "backend configured + connected" gate and supplies `selfLabel` — the
 * host-specific friendly name (browser + platform) the list shows in its
 * management UI. The label is display-only; identity is always the
 * `principalId`.
 */
export async function maybeEnlistSelfInFallbackPriority(workspaceId: string, selfLabel: string): Promise<boolean> {
  const principalId = getIdentitySnapshot()?.principal.id ?? null;
  if (!principalId) return false;

  const members = readMembers(workspaceId);
  if (members === null) return false; // no materialized service for this workspace
  if (Object.hasOwn(members, principalId)) return false; // already enlisted (append-only)

  if (!workspaceHoldsExclusiveFallbackSeed(workspaceId)) return false;

  const order = maxFallbackPriorityOrder(members) + 1;
  return applyEnlist(workspaceId, (ctx) =>
    buildEnlistFallbackPriorityBatch({ member: { principalId, order, label: selfLabel } }, ctx),
  );
}

async function applyEnlist(
  workspaceId: string,
  factory: (ctx: MutatorContext) => LiveFallbackPriorityMutationPayload,
): Promise<boolean> {
  const oracle = getOracleForWorkspace(workspaceId);
  const ctx = nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: 'sw' });
  if (!oracle || !ctx) return false;
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return false;
  try {
    const result = await oracle.apply(batch, sideEffects);
    if (!result.ok) {
      logger.info(
        'FallbackPriorityStore',
        `enlist rejected (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.info('FallbackPriorityStore', `enlist threw: ${(err as Error).message}`);
    return false;
  }
}
