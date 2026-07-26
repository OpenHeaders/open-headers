/**
 * Protocol message type definitions.
 *
 * Reserved for the desktop ↔ extension WebSocket protocol. Today the
 * only inhabitant is the companion-reveal vocabulary — the payload of
 * the `companionReveal` peer channel a browser surface uses to bring
 * the desktop app forward on the same machine.
 */

/**
 * What the desktop app should bring into view after fronting its
 * window. `workbench` is the bare focus gesture; the feature values
 * mirror the desktop-only registry entries browser hosts render as
 * teasers (dock tool windows + the MCP settings category) — one
 * vocabulary on the wire, host registries map it to their own surface
 * ids at the receiving end.
 */
export type CompanionRevealTarget = 'workbench' | 'terminal' | 'git' | 'proxy' | 'liveNetwork' | 'mcp';

/** Every legal reveal target — the wire validator's single source. */
export const COMPANION_REVEAL_TARGETS: readonly CompanionRevealTarget[] = [
  'workbench',
  'terminal',
  'git',
  'proxy',
  'liveNetwork',
  'mcp',
];

export function isCompanionRevealTarget(value: unknown): value is CompanionRevealTarget {
  return typeof value === 'string' && (COMPANION_REVEAL_TARGETS as readonly string[]).includes(value);
}
