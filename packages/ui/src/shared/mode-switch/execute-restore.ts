/**
 * Mode-switch Restore (M6) — renderer-side bridge wrapper.
 *
 * Inverse of {@link executeDiscard}: ships a parsed
 * {@link DiscardBackupArchive} on the local `oh.sync.applyDiscardRestore`
 * channel and surfaces the {@link RestoreResult} verbatim. Transport
 * errors are folded into `{ ok: false, reason: 'apply-failed' }` so the
 * caller has one branch per outcome — an IPC hiccup and a downstream
 * mutator rejection are both "the seed didn't land", and collapsing
 * them at the renderer keeps the failure surface narrow.
 *
 * The renderer reads + parses + shape-validates the file before calling
 * here ({@link isDiscardBackupArchiveShape}); the oracle revalidates
 * defensively before mounting. Both checks are cheap structural guards
 * — per-entity validation happens inside the snapshot applier.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { DiscardBackupArchive, RestoreResult } from '@openheaders/core/sync';

export interface ExecuteRestoreDeps {
  /** The archive the user picked from disk and the renderer already parsed + shape-validated. */
  readonly archive: DiscardBackupArchive;
  /**
   * Default is `hostBridge.call('oh.sync.applyDiscardRestore', archive)`.
   * Override only in tests.
   */
  readonly bridgeCall?: (archive: DiscardBackupArchive) => Promise<RestoreResult>;
}

export async function executeRestore(deps: ExecuteRestoreDeps): Promise<RestoreResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call(deps.archive);
  } catch (err) {
    return {
      ok: false,
      reason: 'apply-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(archive: DiscardBackupArchive): Promise<RestoreResult> {
  return hostBridge.call('oh.sync.applyDiscardRestore', archive);
}
