/**
 * Mode-switch Import (M4) — renderer-side bridge wrapper.
 *
 * Symmetric mirror of {@link executeCoexist}. Fires
 * `oh.sync.executeImportToPeer` on the host bridge and surfaces the
 * {@link ImportResult} verbatim; transport errors are folded into a
 * structured `{ ok: false, reason: 'peer-write-unavailable' }` so the
 * dialog dispatcher has one branch per outcome.
 *
 * The orchestration (local collection + peer push) lives entirely on
 * the host — the renderer just kicks it off and hands the result to the
 * UI dispatcher.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { ImportResult } from '@openheaders/core/sync';

export interface ExecuteImportDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeImportToPeer')`. Override
   * only in tests.
   */
  readonly bridgeCall?: () => Promise<ImportResult>;
}

export async function executeImport(deps: ExecuteImportDeps = {}): Promise<ImportResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call();
  } catch (err) {
    return {
      ok: false,
      reason: 'peer-write-unavailable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(): Promise<ImportResult> {
  return hostBridge.call('oh.sync.executeImportToPeer');
}
