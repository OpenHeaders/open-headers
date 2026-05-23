/**
 * Mode-switch bridge RPCs — the data-presence probes plus the Phase C
 * M-series + Phase U5 executors that move (or retire) workspace data
 * when the user changes `backend.mode`.
 */

import type { DiscardBackupArchive, DiscardResult, RestoreResult, WorkspaceContentSnapshot } from '../../sync';

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
}
