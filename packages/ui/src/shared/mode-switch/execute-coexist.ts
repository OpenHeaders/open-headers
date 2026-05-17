/**
 * Mode-switch Coexist (M3) — renderer-side bridge wrapper.
 *
 * Single-purpose helper that fires `oh.sync.executeCoexistToPeer` on the
 * host bridge and surfaces the {@link CoexistResult} verbatim. The
 * orchestration (local collection + peer push) lives entirely on the
 * host; the renderer just kicks it off and hands the result to the UI
 * dispatcher. Wrapping the call in this thin shim:
 *
 *   1. Centralizes the failure-shape contract — wire transport errors
 *      arrive as Promise rejections from `hostBridge.call`; this helper
 *      catches them and folds into `{ ok: false, reason:
 *      'peer-write-unavailable' }` so the dialog dispatcher has one
 *      branch per outcome instead of two (typed result vs. throw).
 *   2. Provides a deterministic test seam — tests inject a stub
 *      `bridgeCall` instead of mocking the global `hostBridge` module.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { CoexistResult } from '@openheaders/core/sync';

export interface ExecuteCoexistDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeCoexistToPeer')`. Override
   * only in tests.
   */
  readonly bridgeCall?: () => Promise<CoexistResult>;
}

/**
 * Fire the source-side orchestrator and normalize every failure shape
 * the bridge can produce into a {@link CoexistResult} `ok: false` row.
 */
export async function executeCoexist(deps: ExecuteCoexistDeps = {}): Promise<CoexistResult> {
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

async function defaultBridgeCall(): Promise<CoexistResult> {
  return hostBridge.call('oh.sync.executeCoexistToPeer');
}
