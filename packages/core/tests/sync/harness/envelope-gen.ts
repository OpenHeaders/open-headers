/**
 * Envelope construction helpers for the property-test harness. The
 * generators mint distinct nodeIds and well-spaced HLCs — the
 * convergence invariant doesn't care, but distinct HLCs make
 * failures easier to diagnose.
 */

import type { HLC, MutationBody, MutationEnvelope } from '../../../src/sync';

export interface MintArgs {
  workspaceId: string;
  surfaceId?: string;
  deviceId?: string;
  hlc: HLC;
  body: MutationBody;
  mutationId: string;
}

export function mintEnvelope(args: MintArgs): MutationEnvelope {
  return {
    mutationId: args.mutationId,
    hlc: args.hlc,
    origin: {
      surfaceId: args.surfaceId ?? `surface-${args.hlc.nodeId}`,
      deviceId: args.deviceId ?? args.hlc.nodeId,
    },
    workspaceId: args.workspaceId,
    mutatorVersion: 1,
    body: args.body,
  };
}

export const hlcAt = (physicalMs: number, logical: number, nodeId: string): HLC => ({
  physicalMs,
  logical,
  nodeId,
});
