/**
 * Mode-switch Discard (M5) — renderer-side bridge wrapper.
 *
 * Symmetric mirror of {@link executeCoexist} / {@link executeImport}.
 * Fires `oh.sync.executeDiscardWithBackup` on the host bridge and
 * surfaces the {@link DiscardResult} verbatim; transport errors are
 * folded into `{ ok: false, reason: 'backup-writer-unavailable' }` so
 * the dialog dispatcher has one branch per outcome — a missing writer
 * and an IPC hiccup both prevent any data loss, so collapsing them at
 * the renderer keeps the failure surface narrow.
 *
 * The orchestration (collect → write archive → delete workspaces) lives
 * entirely on the host — the renderer just kicks it off and hands the
 * result to the UI dispatcher.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { DiscardResult } from '@openheaders/core/sync';

export interface ExecuteDiscardDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeDiscardWithBackup')`.
   * Override only in tests.
   */
  readonly bridgeCall?: () => Promise<DiscardResult>;
}

export async function executeDiscard(deps: ExecuteDiscardDeps = {}): Promise<DiscardResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call();
  } catch (err) {
    return {
      ok: false,
      reason: 'backup-writer-unavailable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(): Promise<DiscardResult> {
  return hostBridge.call('oh.sync.executeDiscardWithBackup');
}
