/**
 * Mode-switch Discard — host-coupled backup-writer registry.
 *
 * The discard orchestrator produces a {@link DiscardBackupArchive} but
 * the act of putting it on disk is host-specific:
 *
 *   - Extension SW writes through `chrome.downloads.download` to a
 *     user-selectable destination (the only filesystem surface a
 *     manifest-v3 service worker can reach).
 *   - Desktop main writes through `fs.writeFile` into
 *     `<userData>/oh-backups/<timestamp>.json`.
 *
 * A host-installed registry seam — each host calls {@link setBackupWriter}
 * at boot to install its own writer; absent registration ⇒ orchestrator
 * returns `backup-writer-unavailable`.
 */

import type { DiscardBackupArchive } from '@openheaders/core/sync';

/**
 * Writes the archive to durable storage and returns the resolved
 * destination path (a file path or directory path — the renderer just
 * quotes it back to the user). Rejections are caught by the orchestrator
 * and reported as `backup-failed`; the orchestrator does NOT delete any
 * workspaces if the writer rejects, so the user is intact.
 */
export type BackupWriter = (archive: DiscardBackupArchive) => Promise<{ backupPath: string }>;

let writer: BackupWriter | null = null;

/**
 * Install (or remove) the host's backup writer. Called once at boot per
 * host that can persist to disk. Passing `null` reverts to the
 * unavailable state — useful in tests and on shutdown.
 */
export function setBackupWriter(next: BackupWriter | null): void {
  writer = next;
}

/** Read the currently-installed writer. `null` ⇒ host can't back up. */
export function getBackupWriter(): BackupWriter | null {
  return writer;
}
