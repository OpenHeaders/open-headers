import type { HLC } from './types';

const PHYSICAL_PAD = 16;
const LOGICAL_PAD = 8;

/**
 * Serialize an HLC to a string that lex-orders the same way
 * {@link compareHlc} numeric-orders. Useful as an IDB primary key on
 * mutation log entries — `IDBKeyRange.bound` over this encoding gives
 * us "all mutations since HLC X" without a custom comparator.
 *
 *   `<physical-padded>-<logical-padded>-<nodeId>`
 */
export function hlcToString(hlc: HLC): string {
  const phys = hlc.physicalMs.toString().padStart(PHYSICAL_PAD, '0');
  const log = hlc.logical.toString().padStart(LOGICAL_PAD, '0');
  return `${phys}-${log}-${hlc.nodeId}`;
}

export function parseHlc(s: string): HLC {
  const firstDash = s.indexOf('-');
  const secondDash = s.indexOf('-', firstDash + 1);
  if (firstDash < 0 || secondDash < 0) {
    throw new Error(`parseHlc: malformed HLC string: ${s}`);
  }
  const physicalMs = Number.parseInt(s.slice(0, firstDash), 10);
  const logical = Number.parseInt(s.slice(firstDash + 1, secondDash), 10);
  const nodeId = s.slice(secondDash + 1);
  if (!Number.isFinite(physicalMs) || !Number.isFinite(logical) || nodeId.length === 0) {
    throw new Error(`parseHlc: malformed HLC string: ${s}`);
  }
  return { physicalMs, logical, nodeId };
}
