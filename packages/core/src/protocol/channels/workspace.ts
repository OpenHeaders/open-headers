/**
 * Workspace-domain bridge RPCs — workspace list/CRUD, import/export,
 * script-review badges, and the basic connection/rules presence calls.
 */

import type { ImportReport } from '../../import';
import type { ExtensionWorkspace, Rule } from '../../types';
import type { WorkspaceSnapshot } from './common';

export interface WorkspaceRpc {
  // ── Connection / presence ──────────────────────────────────────
  popupOpen: {
    req: Record<string, never>;
    res: {
      type?: string;
      rules: Rule[];
      connected: boolean;
      workspaces: ExtensionWorkspace[];
      activeWorkspaceId: string;
    };
  };

  // ── Workspaces ─────────────────────────────────────────────────
  listWorkspaces: {
    req: Record<string, never>;
    res: WorkspaceSnapshot;
  };
  getActiveWorkspace: {
    req: Record<string, never>;
    res: { workspace: ExtensionWorkspace };
  };
  /**
   * Host-neutral resolver consumed by the `getActiveWorkspaceId`
   * capability. Returns `null` on a host with no active workspace
   * (fresh install, no seed). Cheaper than `getActiveWorkspace` for
   * callers that only need the id (eager-mirror init).
   */
  getActiveWorkspaceId: {
    req: Record<string, never>;
    res: { activeWorkspaceId: string | null };
  };
  duplicateWorkspace: {
    req: {
      id: string;
      name?: string;
      /** Target Org for the copy. Omit to land in the source's Org. */
      targetOrgId?: string;
      /** When false, the copy lands with an empty vault and no OAuth
       *  bundles — the user re-enters secrets in the duplicate. */
      includeSecrets?: boolean;
    };
    res: { success: boolean; workspace?: ExtensionWorkspace; error?: string };
  };
  /**
   * Host-local eviction of a consumed workspace — the Discard leg of
   * removing a backend. Unlike the renderer-direct delete (a synced
   * remove mutation), eviction mints no mutation: it purges the
   * workspace's data and log rows and removes the list entity without
   * a tombstone, so re-joining the backend later syncs the workspace
   * back down. SW-side only — it touches IDB log stripes and
   * per-workspace services the renderer can't reach.
   */
  evictWorkspace: {
    req: { workspaceId: string };
    res: { success: boolean; error?: string };
  };
  exportWorkspace: {
    req: {
      /** Falls back to the active workspace when omitted. */
      workspaceId?: string;
      scope:
        | { kind: 'workspace' }
        | {
            kind: 'selection';
            selection: import('../../types').ExportSelection;
            /**
             * Strict-literal export (design §5.5 Advanced override).
             * When `true`, the gatherer ships exactly the picked uids
             * with no descendant/parent expansion.
             */
            strictLiteral?: boolean;
          };
      /**
       * Vault include mode (design §3.1 / §3.2 / §3.3).
       *
       * Encrypted exports are computed entirely SW-side: the renderer
       * passes the user's passphrase, the SW derives the key, encrypts,
       * zeroes the in-memory passphrase reference, and returns the
       * fingerprints alongside the YAML. The passphrase never lands in
       * persisted state.
       */
      vaultMode?: 'omitted' | 'encrypted' | 'plaintext';
      passphrase?: string;
      passphraseHint?: string;
    };
    res: {
      success: boolean;
      yaml?: string;
      exportId?: string;
      scope?: 'workspace' | 'collection' | 'selection';
      /** Present when `vaultMode === 'encrypted'`. Sender shows these to
       *  the recipient out-of-band ("does yours say `7f:a3:c1`?"). */
      ciphertextFingerprint?: string;
      keyFingerprint?: string;
      error?: string;
    };
  };
  /**
   * Apply a parsed `WorkspaceExport` to a target workspace. SW reads
   * the target's current state under a workspace-import lock, runs the
   * collision diff fresh (handles concurrent edits during preview),
   * resolves the user's per-entity strategies into an ImportPlan, and
   * drives `chrome.storage` writes. Returns the persisted
   * `WorkspaceExportImportReport`.
   */
  importWorkspace: {
    req: {
      /** The validated export envelope (already parsed via `parseWorkspaceExport`). */
      incoming: import('../../workspace-export').WorkspaceExport;
      /** User's per-entity strategy choices from the preview modal. */
      strategies: import('../../workspace-export').StrategyMap;
      /** Backup-restore toggle ("this is mine — prefer update-by-uid"). */
      backupRestore?: boolean;
      /** Advanced override — when true, preserves source enabled flags. */
      trustExport?: boolean;
      /** Advanced override — when true, strips request scripts on import. */
      stripScripts?: boolean;
      /** Advanced override — when true, replaces oauth2 Request.auth with
       *  `{ type: 'none' }` on every imported request. */
      omitOAuthConfigs?: boolean;
      /** Advanced override — when true, `update` collisions on
       *  collections preserve the target's `order` field. */
      keepTargetCollectionOrder?: boolean;
      /** Advanced override — when true and target=new, refuse to
       *  create when an existing workspace carries the export's
       *  `workspace.uid`. */
      refuseUidCollision?: boolean;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      /** SHA-256 of the original raw bytes (`sha256:<hex>`). */
      sourceHash: string;
    };
    res: {
      success: boolean;
      report?: import('../../import').WorkspaceExportImportReport;
      targetWorkspaceId?: string;
      error?: string;
    };
  };
  /**
   * Preview-time analog of `importWorkspace`. Reads (no writes) the
   * chosen target workspace and runs the collision diff +
   * missing-deps walk. The renderer drives the preview modal off
   * this; on submit it calls `importWorkspace`, which re-runs the
   * diff under the workspace-import lock for authoritative state.
   * `snapshotHash` lets the renderer detect concurrent edits between
   * preview-open and submit.
   */
  previewWorkspaceImport: {
    req: {
      incoming: import('../../workspace-export').WorkspaceExport;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      backupRestore?: boolean;
    };
    res: {
      success: boolean;
      diff?: import('../../workspace-export').DiffResult;
      missingDeps?: import('../../workspace-export').MissingDep[];
      snapshotHash?: string;
      targetWorkspaceId?: string | null;
      error?: string;
    };
  };
  /**
   * Read the per-entity YAML snapshots written by the most recent
   * `importWorkspace` call for `workspaceId`. Keys are entity uids
   * (plus `__singleton.workspaceVars__` / `__singleton.vault__` for
   * the two singletons); values are the canonical YAML form of each
   * entity AS IT WAS IMPORTED.
   *
   * Drives the merge editor's 3-pane ancestor on re-imports
   * (`MERGE_CONFLICT_EDITOR_PLAN.md` §7): collisions on a uid present
   * here merge against the snapshot as the common base; collisions on
   * a uid not present here fall back to 2-pane.
   *
   * Empty record when the workspace has never been imported into.
   */
  getLastImportedSnapshots: {
    req: { workspaceId: string };
    res: { snapshots: Record<string, string> };
  };
  /**
   * Walk every workspace's `importReports` ring for prior imports
   * matching the incoming export's `exportId` or source-workspace
   * uid. Drives the soft-dedup banner in the preview modal
   * (design §5.2 precedence — exportId beats workspace.uid; same-
   * target beats different-target).
   */
  findWorkspaceExportImportMatches: {
    req: { exportId: string; workspaceUid: string; currentTargetWorkspaceId: string | null };
    res: import('../../types').DedupMatchesResult;
  };
  /**
   * Read the active workspace's set of imported request uids that
   * carry `preRequestScript` / `postResponseScript` and haven't been
   * opened in the inspector since import. The sidebar surfaces these
   * as a "scripts" badge per design §5.5; opening the inspector calls
   * `clearRequestScriptsReviewPending` to drop the uid.
   */
  getRequestScriptsReviewPending: {
    req: Record<string, never>;
    res: { uids: string[] };
  };
  /**
   * Drop a uid from the pending-scripts-review set (active workspace).
   * Called when the user opens the request in the inspector — the
   * badge clears as soon as the script is visible to the eye.
   */
  clearRequestScriptsReviewPending: {
    req: { uid: string };
    res: { success: boolean };
  };
  checkConnection: {
    req: Record<string, never>;
    res: { connected: boolean };
  };
  getRules: {
    req: Record<string, never>;
    res: { rules: Rule[]; isConnected: boolean };
  };
  rulesUpdated: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };

  // ── Import reports (per-workspace ring, ARCHITECTURE §23) ────────
  /** Record an import report. Dedupes by `sourceHash` (non-empty
   *  replaces prior entry; empty string appends as a distinct event). */
  recordImportReport: {
    req: { report: ImportReport };
    res: { success: boolean; error?: string };
  };
  /** Read the full ring — oldest first. Callers typically reverse()
   *  for most-recent-first display. `workspaceId` targets an explicit
   *  workspace's ring (the migration report view reads per-workspace
   *  rings without switching); omitted, the active workspace applies. */
  listImportReports: {
    req: { workspaceId?: string };
    res: { reports: ImportReport[] };
  };
  /** Drop every report for the active workspace. */
  clearImportReports: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };
  /**
   * Look up a prior import report by `sourceHash` for the active
   * workspace. Returns `null` when no match exists — the UI uses
   * this to decide whether to render the re-import-diff panel
   * (ARCHITECTURE §23). Empty-hash inputs always return null since
   * those aren't considered identifying.
   */
  findImportReportBySourceHash: {
    req: { sourceHash: string };
    res: { report: ImportReport | null };
  };
}
