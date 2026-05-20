/**
 * Mode-switch Combine (Phase U5.3) — renderer-side bridge wrapper.
 *
 * Fires `oh.sync.executeCombine` on the host bridge and surfaces the
 * {@link CombineResult} verbatim. Combine is a local-only operation —
 * the host re-homes this device's workspaces into the target `Org` by
 * flipping each `Workspace.orgId`; nothing crosses the wire from here.
 *
 * Transport errors fold into `{ ok: false, reason: 'rehome-failed' }`
 * so the dialog dispatcher has one branch per outcome — a bridge hiccup
 * and a mid-run flip rejection are both "your workspaces may be partly
 * moved; retry," which `rehome-failed` already means.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { CombineResult } from '@openheaders/core/sync';

/** Carries the joined target `Org` the host re-homes workspaces into. */
export interface ExecuteCombineInput {
  readonly targetOrgId: string;
}

export interface ExecuteCombineDeps {
  /**
   * Default is `hostBridge.call('oh.sync.executeCombine', input)`.
   * Override only in tests.
   */
  readonly bridgeCall?: (input: ExecuteCombineInput) => Promise<CombineResult>;
}

export async function executeCombine(
  input: ExecuteCombineInput,
  deps: ExecuteCombineDeps = {},
): Promise<CombineResult> {
  const call = deps.bridgeCall ?? defaultBridgeCall;
  try {
    return await call(input);
  } catch (err) {
    return {
      ok: false,
      reason: 'rehome-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function defaultBridgeCall(input: ExecuteCombineInput): Promise<CombineResult> {
  return hostBridge.call('oh.sync.executeCombine', input);
}
