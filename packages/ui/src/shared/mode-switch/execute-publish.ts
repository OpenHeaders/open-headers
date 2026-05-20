/**
 * Mode-switch Publish (Phase U5.6) — renderer-side bridge wrapper.
 *
 * Fires `oh.sync.publishWorkspace` on the host bridge and surfaces the
 * {@link PublishResult} verbatim. Publish is a local-only operation —
 * the host re-homes ONE workspace into an authenticated backend's `Org`
 * by flipping its `Workspace.orgId`; nothing crosses the wire from
 * here. It is the deliberate, permission-gated opt-in for pushing a
 * workspace's data UP to a LAN / WAN backend.
 *
 * Transport errors fold into `{ ok: false, reason: 'rehome-failed' }`
 * so the caller has one branch per outcome — a bridge hiccup and a
 * mid-run flip rejection are both "the workspace may not have moved;
 * retry," which `rehome-failed` already means.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { PublishResult } from '@openheaders/core/sync';

/** Carries the workspace + the authenticated target `Org` to publish into. */
export interface ExecutePublishInput {
  readonly workspaceId: string;
  readonly targetOrgId: string;
}

export interface ExecutePublishDeps {
  /**
   * Default is `hostBridge.call('oh.sync.publishWorkspace', input)`.
   * Override only in tests.
   */
  readonly bridgeCall?: (input: ExecutePublishInput) => Promise<PublishResult>;
}

export async function executePublish(
  input: ExecutePublishInput,
  deps: ExecutePublishDeps = {},
): Promise<PublishResult> {
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

async function defaultBridgeCall(input: ExecutePublishInput): Promise<PublishResult> {
  return hostBridge.call('oh.sync.publishWorkspace', input);
}
