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
 * ids at the receiving end. `peerExecuteSetting` is the
 * peer-execute-refusal hand-off: Settings → Backend focused on the
 * "allow connected devices to send requests" opt-in.
 */
export type CompanionRevealTarget =
  | 'workbench'
  | 'terminal'
  | 'git'
  | 'proxy'
  | 'liveNetwork'
  | 'mcp'
  | 'peerExecuteSetting';

/** Every legal reveal target — the wire validator's single source. */
export const COMPANION_REVEAL_TARGETS: readonly CompanionRevealTarget[] = [
  'workbench',
  'terminal',
  'git',
  'proxy',
  'liveNetwork',
  'mcp',
  'peerExecuteSetting',
];

/**
 * Honest refusals for a peer `executeRequest` / `executeGrpcRequest`
 * frame arriving while the answering host's opt-in is off — one per
 * trust tier: same-device browsers (`backend.allowLocalPeerExecute`,
 * default ON — pairing is the consent) and other devices
 * (`backend.allowRemotePeerExecute`, default OFF — egress from this
 * machine on another device's behalf is an operator decision). They
 * live in the protocol vocabulary because BOTH ends need the exact
 * strings: the daemon throws them onto the wire, and browser surfaces
 * recognize them to render the host-aware guidance (with the reveal
 * hand-off above) instead of the raw wire text.
 */
export const LOCAL_PEER_EXECUTE_DISABLED_MESSAGE =
  "Sending requests from this device's browsers is disabled on this host. Enable it in Settings → Backend.";
export const REMOTE_PEER_EXECUTE_DISABLED_MESSAGE =
  'Sending requests from other connected devices is disabled on this host. Enable it in Settings → Backend.';

export function isCompanionRevealTarget(value: unknown): value is CompanionRevealTarget {
  return typeof value === 'string' && (COMPANION_REVEAL_TARGETS as readonly string[]).includes(value);
}
