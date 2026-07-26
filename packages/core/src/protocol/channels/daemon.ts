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

import type { LicenseSnapshot } from '../../licensing';
import type {
  ProxyCaPublicInfo,
  ProxyCaptureStatus,
  ProxyRoutingStatus,
  ProxyTrustChange,
  ProxyTrustStoreId,
  ProxyTrustStoreState,
} from '../../types';
import type { TelemetryStorageMethod } from '../telemetry-storage';
import type {
  BrowserTabWire,
  TelemetryBrowserIdentity,
  TelemetryDebugCommand,
  TelemetryDebugState,
} from '../telemetry-stream';

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
  // Admin-only. The access-token ledger lives in `hostStorage`, but
  // every surface — desktop settings and the served admin console —
  // reads AND mutates it through these RPCs. Reads project the ledger
  // (`tokens.list`); mutations (mint / revoke) run in the daemon's
  // main realm, sharing a single read-modify-write mutex with HELLO
  // `validateDaemonAuthToken`. Mutating from a surface instead would
  // race main's `lastUsedAt` write-back and could silently undo a
  // revoke (cross-realm: the two realms hold separate mutexes). Revoke
  // additionally evicts the live socket so the kill-switch fires now,
  // not on the peer's next HELLO.

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
   * Ledger projection for admin surfaces — every token row (revoked
   * included, forensic shape), minus the secret hash. This is the
   * read path that works on ANY host: the desktop renderer's IPC and
   * the served web tab's wire reach the same handler, so no surface
   * needs the daemon-local `hostStorage` ledger anymore.
   */
  'oh.daemon.tokens.list': {
    req: Record<string, never>;
    res: {
      tokens: ReadonlyArray<{
        id: string;
        label?: string;
        userId?: string;
        /**
         * `apiToken` = operator-minted credential; `session` = SSO
         * login mint. Absent only on rows minted before the marker
         * existed — surfaces treat those as `apiToken`.
         */
        kind?: 'session' | 'apiToken';
        expiresAt?: number;
        createdAt: number;
        lastUsedAt: number | null;
        revokedAt: number | null;
      }>;
    };
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

  // ── CLI provisioning (TUI_PLAN.md §7 / TUI_STATUS.md S15) ────────
  //
  // Admin-only. One-click setup of the host machine's `oh` CLI: mint an
  // `apiToken` labeled `CLI — <hostname>` through the same daemon-mutex
  // path as `tokens.mint`, then merge `{daemonUrl, token}` into
  // `openheaders/cli.json` (`@openheaders/core/cli-config` shape —
  // telemetry/channel keys are never touched). The raw secret goes
  // straight to disk in the host process and NEVER crosses this
  // contract. Re-provisioning rotates: the host remembers the last
  // provisioned tokenId and revokes it after the new file write, so the
  // devices ledger never accumulates orphan CLI rows.

  /**
   * Live provisioning status, derived at call time by hashing the
   * config file's token against the ledger — never cached, so a revoked
   * or rotated-elsewhere token reads as `stale` immediately.
   * `unconfigured` = no file or no token in it; `configured` = the
   * stored token is active in this daemon's ledger (`tokenId`/`label`
   * present); `stale` = the stored token is revoked, expired, or
   * unknown here while the file points at this daemon; `external` = the
   * file carries an unknown token AND a foreign `daemonUrl` (someone
   * ran `oh connect` against another daemon — provisioning over it must
   * be an explicit, informed click); `malformed` = the file exists but
   * doesn't parse (`error` says why; provisioning refuses to touch it).
   *
   * `binaryInstalled` reports whether a terminal tab spawned by the
   * HOST could run `oh` — on Windows a scan of the host process PATH
   * (the pty's cmd inherits it), on POSIX a login-shell `command -v`
   * probe (tabs run login shells, so profile-sourced PATH counts).
   * Provisioning is token-only (the CLI installs separately via the
   * feed's install scripts), so a token can be `configured` while the
   * binary is absent. `hostPlatform` is the host's `process.platform`,
   * so callers can surface the right install command even when the UI
   * realm runs on a different OS than the daemon (remote web UI).
   */
  'oh.daemon.cli.status': {
    req: Record<string, never>;
    res: {
      configPath: string;
      state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
      /** An `oh` executable resolves on the host's PATH right now. */
      binaryInstalled: boolean;
      /** The host's `process.platform` (`win32`, `darwin`, `linux`, …). */
      hostPlatform: string;
      /** The active ledger row backing the stored token (`configured` only). */
      tokenId?: string;
      label?: string;
      /** The file's `daemonUrl` (present when the file parses and has one). */
      daemonUrl?: string;
      /** The parse failure (`malformed` only). */
      error?: string;
    };
  };

  /**
   * Mint + write in one host-side step; returns only the file path and
   * the ledger id — the secret is on disk, not in the response. Refuses
   * a malformed existing file (fix or delete it first — same law as
   * `oh connect`). Rotates the previously provisioned token when one is
   * remembered: mint-first, write, then revoke, so a mid-flight failure
   * never leaves the machine without a working credential.
   */
  'oh.daemon.cli.provision': {
    req: Record<string, never>;
    res: { ok: true; configPath: string; tokenId: string } | { ok: false; error: string };
  };

  // ── Daemon-local user directory (Phase 5 team tier, slice 1) ────
  //
  // Admin-only. The directory (`OH.daemonUsers`) reuses the §5
  // identity rows per user; tokens bind to a user via
  // `DaemonAuthToken.userId`. Mutations route through the daemon's
  // main realm for the same mutex reasons as the token RPCs above.

  /**
   * Admit a user to the directory. `email` optional (local identity).
   * `personalLicense` = a personal-seat key redeemed at the seat limit
   * (admits past the pool when it identity-matches `email`).
   */
  'oh.daemon.users.create': {
    req: { displayName: string; email?: string; personalLicense?: string };
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
        /** Git commit-author email override (GIT_PLAN.md §11.5); null = derive from email/synthetic. */
        gitEmail: string | null;
        createdAt: number;
        deactivatedAt: number | null;
        /** The user holds a password credential (never the verifier itself). */
        hasPassword: boolean;
        /**
         * Personal-seat provenance — present only for users admitted
         * past the pool by their own license. `status` is derived by
         * verifying the stored artifact at projection time; an expired
         * personal seat stays visible and never evicts its user.
         */
        admission?: { licenseId: string; status: 'licensed' | 'grace' | 'expired' | 'invalid' };
        grants: ReadonlyArray<{ workspaceId: string; role: 'owner' | 'editor' | 'viewer'; origin?: 'idp' }>;
      }>;
    };
  };

  /**
   * Org buy-out: absorb a personally-admitted user into the daemon's
   * seat pool — clears the admission provenance (and the stored
   * artifact, so the refresh agent stops renewing it here). One-way.
   */
  'oh.daemon.users.absorbSeat': {
    req: { userId: string };
    res: { ok: true } | { ok: false; error: string };
  };

  /**
   * Set (or clear, `password: null`) a directory user's password for
   * the daemon's local password login — the no-OIDC deployment's
   * interactive login. Operator-driven by design: no email plane
   * exists, so there is no self-service set/reset. The verifier is
   * computed and stored daemon-side; the password itself is never
   * persisted. Refused on deactivated users.
   */
  'oh.daemon.users.setPassword': {
    req: { userId: string; password: string | null };
    res: { ok: true } | { ok: false; error: string };
  };

  /**
   * Set (or clear, `gitEmail: null`) a directory user's git
   * commit-author email override (GIT_PLAN.md §11.5) — the address
   * daemon-minted commits attribute the user's work to, so commits
   * link to their hosting-platform profile. The author name is always
   * the directory displayName. Refused on deactivated users.
   */
  'oh.daemon.users.setGitEmail': {
    req: { userId: string; gitEmail: string | null };
    res: { ok: true } | { ok: false; error: string };
  };

  /**
   * The admin console's Git card (GIT_PLAN.md §11.5): every
   * `oh.workspaceTree.*` gesture rides this one channel as
   * `{ op, payload }`, answered by the daemon spine's shared verb
   * table under the same `daemon.admin` gate as the rest of this
   * contract. The response is the op's own typed shape — callers
   * narrow it at the transport seam.
   */
  'oh.daemon.workspaceTree.dispatch': {
    req: { op: string; payload?: Record<string, unknown> };
    res: unknown;
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

  // ── License slot (LICENSING_PLAN.md §3.3, slice 2) ───────────────
  //
  // Admin-only. The slot (load / verify / watch of the host's
  // `license.key`) lives in the daemon spine; these RPCs are its whole
  // management surface — desktop Settings over IPC and the served
  // admin console over the gated peer plane reach the same handlers.
  // Live updates ride the `licenseUpdated` broadcast.

  /** Current entitlement snapshot — what the License page renders. */
  'oh.daemon.license.status': {
    req: Record<string, never>;
    res: { snapshot: LicenseSnapshot };
  };

  /**
   * Verify `text` and, when it verifies as `licensed` or `grace`,
   * persist it atomically as the host's license file. Invalid or
   * already-past-grace artifacts are refused without touching the
   * installed file.
   */
  'oh.daemon.license.install': {
    req: { text: string };
    res: { ok: true; snapshot: LicenseSnapshot } | { ok: false; error: string };
  };

  /** Delete the license file; the host reverts to free-tier limits. */
  'oh.daemon.license.remove': {
    req: Record<string, never>;
    res: { ok: true; snapshot: LicenseSnapshot };
  };

  // ── Audit reports (Phase 1 slice 3) ──────────────────────────────
  //
  // Admin-only read projection of the daemon's SQLite audit log — the
  // audit store's first RPC consumer; same rows `ohd audit`
  // reads, never a second store. Responses ride one WS frame, so the
  // server clamps `limit` to a hard cap and pages via a keyset cursor
  // (the full `(occurredAt, orgId, seq)` sort key of the last row —
  // exact boundaries even when rows share a timestamp). `capability`
  // `daemon.admission` rows are the HELLO admission stamps; surfaces
  // render them as "admission", not enforcement decisions.

  /**
   * Filtered audit-log page. All filters optional; `since`/`until` are
   * ISO bounds on `occurredAt` (inclusive/exclusive). `nextCursor` is
   * non-null when more rows match — echo it back as `after` for the
   * next page.
   */
  // ── Proxy trust plane (PROXY_SECURITY.md §6, Phase 1) ────────────
  //
  // Admin-only. The CA lifecycle behind the host capture plane's
  // consent wizard: install/remove the per-machine CA in concrete
  // trust stores, and read live trust state. The CA private key NEVER
  // crosses this contract — responses carry only the derived public
  // projection (`ProxyCaPublicInfo`) and per-store probe verdicts. No
  // traffic flows through any of these; TLS termination is Phase 2.

  /**
   * Live trust state, re-derived on every call by probing each store
   * (never a remembered flag — the peek-don't-bump discipline). `ca`
   * is null until first trust mints one. `stores` covers every store
   * this machine exposes (login/System keychains, discovered Firefox
   * profiles) unioned with the recorded changes; `changes` is the
   * durable what-we-changed record teardown will undo. Where Firefox
   * reads the OS store (macOS, Firefox 120+), unrecorded profiles
   * carry a derived verdict (`covered`/`optedOut`) instead of a
   * probed one — only recorded legacy rows still probe via certutil.
   */
  'oh.daemon.proxy.trust.status': {
    req: Record<string, never>;
    res: {
      ca: ProxyCaPublicInfo | null;
      stores: ReadonlyArray<ProxyTrustStoreState>;
      changes: ReadonlyArray<ProxyTrustChange>;
      /**
       * Whether the host can install *and remove* System-keychain
       * (admin-domain) trust settings on this build. macOS admin-domain
       * `SecTrustSettings` writes need a session-preserving privileged
       * path; the osascript elevation seam cannot provide one (it detaches
       * the security session), so this is false until the signed
       * privileged helper ships. The consent wizard disables the System
       * option while false rather than offer a path that would half-
       * install and could not be undone.
       */
      systemKeychainTrustSupported: boolean;
    };
  };

  /**
   * Install the CA into the named stores — the consent wizard's commit
   * step; the click IS the authorization, so callers send an explicit
   * non-empty store list, never "all". Mints the per-machine CA on
   * first use. Each store reports its own outcome: partial failure is
   * reported exactly (§5 refuse-rather-than-half-trust), never rolled
   * up into a false success. `elevationRequired` marks a store that
   * refused for lack of admin rights AND was left verifiably clean —
   * surfaces re-ask with elevation, never retry around a denial.
   * `residue` marks the opposite failure shape: the cert was imported
   * but could not be trusted (e.g. a cancelled trust prompt after the
   * import), so the store is NOT "left unchanged" — its change row is
   * kept and the surface points the user at Remove trust to clean it.
   */
  'oh.daemon.proxy.trust.install': {
    req: { stores: ReadonlyArray<ProxyTrustStoreId> };
    res:
      | {
          ok: true;
          ca: ProxyCaPublicInfo;
          results: ReadonlyArray<{
            store: ProxyTrustStoreId;
            ref: string;
            ok: boolean;
            error?: string;
            elevationRequired?: boolean;
            residue?: boolean;
          }>;
        }
      | { ok: false; error: string };
  };

  /**
   * Teardown: remove the CA from every store the change record names —
   * exactly what we changed, nothing else. Idempotent (an already-gone
   * cert reads as removed) and honest per store; a row is dropped from
   * the record only on verified removal, so a partial failure leaves
   * the remaining rows for the next attempt. The sealed CA slot itself
   * is kept unless `dropCa` is true (re-trusting reuses the same CA;
   * uninstall passes `dropCa`).
   */
  'oh.daemon.proxy.trust.remove': {
    req: { dropCa?: boolean };
    res: {
      ok: boolean;
      results: ReadonlyArray<{
        store: ProxyTrustStoreId;
        ref: string;
        ok: boolean;
        error?: string;
        elevationRequired?: boolean;
      }>;
      /** Present when the teardown pass itself failed to run. */
      error?: string;
    };
  };

  /**
   * Privileged-helper management for the Settings card (macOS only).
   * State is re-derived per call: `present` = the helper binary ships
   * in this build; `available` = the registered daemon answered a live
   * XPC probe; `registration` = the read-only SMAppService state
   * (`requiresApproval` means macOS is waiting for the Login Items
   * toggle), null when no binary answers. Register/unregister run the
   * helper's client verbs and report the resulting registration state;
   * neither touches any trust store. `helperLoginItems` opens System
   * Settings › Login Items for the approval step.
   */
  'oh.daemon.proxy.trust.helper': {
    req: Record<string, never>;
    res: {
      present: boolean;
      available: boolean;
      reason?: string;
      registration: 'enabled' | 'requiresApproval' | 'notRegistered' | 'notFound' | 'unknown' | null;
    };
  };

  'oh.daemon.proxy.trust.helperRegister': {
    req: Record<string, never>;
    res: {
      ok: boolean;
      error?: string;
      status?: 'enabled' | 'requiresApproval' | 'notRegistered' | 'notFound' | 'unknown';
    };
  };

  'oh.daemon.proxy.trust.helperUnregister': {
    req: Record<string, never>;
    res: {
      ok: boolean;
      error?: string;
      status?: 'enabled' | 'requiresApproval' | 'notRegistered' | 'notFound' | 'unknown';
    };
  };

  'oh.daemon.proxy.trust.helperLoginItems': {
    req: Record<string, never>;
    res: { ok: boolean; error?: string };
  };

  // ── Proxy capture plane (PROXY_PLAN.md Phase 2) ──────────────────
  //
  // Admin-only. The L7 capture proxy's control surface — bind/unbind
  // the local proxy port, read live state, and set the §2.4 decrypt
  // scope. Captured traffic NEVER rides these contracts: it flows on the
  // lifecycle lifeline (`oh-lifecycle:<PROXY_LIFECYCLE_TAB_ID>`), the
  // same pipe the browser panel's network table consumes. These are the
  // knobs; the capture stream is a separate transport.

  /**
   * Live capture-proxy state, re-derived per call (bound port from the
   * live server, CA presence from a fresh sealed-slot read — never a
   * cached flag). `boundPort` is null while stopped; `port` is the
   * persisted preference the next start binds; `caPresent` false means
   * every CONNECT rides an opaque blind tunnel (no leaf minting).
   */
  'oh.daemon.proxy.status': {
    req: Record<string, never>;
    res: ProxyCaptureStatus;
  };

  /**
   * Bind the capture proxy. `port` overrides AND persists the port
   * preference; omit to bind the stored one. Refuses a port change
   * while running (stop first) and refuses an out-of-range port.
   */
  'oh.daemon.proxy.start': {
    req: { port?: number };
    res: { ok: true; port: number } | { ok: false; error: string };
  };

  /** Unbind the capture proxy. Captured lifecycles stay inspectable
   *  until the next start — a stop closes the tap, not the record. */
  'oh.daemon.proxy.stop': {
    req: Record<string, never>;
    res: { ok: true };
  };

  /**
   * Replace the decrypt-scope list — live immediately (no rebind) and
   * persisted. Patterns are `example.com` / `*.example.com` / IP
   * literal; an invalid entry refuses the whole edit (the bare `*`
   * catch-all is unrepresentable by construction). Empty list =
   * intercept nothing (scoped-decrypt-by-default).
   */
  'oh.daemon.proxy.scope.set': {
    req: { patterns: ReadonlyArray<string> };
    res: { ok: true; scopePatterns: ReadonlyArray<string> } | { ok: false; error: string };
  };

  /**
   * Flip the scoped browser-routing desire (OBSERVABILITY_PLAN.md
   * §5.1) — persisted, and pushed to every same-device browser peer as
   * the folded verdict (desire AND proxy bound). The response carries
   * the post-edit routing projection so the surface renders without a
   * second round trip.
   */
  'oh.daemon.proxy.routing.set': {
    req: { enabled: boolean };
    res: { ok: true; routing: ProxyRoutingStatus } | { ok: false; error: string };
  };

  /**
   * Live scoped-routing projection: the persisted desire, the folded
   * active verdict, and each connected browser peer's last ack (what
   * actually applied — PAC / per-request / unsupported, or a
   * proxy-settings conflict error).
   */
  'oh.daemon.proxy.routing.status': {
    req: Record<string, never>;
    res: ProxyRoutingStatus;
  };

  // ── Browser telemetry plane (OBSERVABILITY_PLAN.md Phase 1) ──────
  //
  // Admin-only. The live browser-tab inventory the workbench's Live
  // Network picker renders — gathered per call by asking every
  // connected extension peer over the telemetry channels; peers that
  // don't answer inside the collection window are simply absent.
  // Lifecycle streams NEVER ride this contract: they flow on the
  // qualified lifecycle lifeline (`oh-lifecycle:<tabId>@<nodeId>`),
  // relayed frame-for-frame from the owning extension's hub.

  /**
   * Browser tabs per connected extension peer. `nodeId` is the peer's
   * HELLO identity — the qualifier the workbench passes back when it
   * opens a tab's lifecycle lifeline; `agent` labels the extension
   * build; `browser` is the browser's display identity for the source
   * rail. Empty when no extension peer is connected.
   */
  'oh.daemon.telemetry.tabs.list': {
    req: Record<string, never>;
    res: {
      peers: ReadonlyArray<{
        nodeId: string;
        agent: string;
        browser: TelemetryBrowserIdentity;
        debug: TelemetryDebugState;
        tabs: ReadonlyArray<BrowserTabWire>;
        /** The peer's telemetry consent gate — `false` renders the
         *  browser's rows honestly-unwatchable in the source rail. */
        watchConsent: boolean;
      }>;
    };
  };

  /**
   * One Debug-mode control command relayed to the extension peer named
   * by `nodeId` — pin/unpin a tab into the CDP attach scope or flip the
   * master switch (the Traffic Monitor's per-tab fidelity affordance).
   * `debug` is the peer's post-command state snapshot, `null` when the
   * peer never answered inside the collection window (`ok` false).
   */
  'oh.daemon.telemetry.debug.control': {
    req: { nodeId: string; command: TelemetryDebugCommand };
    res: { ok: boolean; debug: TelemetryDebugState | null };
  };

  /**
   * One storage bridge call relayed to the extension peer named by
   * `nodeId` (OBSERVABILITY_PLAN.md Phase 3 — the storage plane).
   * `method`/`params`/`payload` are the verb's own `DevToolsRpc`
   * shapes, carried opaquely here; the caller's typed client narrows
   * them at the wire boundary. `ok` false = the peer is absent or never
   * answered inside the call window (`payload` null) — distinct from a
   * verb-level failure, which rides inside the verb's own payload.
   */
  'oh.daemon.telemetry.storage.call': {
    req: { nodeId: string; method: TelemetryStorageMethod; params: unknown };
    res: { ok: boolean; payload: unknown };
  };

  'oh.daemon.audit.query': {
    req: {
      actorUserId?: string;
      capability?: string;
      /** `true` = allows only, `false` = denies only. */
      allow?: boolean;
      workspaceId?: string;
      sinceIso?: string;
      untilIso?: string;
      /** Rows per page; server clamps to its cap (default 100, max 500). */
      limit?: number;
      /** By `occurredAt`; default `'desc'` (newest first). */
      order?: 'asc' | 'desc';
      after?: { occurredAt: string; orgId: string; seq: number };
    };
    res: {
      entries: ReadonlyArray<{
        id: string;
        orgId: string;
        seq: number;
        actorUserId: string;
        capability: string;
        workspaceId?: string;
        decision: { allow: boolean; reason?: string };
        occurredAt: string;
      }>;
      nextCursor: { occurredAt: string; orgId: string; seq: number } | null;
    };
  };
}
