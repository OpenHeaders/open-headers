/**
 * Host-neutral inbound bridge for `oh.sync.mutation` /
 * `oh.sync.mutationBatch` frames (Phase C C8 / C9).
 *
 * Lives in oracle (not in either app) so the extension SW, desktop
 * main, and the future daemon share one source of truth for:
 *
 *   - **Dedup state** — the seen-mutationId set that breaks echo
 *     loops between two peers that both apply + re-broadcast every
 *     envelope they see.
 *   - **Apply contract** — single envelopes wrap into a synthetic
 *     one-mutation batch so the oracle's all-or-nothing semantics
 *     fire identically for both wire shapes.
 *
 * The seen-set is process-wide. That's correct because a single host
 * has a single oracle today and either everything routes through it
 * or nothing does. The cap is generous (10k entries ≈ 500 typical
 * gestures); eviction is FIFO via `Set` insertion order.
 *
 * **What this file does NOT do:**
 *   - parse the wire frame (the caller already did)
 *   - decide whether to forward the resulting broadcast back out
 *     over WS — that's the per-host forwarder's call, using
 *     {@link hasRecentlyApplied} to skip echoes
 *   - apply the seen-set to outbound. Outbound forwarders consult
 *     {@link hasRecentlyApplied} themselves.
 *
 * **C11 dedup contract — three layers, all idempotent:**
 *
 *   1. **This bridge** — early return on `hasRecentlyApplied`. Avoids
 *      the round-trip into `applySyncRequest` + the redundant
 *      broadcast cascade. Wire-level (this is the only layer that
 *      knows about transport echo).
 *   2. **Document store** (`core/sync/store`) — its own
 *      `appliedMutationIds` set; `apply()` short-circuits on a
 *      known id and returns the prior outcome. Store-level.
 *   3. **Mutation log** (`oracle/sync/mutation-log`) — `append` and
 *      `appendAll` are dedup-safe via the log's own seen set. Storage-
 *      level, also feeds `MutationLog.hasMutation()` for cheap "did we
 *      already see this?" queries from any transport.
 *
 * Any redelivery path — wire echo, multi-transport, reconnect replay,
 * snapshot+delta overlap — is a no-op by composition: even if one
 * layer is bypassed (e.g. a unit test calls `oracle.apply` directly),
 * the next one catches the duplicate. Non-negotiable per the design
 * doc; tests in `mutation-id-dedup.test.ts` pin the WS-redelivery path.
 */

