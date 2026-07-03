/**
 * Bridge-side helper that turns an {@link EntityOracle} snapshot into
 * the {@link InverseSpecPriorAccess} the {@link computeInverseSpec}
 * core helper needs.
 *
 * Sits between {@link mutation-stream-bridge} and `@openheaders/core/sync`
 * so the core stays oracle-unaware: core defines the spec shape + the
 * pure compute function; oracle wires it to live state. The access
 * object reads pre-apply values via the materialized data (already
 * captured by the bridge as `prior`) and pulls per-(setPath, itemId)
 * order keys via {@link EntityOracle.liveOrderedSetItems} — the
 * materialized view strips itemIds, so set-member inversion needs the
 * raw enumeration.
 *
 * Reads are synchronous and lock-free; the bridge calls this BEFORE
 * `applySyncRequest` mutates the store, in the same synchronous step
 * as the existing `materializeOne` capture, so the access object is
 * pre-apply by construction.
 */
import type { InverseSpecPriorAccess, MaterializedEntity } from '@openheaders/core/sync';
import { getAtPath, hasPath, parsePath } from '@openheaders/core/sync';

import type { EntityOracle } from './oracle';

export interface OracleInverseAccessInput {
  /** Local oracle for the envelope's workspace. May be null when the
   *  workspace hasn't been touched yet (apply will materialize it). */
  oracle: EntityOracle | null;
  entityType: string;
  entityId: string;
  /** Pre-apply materialized snapshot the bridge already captured. */
  prior: MaterializedEntity | null;
}

/**
 * Build the prior-state accessor backing {@link computeInverseSpec}.
 * Field lookups walk `prior.data`; set-member lookups consult the
 * oracle's raw `liveOrderedSetItems` view to recover the orderKey
 * that materialization elides.
 */
export function makeOracleInverseAccess(input: OracleInverseAccessInput): InverseSpecPriorAccess {
  const priorData = input.prior?.data ?? null;
  return {
    getFieldAt(path) {
      if (priorData === null) return { exists: false };
      const segments = parsePath(path);
      if (segments.length === 0) return { exists: false };
      if (!hasPath(priorData, segments)) return { exists: false };
      return { exists: true, value: getAtPath(priorData, segments) };
    },
    getSetMember(path, itemId) {
      if (!input.oracle) return null;
      const live = input.oracle.liveOrderedSetItems(input.entityType, input.entityId, path);
      for (const entry of live) {
        if (entry.itemId === itemId) return { item: entry.item, orderKey: entry.key };
      }
      return null;
    },
  };
}
