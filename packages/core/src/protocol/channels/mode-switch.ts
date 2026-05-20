/**
 * Mode-switch bridge RPCs — the data-presence probes plus the Phase C
 * M-series + Phase U5 executors that move (or retire) workspace data
 * when the user changes `backend.mode`.
 */

import type {
  CombineResult,
  DiscardBackupArchive,
  DiscardResult,
  PublishResult,
  RestoreResult,
  WorkspaceContentSnapshot,
} from '../../sync';

export interface ModeSwitchRpc {
  /**
   * Walk every resident workspace on the responding host and return the
   * per-workspace user-content tally. Powers the Phase C M-series
   * mode-switch gate: a host invokes this against its peer (via the
   * bridge) and against itself, hands both summaries to
   * `decideModeSwitch`, and lets the verdict drive silent commit vs. the
   * three-option dialog (`docs/DATA_PLANE_TOPOLOGIES.md` §11.2).
   *
   * Empty response when the host hasn't hydrated its workspace store yet
   * — callers treat that as "this host has no data" and let the verdict
   * fall through to the silent path. The response is intentionally
   * detail-rich (per-workspace, per-type counts) so the M2 dialog can
   * render copy like "12 rules + 3 environments + 5 templates" without a
   * second round-trip.
   */
  'oh.sync.getDataPresence': {
    req: Record<string, never>;
    res: { workspaces: WorkspaceContentSnapshot[] };
  };

  /**
   * Same shape as `oh.sync.getDataPresence` but the SW relays the
   * request to the connected peer over the WebSocket (Phase C wire) and
   * forwards the response. The renderer never calls into the wire
   * directly — the SW owns the WS lifecycle, so the relay lives there.
   *
   * `available: false` covers three cases the renderer handles
   * identically:
   *   - `backend.mode === 'in-browser'`            (no peer in this topology)
   *   - the WS is not currently connected           (target offline)
   *   - the relay timed out or threw                (transient failure)
   *
   * The mode-switch orchestrator translates `available: false` to
   * `peer-unreachable`, which fires the "Connect the target first"
   * toast — never silently commits a destructive merge.
   */
  'oh.sync.getPeerDataPresence': {
    req: Record<string, never>;
    res: { available: false } | { available: true; workspaces: WorkspaceContentSnapshot[] };
  };

  /**
   * Mode-switch Discard (Phase C M5) — source-side, local-only.
   *
   * No payload crosses the wire. The host (a) collects every resident
   * workspace into a {@link DiscardBackupArchive}, (b) hands the archive
   * to the host-installed {@link BackupWriter} seam, then (c) deletes
   * every workspace through the standard mutator path. Atomicity is
   * one-way: the archive lands on disk BEFORE any delete runs, so a
   * writer rejection short-circuits before mutating in-memory state.
   * Once the archive is written, partial delete failures still report
   * `delete-failed` but the backup remains valid for M6 restore.
   *
   * Same channel runs on both hosts — extension SW installs a
   * `chrome.downloads`-backed writer; desktop main will install a Node
   * `fs.writeFile`-backed writer. Hosts without a writer (test
   * environments, bootstrap races) return `{ ok: false, reason:
   * 'backup-writer-unavailable' }` and the dialog leaves the user on
   * their original back-end.
   */
  'oh.sync.executeDiscardWithBackup': {
    req: Record<string, never>;
    res: DiscardResult;
  };

