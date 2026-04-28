import type { HLC } from './types';

/**
 * Total-order comparator for HLCs: physical, then logical, then nodeId.
 * Returns <0 / 0 / >0 in the usual `Array.prototype.sort` shape.
 */
export function compareHlc(a: HLC, b: HLC): number {
  if (a.physicalMs !== b.physicalMs) return a.physicalMs - b.physicalMs;
  if (a.logical !== b.logical) return a.logical - b.logical;
  if (a.nodeId === b.nodeId) return 0;
  return a.nodeId < b.nodeId ? -1 : 1;
}

export function equalHlc(a: HLC, b: HLC): boolean {
  return a.physicalMs === b.physicalMs && a.logical === b.logical && a.nodeId === b.nodeId;
}

export function maxHlc(a: HLC, b: HLC): HLC {
  return compareHlc(a, b) >= 0 ? a : b;
}
