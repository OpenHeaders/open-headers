// ── Sync engine plumbing ────────────────────────────────────────────

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '@openheaders/oracle/sync/service';

/**
 * Mint an SW context, build a batch via `factory`, and apply it through
 * the active oracle. Throws when the sync service hasn't been
 * initialized — that would mean a write site beat boot, which the
 * background's init order is designed to prevent. The throw surfaces
 * the order violation immediately rather than silently dropping the
 * write.
 */
export async function applyRuleMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RuleStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RuleStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

export async function applyFolderMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RuleStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RuleStore.${op}: oracle rejected folder batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

export async function applyCollectionMutationOrThrow(
  factory: (ctx: MutatorContext) => {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RuleStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RuleStore.${op}: oracle rejected collection batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}
