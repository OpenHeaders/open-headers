/**
 * Mode-switch Use-Target (Phase U5.4) — renderer-side bridge wrapper.
 *
 * Fires `oh.sync.executeUseTarget` on the host bridge and surfaces the
 * {@link DiscardResult} verbatim. Use-Target retires this device's own
 * workspaces — exports them to a local backup, then deletes them — so
 * the user works purely against the joined backend's data; workspaces
 * already synced down from the target are kept.
 *
 * Mechanically a Discard scoped to the non-target-`Org` subset, so it
 * reuses the {@link DiscardResult} contract. Transport errors fold into
 * `{ ok: false, reason: 'backup-failed' }` — the "stopped before any
 * delete, your data is intact" status.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { DiscardResult } from '@openheaders/core/sync';

/** Carries the joined target `Org` whose workspaces are kept (not retired). */
export interface ExecuteUseTargetInput {
  readonly targetOrgId: string;
}

export interface ExecuteUseTargetDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeUseTarget', input)`.
   * Override only in tests.
   */
  readonly bridgeCall?: (input: ExecuteUseTargetInput) => Promise<DiscardResult>;
}

export async function executeUseTarget(
  input: ExecuteUseTargetInput,
  deps: ExecuteUseTargetDeps = {},
): Promise<DiscardResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call(input);
  } catch (err) {
    return {
      ok: false,
      reason: 'backup-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(input: ExecuteUseTargetInput): Promise<DiscardResult> {
  return hostBridge.call('oh.sync.executeUseTarget', input);
}
