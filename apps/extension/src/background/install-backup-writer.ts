/**
 * Mode-switch Discard (M5) — extension-SW backup-writer installer.
 *
 * The host-neutral discard orchestrator
 * (`packages/oracle/src/sync/mode-switch/discard-orchestrator.ts`)
 * builds a {@link DiscardBackupArchive} then asks for a writer to put
 * it on disk. The writer is host-specific — the extension SW writes
 * through `chrome.downloads.download` (the only filesystem surface a
 * manifest-v3 service worker can reach); desktop main installs a
 * separate `fs.writeFile`-backed writer.
 *
 * MV3 service workers don't have `URL.createObjectURL`; the archive is
 * serialized as a JSON `data:` URL and handed to `downloads.download`
 * with a deterministic filename (`oh-backup-<timestamp>.json`). The
 * browser routes the file through the user's default downloads folder
 * — or, if the user has set "ask where to save each file" in chrome://
 * settings, surfaces a Save-As dialog.
 *
 * Failure modes (handled by orchestrator's catch):
 *   - `chrome.runtime.lastError` populated   → wrapped Error reject
 *   - User cancels the Save-As dialog         → reject ('USER_CANCELED')
 *   - Quota / disk full / permission revoked  → reject
 *
 * All three resolve to `backup-failed` in the orchestrator, with the
 * detail string preserved for telemetry.
 */

import type { DiscardBackupArchive } from '@openheaders/core/sync';
import { setBackupWriter } from '@openheaders/oracle/sync';

/** Replace characters that aren't safe in a chrome.downloads filename. */
function safeTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

function archiveToDataUrl(archive: DiscardBackupArchive): string {
  const json = JSON.stringify(archive);
  // base64-encoding (via btoa) avoids `data:` URL escaping concerns for
  // characters like `#` that would otherwise break the parser. Safe for
  // any JSON the snapshot bodies could produce.
  return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
}

const swBackupWriter = (archive: DiscardBackupArchive): Promise<{ backupPath: string }> => {
  return new Promise((resolve, reject) => {
    const filename = `oh-backup-${safeTimestamp(archive.generatedAt)}.json`;
    try {
      chrome.downloads.download(
        {
          url: archiveToDataUrl(archive),
          filename,
          saveAs: false,
          conflictAction: 'uniquify',
        },
        (downloadId?: number) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reject(new Error(err.message ?? 'downloads.download rejected'));
            return;
          }
          if (typeof downloadId !== 'number') {
            reject(new Error('downloads.download returned no id'));
            return;
          }
          // chrome.downloads doesn't expose the resolved final path
          // synchronously — the renderer only needs a user-facing
          // string to quote in the toast, so the filename suffices.
          // The actual on-disk path is the downloads folder + this
          // filename (modulo uniquify suffixing on collision).
          resolve({ backupPath: filename });
        },
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};

let installed = false;

/**
 * Install the SW writer once at boot. Idempotent — calling more than
 * once is a no-op so background.ts can sequence this next to the other
 * oracle host hooks without ordering hazards.
 */
export function installBackupWriter(): void {
  if (installed) return;
  installed = true;
  setBackupWriter(swBackupWriter);
}

/** Test seam — drops the installed writer so tests start clean. */
export function __resetBackupWriterForTests(): void {
  installed = false;
  setBackupWriter(null);
}
