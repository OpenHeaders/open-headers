/**
 * Sync status reporter (Node host).
 *
 * Sibling to the extension SW's handshake-status reporter — same `sync`
 * subsystem, opposite vantage point. The extension reports whether IT
 * is talking to a back-end; a Node host reports how reachable IT is and
 * how many extensions (same-device vs LAN) are talking to it.
 *
 * The reporter is long-lived (one instance per boot) and folds two
 * inputs into a single `sync` entry:
 *
 *   1. Bind lifecycle — from the {@link DaemonBindState} the bind
 *      supervisor emits. A failed bind (port held by another instance)
 *      is RED and overrides everything: there is no live pipe. A bind
 *      attempt with no server yet (initial boot / mid-rebind) is a
 *      transient YELLOW.
 *   2. Peer set — once a server is bound, classify by connected peers:
 *        - 0 peers → green "Idle — no extensions connected"
 *        - N peers, all loopback → green "Connected to N … on this device"
 *        - N peers with one or more LAN → green "Connected to N … (L on LAN)"
 *
 * "Idle" stays green: the host can be used standalone, so an
 * empty peer set is a healthy steady state — not a degraded one.
 *
 * Wiring (see the boot spine): the supervisor's `onServerChange` drives
 * {@link SyncStatusReporter.attachServer} / `detachServer`, and its
 * `onBindStateChange` drives {@link SyncStatusReporter.setBindState}.
 */

import type { OracleWsServer } from '../host-runtime/ws-server';
import type { DaemonBindState } from './bind-supervisor';
import type { SpineStatusReporter } from './status-seam';

export interface SyncStatusReporter {
  /** Apply a bind lifecycle transition from the supervisor. */
  setBindState(state: DaemonBindState): void;
  /** A server became listening — subscribe to its peer changes and switch to peer classification. */
  attachServer(server: OracleWsServer): void;
  /** The current server went away (rebind / teardown) — stop tracking peers. */
  detachServer(): void;
  /** Drop all subscriptions and stop emitting. Idempotent. */
  dispose(): void;
}

export function installSyncStatusReporter(reportStatus: SpineStatusReporter): SyncStatusReporter {
  let disposed = false;
  let bindState: DaemonBindState | null = null;
  let server: OracleWsServer | null = null;
  let peerUnsubscribe: (() => void) | null = null;

  function emit(): void {
    if (disposed) return;

    // A failed bind overrides peer state entirely — there is no live
    // pipe, so an extension can't be connected regardless of the last
    // known peer set.
    if (bindState?.kind === 'failed') {
      reportStatus({
        subsystem: 'sync',
        state: 'red',
        message: isAddressInUse(bindState.error)
          ? `Extension pipe offline — port ${bindState.port} is already in use. Change it in Settings → Backend.`
          : `Extension pipe offline — couldn't bind ${bindState.host}:${bindState.port}. Change it in Settings → Backend.`,
        context: { bindHost: bindState.host, bindPort: bindState.port, error: errorMessage(bindState.error) },
      });
      return;
    }

    // No bound server yet: either the initial bind is in flight or we're
    // between binds during a loopback↔LAN flip. Surface a transient
    // yellow rather than a stale green so the pill doesn't claim peers
    // are connected while the socket is down.
    if (!server) {
      reportStatus({
        subsystem: 'sync',
        state: 'yellow',
        message: bindState?.kind === 'binding' ? 'Starting extension pipe…' : 'Extension pipe restarting…',
        context: bindState ? { bindHost: bindState.host, bindPort: bindState.port } : undefined,
      });
      return;
    }

    // Bound and serving — classify by who's connected right now.
    const peers = server.listConnectedPeers();
    const total = peers.length;
    const lan = peers.filter((p) => !p.isLoopback).length;
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: describe(total, lan),
      context: { peerCount: total, lanCount: lan, loopbackCount: total - lan },
    });
  }

  return {
    setBindState(state: DaemonBindState): void {
      if (disposed) return;
      bindState = state;
      emit();
    },
    attachServer(next: OracleWsServer): void {
      if (disposed) return;
      peerUnsubscribe?.();
      server = next;
      // The peer-change event is fired AFTER the registry update, so
      // `listConnectedPeers()` reflects the post-event truth.
      peerUnsubscribe = next.subscribePeerChange(() => emit());
      emit();
    },
    detachServer(): void {
      if (disposed) return;
      peerUnsubscribe?.();
      peerUnsubscribe = null;
      server = null;
      emit();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      peerUnsubscribe?.();
      peerUnsubscribe = null;
      server = null;
    },
  };
}

function describe(total: number, lan: number): string {
  if (total === 0) return 'Idle — no extensions connected';
  if (lan === 0) {
    return total === 1 ? 'Connected to 1 extension on this device' : `Connected to ${total} extensions on this device`;
  }
  if (lan === total) {
    return total === 1 ? 'Connected to 1 extension on LAN' : `Connected to ${total} extensions on LAN`;
  }
  return `Connected to ${total} extension${total === 1 ? '' : 's'} (${lan} on LAN)`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * True when a bind failure is `EADDRINUSE` — the actionable "something
 * else holds this port" case that a port change resolves. Other bind
 * errors (rare, given the supervisor falls back to a sane port for
 * out-of-range settings) get the generic message instead.
 */
function isAddressInUse(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'EADDRINUSE';
}