import { authorizedOrgIds, emitAuditEntry, getIdentitySnapshot, hasCapability } from '@openheaders/core/identity';
import {
  compareHlc,
  computeInverseSpec,
  deriveSideEffectsForEnvelope,
  filterEnvelopesByOrg,
  isHostLocalMutation,
  type MutationBatch,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';

import { makeOracleInverseAccess } from './activity/activity-inverse-builder';
import { rememberPriorForMutation } from './activity/activity-priors';
import {
  applySyncRequest,
  getOracleForWorkspace,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
} from './service';

const SEEN_MUTATION_IDS = new Set<string>();
const SEEN_CAP = 10_000;

/**
 * Inbound ids whose apply is in flight. The oracle publishes each
 * broadcast synchronously INSIDE the apply — before the seen-set write
 * lands — so the outbound forwarders' echo check must also see the
 * batch currently being applied, or every inbound envelope re-forwards
 * to the backend once (audit-log spam; store-level dedup absorbs
 * correctness). Bracketed add/remove around `applySyncRequest`; a
 * failed apply leaves no trace here, preserving the redelivery-retry
 * contract of the seen set.
 */
const INBOUND_IN_FLIGHT = new Set<string>();

function rememberApplied(envelope: MutationEnvelope): void {
  SEEN_MUTATION_IDS.add(envelope.mutationId);
  if (SEEN_MUTATION_IDS.size > SEEN_CAP) {
    const first = SEEN_MUTATION_IDS.values().next().value;
    if (first !== undefined) SEEN_MUTATION_IDS.delete(first);
  }
}

/**
 * True if this mutationId is in the per-host receive-side seen set or
 * its inbound apply is currently in flight. The in-flight half is what
 * lets the forwarders (which run during the apply's own synchronous
 * broadcast) recognize the echo.
 */
export function hasRecentlyApplied(mutationId: string): boolean {
  return SEEN_MUTATION_IDS.has(mutationId) || INBOUND_IN_FLIGHT.has(mutationId);
}

/**
 * Per-batch inbound workspace.write gate (Phase U2.3) — symmetric with
 * the extension SW receiver's `isReceiveAllowed`. The local user must
 * hold `workspace.write` on the envelope's workspaceId before this host
 * applies a peer-sourced envelope. Synthetic LocalAdmin always allows;
 * post-promotion this becomes the real WRA check.
 *
 * Deny is silent + audited — a single disallowed batch never tears the
 * socket down (a future newer-protocol sender may ship a workspace the
 * local user no longer has access to mid-revocation). The audit log is
 * the forensic record.
 */
function isReceiveAllowed(workspaceId: string): boolean {
  const snapshot = getIdentitySnapshot();
  const decision = hasCapability(snapshot, 'workspace.write', { workspaceId });
  emitAuditEntry({
    actorUserId: snapshot?.user.id ?? 'unknown',
    capability: 'workspace.write',
    workspaceId,
    decision,
  });
  if (!decision.allow) {
    logger.info('MutationStreamBridge', `inbound batch dropped: ${decision.reason ?? 'denied'} on ws ${workspaceId}`);
    return false;
  }
  return true;
}

/** Test-only — clear state between cases. */
export function __resetMutationStreamBridgeForTests(): void {
  SEEN_MUTATION_IDS.clear();
  INBOUND_IN_FLIGHT.clear();
}

/** Test-only — peek the seen set. */
export function __seenMutationStreamCountForTests(): number {
  return SEEN_MUTATION_IDS.size;
}

/**
 * Apply a peer-sourced single envelope. Idempotent: a second call
 * with the same mutationId is a no-op (the oracle's commit path is
 * also idempotent at apply time, but the early return saves the
 * round-trip + redundant broadcast).
 */
export async function applyInboundMutationEnvelope(envelope: MutationEnvelope): Promise<void> {
  if (SEEN_MUTATION_IDS.has(envelope.mutationId)) return;
  const batch: MutationBatch = { batchId: `wire-${envelope.mutationId}`, mutations: [envelope] };
  await applyInboundMutationBatch(batch);
}

/**
 * Apply a peer-sourced batch. Short-circuits when every envelope is
 * already known. Successful apply records each envelope in the seen
 * set; a failed apply leaves the seen set untouched so a subsequent
 * redelivery can retry.
 *
 * **Receiver-side org filter (UNIFIED_ORACLE_MODEL.md §6.1 / §6.3).**
 * The sender-side transport readers (state-vector / delta-stream /
 * snapshot-threshold) filter the *sender's own* log by the *sender's
 * own* authorized Org set — a no-op for cross-host isolation, since a
 * host's log always carries its own Orgs. Cross-host isolation is
 * enforced HERE, on ingest: every envelope whose `orgId` is outside
 * THIS host's authorized set is dropped before apply. This covers both
 * the handshake snapshot-bootstrap tail and the live delta stream —
 * both arrive as {@link MutationEnvelope}s through this one path — and
 * in particular the `__global__` workspace-list singleton, whose row
 * is what would otherwise materialize a peer's workspace as a bare
 * duplicate on a Coexist "keep both" mode-switch.
 *
 * **Receiver-side workspace.write gate (Phase U2.3).** After the org
 * filter, the surviving batch is gated on the local user's
 * `workspace.write` capability for its workspace — symmetric with the
 * extension SW receiver. Synthetic LocalAdmin always allows today; the
 * gate becomes load-bearing once per-WRA gating lands post-promotion.
 *
 * After a successful apply, folds the highest inbound HLC per
 * workspace into the local sequencer (Phase C C12). Guarantees that
 * the NEXT local mint strictly exceeds every envelope this peer has
 * observed — non-negotiable for cross-host LWW convergence when
 * the local wall clock has drifted (machine sleep, NTP step, etc.).
 */
export async function applyInboundMutationBatch(input: MutationBatch): Promise<void> {
  const allKnown = input.mutations.every((e) => SEEN_MUTATION_IDS.has(e.mutationId));
  if (allKnown) return;

  const authorized = authorizedOrgIds(getIdentitySnapshot());
  const orgAccepted = [...filterEnvelopesByOrg(input.mutations, authorized)];
  if (orgAccepted.length < input.mutations.length) {
    const dropped = input.mutations.length - orgAccepted.length;
    logger.info(
      'MutationStreamBridge',
      `inbound batch ${input.batchId}: dropped ${dropped}/${input.mutations.length} envelope(s) outside the host's authorized Org set`,
    );
  }
  // Host-local UI state (layout) never rides the wire — mirror of the
  // outbound gate's floor, so a peer that predates the rule (or a
  // hostile one) can't overwrite this host's layout.
  const accepted = orgAccepted.filter((env) => !isHostLocalMutation(env));
  if (accepted.length < orgAccepted.length) {
    logger.info(
      'MutationStreamBridge',
      `inbound batch ${input.batchId}: dropped ${orgAccepted.length - accepted.length} host-local envelope(s)`,
    );
  }
  if (accepted.length === 0) return;
  const batch: MutationBatch =
    accepted.length === input.mutations.length ? input : { batchId: input.batchId, mutations: accepted };

  // All envelopes in a batch share one workspaceId per the mutation-log
  // invariant; gate the batch on the first.
  const ws = batch.mutations[0]?.workspaceId;
  if (ws && !isReceiveAllowed(ws)) return;

  capturePriorsForActivity(batch);
  // Side effects are HOST-LOCAL runtime concerns that need to fire on
  // every host that applies the envelope (active-flip → per-workspace
  // store swap; workspace remove → per-workspace data purge). The
  // wire frame carries only the envelope; each host re-derives the
  // intents from the same pure mapping function the mutator used at
  // mint time. Singleton-keyed intents (SWAP) coalesce by their key
  // so multiple inbound envelopes touching the active-flip path
  // collapse to a single drain whose latest HLC wins.
  const sideEffects = batch.mutations.flatMap(deriveSideEffectsForEnvelope);
  for (const env of batch.mutations) INBOUND_IN_FLIGHT.add(env.mutationId);
  try {
    const response = await applySyncRequest({
      type: 'oh.sync.apply',
      batch,
      sideEffects,
      applyOrigin: 'inbound',
    });
    if (!response.ok) return;
    for (const env of batch.mutations) rememberApplied(env);
    observeHighestPerWorkspace(batch);
  } finally {
    for (const env of batch.mutations) INBOUND_IN_FLIGHT.delete(env.mutationId);
  }
}

/**
 * Per-envelope: read the materialized entity from the local oracle
 * BEFORE {@link applySyncRequest} mutates it, and stash it by
 * mutationId for the Activity Feed classifier. Read is lock-free
 * (`materializeOne` walks the in-memory store; no `acquire`), so this
 * step adds no apply-path latency.
 *
 * Skipped silently when no oracle is materialized for the workspace
 * (e.g. inbound for a workspace that hasn't been touched yet — the
 * apply will create it). In that case the classifier sees `prior:
 * null`, which is correct: there was no prior state to compare.
 */
function capturePriorsForActivity(batch: MutationBatch): void {
  for (const env of batch.mutations) {
    if (SEEN_MUTATION_IDS.has(env.mutationId)) continue;
    const oracle = getOracleForWorkspace(env.workspaceId);
    const prior = oracle ? oracle.materializeOne(env.body.type, env.body.id) : null;
    const access = makeOracleInverseAccess({
      oracle,
      entityType: env.body.type,
      entityId: env.body.id,
      prior,
    });
    const spec = computeInverseSpec(env.body, access);
    const inverse = spec === null ? null : { mutatorVersion: env.mutatorVersion, spec };
    rememberPriorForMutation(env.mutationId, env.workspaceId, prior, inverse);
  }
}

/**
 * Fold the highest HLC per workspace into the local sequencer.
 * Walks the batch once to find the highest HLC for each
 * workspaceId, then calls `observe` on the service handle. Acquires
 * + releases the service refcount so concurrent dispose can't tear
 * the handle down mid-observe.
 */
function observeHighestPerWorkspace(batch: MutationBatch): void {
  const highest = new Map<string, MutationEnvelope>();
  for (const env of batch.mutations) {
    const current = highest.get(env.workspaceId);
    if (!current || compareHlc(env.hlc, current.hlc) > 0) {
      highest.set(env.workspaceId, env);
    }
  }
  for (const [workspaceId, env] of highest) {
    const svc = getOrCreateWorkspaceService(workspaceId);
    try {
      svc.context.observe(env.hlc);
    } finally {
      releaseWorkspaceService(workspaceId);
    }
  }
}
