/**
 * Sync handshake → Status subsystem bridge (Phase C U1-U3).
 *
 * Maps the {@link InitiatorState} FSM to the `sync` Status subsystem
 * the UI subscribes to. Two pieces:
 *
 *   - {@link describeHandshakeStatus} — pure mapping; one InitiatorState
 *     in, one StatusEntry out (or null when the state shouldn't
 *     override the wire-level reporter's message, e.g. `aborted`).
 *   - {@link installHandshakeStatusReporter} — installs the mapping
 *     onto an initiator's subscription, returning an unsubscribe.
 *
 * Why this lives separate from `websocket.ts`:
 *
 *   - websocket.ts owns wire-level state (connecting / disconnected /
 *     auto-connect off / in-browser). It writes the `sync` subsystem
 *     when those inputs change.
 *   - This module owns handshake-level state (handshaking / catching-up
 *     / synced / rejected / timed-out / failed). It writes the `sync`
 *     subsystem when the FSM transitions.
 *
 *   Both write to the same subsystem; the most recent transition wins.
 *   Coordination is implicit: the wire-level reporter fires on socket
 *   open / close; the handshake reporter fires on FSM transitions
 *   between them. There's no shared state, no priority logic, no
 *   ordering hazard beyond the natural causal order (socket opens →
 *   handshake transitions → SYNCED → live mode).
 */
import type { HandshakeRejectReason } from '@openheaders/core/protocol';

import type { InitiatorState, SyncHandshakeInitiator } from './sync-handshake-initiator';

export interface SyncStatusEntry {
  readonly state: 'green' | 'yellow' | 'red';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Map an initiator FSM state to a Status entry, or null when the
 * state isn't a handshake-phase override (e.g. `idle` is pre-handshake;
 * `aborted` means no workspace — the wire-level reporter's message
 * stays).
 */
export function describeHandshakeStatus(
  state: InitiatorState,
  rejectReason: HandshakeRejectReason | null,
  failureDetail: string | null,
): SyncStatusEntry | null {
  switch (state) {
    case 'idle':
    case 'aborted':
      return null;
    case 'hello-sent':
    case 'welcomed':
      return {
        state: 'yellow',
        message: 'Handshaking with back-end…',
        context: { phase: state },
      };
    case 'catching-up':
      return {
        state: 'yellow',
        message: 'Catching up changes…',
        context: { phase: state },
      };
    case 'synced':
      return {
        state: 'green',
        message: 'Synced with back-end',
        context: { phase: state },
      };
    case 'rejected':
      return handshakeRejectEntry(rejectReason);
    case 'timed-out':
      return {
        state: 'red',
        message: "Back-end didn't respond to handshake — retrying",
        context: { phase: state },
      };
    case 'failed':
      return {
        state: 'red',
        message: failureDetail ? `Catch-up failed: ${failureDetail}` : 'Catch-up failed',
        context: { phase: state, detail: failureDetail },
      };
  }
}

function rejectMessage(reason: HandshakeRejectReason | null): string {
  switch (reason) {
    case 'protocol-too-old':
      return 'Back-end speaks a newer protocol — update extension';
    case 'protocol-too-new':
      return 'Back-end speaks an older protocol — update back-end';
    case 'workspace-unknown':
      return 'Back-end does not recognize this workspace';
    case 'auth-required':
      return 'Back-end requires authentication';
    default:
      return 'Back-end rejected handshake';
  }
}

/**
 * The `sync` slot entry for a refused handshake. Shared by the
 * FSM-driven reporter above and the connection manager's refusal-close
 * path — the two observe the same rejection through different signals
 * (the in-band WELCOME vs the close code), and must write identical
 * entries so the last write is indistinguishable from the first.
 */
export function handshakeRejectEntry(reason: HandshakeRejectReason | null): SyncStatusEntry {
  return {
    state: 'red',
    message: rejectMessage(reason),
    context: { phase: 'rejected', reason },
  };
}

export interface InstallHandshakeStatusReporterDeps {
  readonly initiator: SyncHandshakeInitiator;
  /**
   * Status-subsystem write hook. Typically a thin wrapper over
   * `@openheaders/ui/shared/status::report` that fills in
   * `subsystem: 'sync'`.
   */
  readonly report: (entry: SyncStatusEntry) => void;
}

/**
 * Subscribe the reporter to the initiator. On every FSM transition,
 * compute a Status entry via {@link describeHandshakeStatus} and call
 * `report` when the entry is non-null. Returns an unsubscribe.
 */
export function installHandshakeStatusReporter(deps: InstallHandshakeStatusReporterDeps): () => void {
  return deps.initiator.subscribe((state) => {
    const entry = describeHandshakeStatus(state, deps.initiator.rejectReason(), deps.initiator.failureDetail());
    if (entry) deps.report(entry);
  });
}
