/**
 * Public argument/result shapes for the import + preview RPCs.
 */

import type { WorkspaceExportImportReport } from '@openheaders/core/import';
import type { StrategyMap, WorkspaceExport } from '@openheaders/core/workspace-export';

export type ImportTargetSelector =
  | { mode: 'current' }
  | {
      mode: 'new';
      /** User-overridden workspace name from the import-preview's
       *  editable input on `mode='new'`. Falls back to the export's
       *  `workspace.name` when omitted. Collision suffix is applied on
       *  top of whichever name we end up with. */
      name?: string;
    }
  | { mode: 'picked'; workspaceId: string };

export interface ImportWorkspaceArgs {
  incoming: WorkspaceExport;
  /** User's per-entity strategy choices from the preview modal. */
  strategies: StrategyMap;
  /** Backup-restore toggle (flips collision-uid defaults to `update`). */
  backupRestore?: boolean;
  /** When `true`, preserves source `enabled` flags (Advanced override). */
  trustExport?: boolean;
  /** When `true`, strips `preRequestScript` / `postResponseScript` from
   *  every imported request (Advanced override; default-on for low-trust
   *  sources per design §5.5). */
  stripScripts?: boolean;
  /** When `true`, replaces every imported oauth2 `Request.auth` with
   *  `{ type: 'none' }` so the recipient configures auth from scratch
   *  (Advanced override per design §5.5). */
  omitOAuthConfigs?: boolean;
  /** When `true`, `update` collisions on collections preserve the
   *  target's `order` instead of taking export's (Advanced override
   *  per design §5.5). */
  keepTargetCollectionOrder?: boolean;
  /** When `true` and target=new, refuse to create when an existing
   *  workspace already carries the export's `workspace.uid`. The user
   *  must switch to "Pick existing" to merge into it (Advanced override
   *  per design §5.5). Default behavior silently regenerates the uid. */
  refuseUidCollision?: boolean;
  target: ImportTargetSelector;
  /** SHA-256 of the original raw export bytes (`sha256:<hex>`). */
  sourceHash: string;
}

export interface ImportWorkspaceResult {
  /** The ImportReport persisted into the target workspace's ring. */
  report: WorkspaceExportImportReport;
  /** Final target workspaceId (newly-created on `mode: 'new'`). */
  targetWorkspaceId: string;
}
