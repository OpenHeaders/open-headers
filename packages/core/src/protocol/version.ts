/**
 * Protocol version contract between OpenHeaders apps (browser extension,
 * desktop app, CLI, web app) that talk over the local WebSocket bridge.
 *
 * Both sides announce their `PROTOCOL_VERSION` on connect. A peer is
 * compatible if its announced version falls within the local
 * `[MIN_COMPATIBLE_PROTOCOL, PROTOCOL_VERSION]` range. Mismatched peers
 * are rejected with a typed close reason so the UI can show "update
 * extension" / "update desktop" instead of a generic disconnect.
 *
 * Bump `PROTOCOL_VERSION` only on a breaking IPC change (renamed field,
 * removed message, type change). Additive changes (new message, new
 * optional field) keep the same version. After a bump, keep
 * `MIN_COMPATIBLE_PROTOCOL` one cycle behind, then raise it to drop the
 * older peer once the rollout has caught up.
 */

export const PROTOCOL_VERSION = 2;
export const MIN_COMPATIBLE_PROTOCOL = 2;

export function isCompatibleProtocol(peerVersion: number): boolean {
  return Number.isInteger(peerVersion) && peerVersion >= MIN_COMPATIBLE_PROTOCOL && peerVersion <= PROTOCOL_VERSION;
}

/** WebSocket close code reserved for incompatible-protocol rejections. */
export const PROTOCOL_INCOMPATIBLE_CLOSE_CODE = 4001;

/**
 * WebSocket close code for every other refused handshake (RFC 6455
 * policy violation). The close *reason* carries the
 * `HandshakeRejectReason` string; the in-band WELCOME carried the same
 * reason first. Distinct from 4001 so a client can tell "this build
 * can never talk to that peer" (latch, stop dialing) from "this device
 * was refused" (recoverable by re-pairing).
 */
export const HANDSHAKE_REJECT_CLOSE_CODE = 1008;

export interface IncompatibleProtocolReason {
  type: 'incompatible-protocol';
  peerVersion: number;
  ourVersion: number;
  minCompatible: number;
}
