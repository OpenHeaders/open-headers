/**
 * Trust anchors for one dial — the two trust scopes composed into the
 * single list a transport's `ca` option takes (the Trusted Roots plan):
 *
 *   - workspace: the trusted certificates the workspace the run
 *     resolved against holds (synced, exported, git-tracked);
 *   - device: the certificates THIS machine pins (host posture, never
 *     synced).
 *
 * Absent when both are empty or the run has no workspace and no pins,
 * so the transport's runtime-default trust path stays byte-identical.
 * The counts ride the run snapshot (`trustedRootsApplied` /
 * `deviceTrustApplied`) — attribution of what the dial trusted, never
 * the list itself. Every executor (HTTP, WS, gRPC, MQTT) reads through
 * here so no dial forks the composition.
 */

import { getDeviceTrustPems } from '../entity/device-trust-store';
import { getTrustedRootPemsForWorkspace } from '../entity/trusted-roots-store';

export interface TrustAnchors {
  /** Workspace roots first, device pins after — the `ca` order. */
  pems: string[];
  workspace: number;
  device: number;
}

export function getTrustAnchorsForSend(workspaceId: string | null): TrustAnchors | undefined {
  const workspace = workspaceId === null ? [] : getTrustedRootPemsForWorkspace(workspaceId);
  const device = getDeviceTrustPems();
  if (workspace.length === 0 && device.length === 0) return undefined;
  return { pems: [...workspace, ...device], workspace: workspace.length, device: device.length };
}
