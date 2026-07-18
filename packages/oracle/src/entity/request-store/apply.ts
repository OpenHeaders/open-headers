// ── Sync engine plumbing ────────────────────────────────────────────

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '@openheaders/oracle/sync/service/accessors';

/**
 * Mint an SW context, build a batch via `factory`, and apply it through
 * the active oracle. Mirrors {@link rule-store}'s helper — throws when
 * the sync service hasn't been initialized so the order violation
 * surfaces immediately rather than silently dropping the write.
 */
export async function applyRequestMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

export async function applyRequestCollectionMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected request-collection batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

export async function applyRequestFolderMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected request-folder batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}
