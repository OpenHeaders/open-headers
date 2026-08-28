/**
 * Host-side placement helpers for tree write sites.
 *
 * A create takes its parent's containment slot in the same batch as
 * the entity; the slot's key appends strictly after the parent set's
 * live tail. Every host write site (SW stores, MCP tools, migration
 * landing) reads the tail off the workspace oracle through these two
 * helpers so the append rule is minted in one place.
 */

import { type ChildPlacement, keyBetween, type ParentRefShape, WORKSPACE_ROOTS_REF } from '@openheaders/core/sync';
import type { EntityOracle } from '@openheaders/oracle/sync/oracle';

type Reads = Pick<EntityOracle, 'liveOrderedSetItems'>;

/** Next append key on a parent's ordered set — strictly after its live tail. */
export function appendOrderKey(oracle: Reads, parent: ParentRefShape, setPath: string): string {
  const live = oracle.liveOrderedSetItems(parent.type, parent.uid, setPath);
  return keyBetween(live.at(-1)?.key ?? null, null);
}

/**
 * Placement for a leaf or folder under `parent`, appended at the tail of
 * the parent's `setPath`. `null` parent (unresolvable path) yields no
 * placement; a missing oracle yields a keyless placement (seed key) —
 * the apply that follows fails on the same missing service anyway.
 */
export function childPlacement<P extends ParentRefShape>(
  oracle: Reads | null,
  parent: P | null,
  setPath: string,
): ChildPlacement<P> | null {
  if (!parent) return null;
  return oracle ? { parent, orderKey: appendOrderKey(oracle, parent, setPath) } : { parent };
}

/** Placement for a collection at the tail of the workspace roots' `rootsPath` set. */
export function rootsPlacement(oracle: Reads | null, rootsPath: string): ChildPlacement<typeof WORKSPACE_ROOTS_REF> {
  return oracle
    ? { parent: WORKSPACE_ROOTS_REF, orderKey: appendOrderKey(oracle, WORKSPACE_ROOTS_REF, rootsPath) }
    : { parent: WORKSPACE_ROOTS_REF };
}
