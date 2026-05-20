/**
 * Daemon-admin bridge RPCs — the device-flow pairing surface (U3.3) and
 * the known-devices live connection projection (U3.4).
 *
 * Admin-only. The peer never sees these — they are called only by the
 * daemon's own renderer (Settings → Backend → LAN peers).
 */

export interface DaemonRpc {
  // ── Daemon device-flow pairing (U3.3) ──────────────────────────
  //
  // Admin-only surface for issuing a short-lived pairing code that a
  // peer can confirm by opening a daemon-hosted URL. The peer never
  // sees these RPCs — they hit the HTTP routes attached to the same
  // ws-server bind. See `data-plane.md` §11.4 hybrid pattern.

  /**
   * Allocate a fresh pairing code + URL. Returns the candidate URLs
   * the admin can read aloud / show as a QR. `pairingUrls` carries
   * every non-loopback interface address — useful when the daemon
   * binds on `0.0.0.0` and the admin doesn't know which network the
   * peer is on. Loopback (`127.0.0.1`) is included as a fallback so
   * the admin can pair a same-machine browser.
   */
  'oh.daemon.pairing.start': {
    req: { deviceLabel?: string };
    res:
      | {
          ok: true;
          code: string;
          expiresAt: number;
          port: number;
          pairingUrls: ReadonlyArray<{ host: string; url: string; iface?: string }>;
        }
      | { ok: false; error: string };
  };

  /**
   * Snapshot of in-flight pairing codes — the modal polls this every
   * second so it can transition to "Paired" when the peer confirms
   * (the daemon doesn't broadcast pairing events; polling keeps the
   * IPC surface tiny).
   */
  'oh.daemon.pairing.list': {
    req: Record<string, never>;
    res: {
      pairs: ReadonlyArray<{
        code: string;
        deviceLabel?: string;
        createdAt: number;
        expiresAt: number;
        status: 'pending' | 'confirmed' | 'expired' | 'consumed';
      }>;
    };
  };

  /** Cancel a pending pair (admin closed the modal without waiting). */
  'oh.daemon.pairing.cancel': {
    req: { code: string };
    res: { ok: true };
  };

  // ── Daemon known-devices surface (U3.4) ────────────────────────
  //
  // Admin-only. The access-token ledger lives in `hostStorage` and is
  // read / mutated by the renderer directly (`listDaemonAuthTokens` /
  // `mintDaemonAuthToken` / `revokeDaemonAuthToken`). What the renderer
  // cannot see is runtime ws-server state — which tokens map to a peer
  // connected right now. This RPC projects that live set so the "Known
  // devices" list can highlight connected entries.

  /**
   * The `DaemonAuthToken` ids that map to a peer connected right now.
   * Empty when the daemon is loopback-only (no token gate, no LAN
   * peers). The renderer polls this while the LAN-peers settings pane
   * is open.
   */
  'oh.daemon.tokens.connected': {
    req: Record<string, never>;
    res: { tokenIds: readonly string[] };
  };
}
