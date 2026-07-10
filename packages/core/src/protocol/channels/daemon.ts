/**
 * Daemon-admin bridge RPCs — the device-flow pairing surface (U3.3),
 * the known-devices live connection projection (U3.4), the user
 * directory + grants (Phase 5), and the admin-visibility probe.
 *
 * Admin-only. Reachable from the daemon's own local surfaces (desktop
 * renderer over IPC) and, since the admin-console slice, from
 * authenticated WS peers — where every call is gated per frame on the
 * `daemon.admin` capability and audited; a denied call answers a
 * uniform in-band error.
 */

export interface DaemonRpc {
  /**
   * Admin-visibility probe: may the calling subject administer this
   * daemon? Local surfaces are the operator by construction and always
   * read `true`; a WS peer reads its per-frame `daemon.admin`
   * resolution. Deliberately NOT audited — it is a visibility
   * question the UI asks on every connect, not an enforcement
   * decision; auditing it would bury real deny rows in noise.
   */
  'oh.daemon.admin.status': {
    req: Record<string, never>;
    res: { admin: boolean };
  };

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
    req: { deviceLabel?: string; userId?: string };
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
  // Admin-only. The access-token ledger lives in `hostStorage`. The
  // renderer *reads* it directly (`listDaemonAuthTokens` + a storage
  // subscription — race-free), but *mutations* (mint / revoke) route
  // through these RPCs so they run in the daemon's main realm, sharing a
  // single read-modify-write mutex with HELLO `validateDaemonAuthToken`.
  // Mutating from the renderer instead would race main's `lastUsedAt`
  // write-back and could silently undo a revoke (cross-realm: the two
  // realms hold separate mutexes). Revoke additionally evicts the live
  // socket so the kill-switch fires now, not on the peer's next HELLO.

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

  /**
   * Mint a fresh `DaemonAuthToken` in the daemon's main realm. Returns
   * the raw secret exactly once (the ledger keeps only its hash). Routed
   * here rather than called in the renderer so the persist shares main's
   * token-store mutex.
   */
  'oh.daemon.tokens.mint': {
    req: { label?: string; userId?: string };
    res: { ok: true; tokenId: string; secret: string } | { ok: false; error: string };
  };

  /**
   * Revoke a `DaemonAuthToken` by id and force-disconnect any peer
   * connected with it right now. The revoke persists before the eviction
   * so a reconnect racing the drop re-validates against the revoked
   * ledger. No-op (still `ok`) if the id is unknown / already revoked.
   */
  'oh.daemon.tokens.revoke': {
    req: { tokenId: string };
    res: { ok: true } | { ok: false; error: string };
  };

  // ── Daemon-local user directory (Phase 5 team tier, slice 1) ────
  //
  // Admin-only. The directory (`OH.daemonUsers`) reuses the §5
  // identity rows per user; tokens bind to a user via
  // `DaemonAuthToken.userId`. Mutations route through the daemon's
  // main realm for the same mutex reasons as the token RPCs above.

  /** Admit a user to the directory. `email` optional (local identity). */
  'oh.daemon.users.create': {
    req: { displayName: string; email?: string };
    res: { ok: true; userId: string } | { ok: false; error: string };
  };

  /** Flat directory projection for admin surfaces, grants included. */
  'oh.daemon.users.list': {
    req: Record<string, never>;
    res: {
      users: ReadonlyArray<{
        userId: string;
        displayName: string;
        email: string | null;
        createdAt: number;
        deactivatedAt: number | null;
        grants: ReadonlyArray<{ workspaceId: string; role: 'owner' | 'editor' | 'viewer' }>;
      }>;
    };
  };

  /**
   * Deactivate a directory user: the record stays (forensic shape),
   * every token bound to the user is revoked, and live peers riding
   * those tokens are force-disconnected — same persist-before-evict
   * ordering as `tokens.revoke`.
   */
  'oh.daemon.users.deactivate': {
    req: { userId: string };
    res: { ok: true } | { ok: false; error: string };
  };

  // ── Workspace grants (Phase 5 team tier, slice 2) ────────────────
  //
  // Admin-only. Grants are `WorkspaceRoleAssignment` rows for the
  // directory user's principal, sharing `OH.workspaceRoleAssignments`
  // (and its writer lock) with the boot reconcile. Enforcement reads
  // them per frame, so a grant/revoke takes effect on live connections
  // immediately — no eviction required.

  /**
   * Grant (or update in place — `updated: true`) a workspace role for a
   * directory user. Refuses unknown/deactivated users and workspaces
   * not in the live set (a dangling grant would only be dropped by the
   * next WRA reconcile).
   */
  'oh.daemon.users.grant': {
    req: { userId: string; workspaceId: string; role: 'owner' | 'editor' | 'viewer' };
    res: { ok: true; updated: boolean } | { ok: false; error: string };
  };

  /** Drop a directory user's grant on one workspace. */
  'oh.daemon.users.revokeGrant': {
    req: { userId: string; workspaceId: string };
    res: { ok: true } | { ok: false; error: string };
  };
}