  /**
   * Mode-switch Restore (Phase C M6) — local recovery from a
   * {@link DiscardBackupArchive} the user picked from disk.
   *
   * The renderer reads the JSON file, parses + validates the shape,
   * then ships the parsed archive verbatim on this channel. The oracle
   * mints a FRESH UUIDv7 workspace per archive entry (the archive's
   * source-host ids are informational), retargets each snapshot at its
   * newly-minted id, and replays through {@link applyWorkspaceSnapshot}
   * — the same path Coexist + the cold-receiver bootstrap use.
   *
   * Local-only by construction: no wire frame, no peer hop. Restore
   * runs against the host the user is sitting on; there is no symmetric
   * "applyRestore on the peer" — the peer is irrelevant to recovery.
   *
   * Partial-apply stance matches Coexist + Import: the first per-
   * workspace rejection short-circuits with `apply-failed`; earlier
   * workspaces in the archive that did mount stay mounted and are
   * reported in `restoredWorkspaces` on the failure branch.
   */
  'oh.sync.applyDiscardRestore': {
    req: DiscardBackupArchive;
    res: RestoreResult;
  };

  /**
   * Mode-switch Combine (Phase U5.3) — source-side, local-only, the
   * trust-by-process arm of the Phase U5 mode-switch model.
   *
   * After a join (U5.2) folds the target backend's `Org` into this
   * host's authorized set, Combine re-homes this host's own workspaces
   * into that `Org` by flipping each `Workspace.orgId`
   * (UNIFIED_ORACLE_MODEL.md §6.5) — so the joiner's workspaces sync
   * UP and converge with the target's, both directions live.
   *
   * No payload of substance crosses the wire: the request carries only
   * the target `orgId`, and the work is a sequence of local `orgId`
   * metadata mutations. The oracle verifies the target `Org` is in the
   * authorized set (a stale frame asking to re-home into an unjoined
   * `Org` is refused) before flipping anything.
   *
   * Offered ONLY on trust-by-process (loopback) backends — pushing data
   * up to an authenticated backend is the explicit per-workspace
   * "Publish" path (U5.6), never a Combine side effect. The posture
   * gate lives in the mode-switch dialog (U5.5).
   */
  'oh.sync.executeCombine': {
    req: { targetOrgId: string };
    res: CombineResult;
  };

  /**
   * Mode-switch Use-Target (Phase U5.4) — source-side, local-only.
   *
   * The "use the target's data only" arm of the Phase U5 mode-switch
   * model. Retires this host's own workspaces — exports them to a
   * backup file via the host-installed {@link BackupWriter}, then
   * deletes them — so the user works purely against a joined backend's
   * data. Workspaces already synced down from the target (those bound
   * to the target `Org`) are kept; deleting them would discard the
   * data the user chose to adopt.
   *
   * Mechanically a Discard restricted to this host's own workspace
   * subset — same archive-before-delete atomicity, same
   * {@link DiscardResult} contract. The request carries only the
   * target `orgId`; the oracle verifies it is in the authorized set
   * before retiring anything.
   */
  'oh.sync.executeUseTarget': {
    req: { targetOrgId: string };
    res: DiscardResult;
  };

  /**
   * Mode-switch Publish (Phase U5.6) — source-side, local-only, the
   * deliberate per-workspace gesture that re-homes ONE workspace into an
   * authenticated backend's `Org`.
   *
   * Publish is the ONLY path a workspace's data travels UP to a LAN /
   * WAN backend: a join (U5.2) never pushes the joiner's data up (the
   * receiver-side org filter drops it structurally), and Combine (U5.3)
   * is offered solely on trust-by-process backends. Publish is the
   * explicit opt-in for the authenticated case.
   *
   * Mechanically a single-workspace Combine — one `Workspace.orgId` flip
   * (UNIFIED_ORACLE_MODEL.md §6.5), no wire payload of substance. The
   * request carries the workspace + the target `orgId`; the oracle
   * applies the U5.6 Publish gate (`canPublishWorkspace`) — the caller
   * must hold `workspace.write` on the workspace AND the target `Org`
   * must be in the authorized (joined) set — before flipping. A stale
   * or forged frame is refused with `target-not-authorized`.
   *
   * Idempotent: re-publishing a workspace already bound to the target
   * `Org` is an `ok: true` no-op (`published.fromOrgId === targetOrgId`).
   */
  'oh.sync.publishWorkspace': {
    req: { workspaceId: string; targetOrgId: string };
    res: PublishResult;
  };
}
