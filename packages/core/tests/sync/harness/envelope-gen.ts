/**
 * Envelope construction helpers for the property-test harness. The
 * generators mint distinct nodeIds and well-spaced HLCs — the
 * convergence invariant doesn't care, but distinct HLCs make
 * failures easier to diagnose.
 */

import type { HLC, MutationBody, MutationEnvelope } from '../../../src/sync';

export interface MintArgs {
  workspaceId: string;
  orgId?: string;
  surfaceId?: string;
  deviceId?: string;
  hlc: HLC;
  body: MutationBody;
  mutationId: string;
}

/** Deterministic synthetic-org UUIDv7 used as the default in harness envelopes. */
export const TEST_ORG_ID = '01890000-0000-7000-8000-000000000000';

export function mintEnvelope(args: MintArgs): MutationEnvelope {
  return {
    mutationId: args.mutationId,
    hlc: args.hlc,
    origin: {
      surfaceId: args.surfaceId ?? `surface-${args.hlc.nodeId}`,
      deviceId: args.deviceId ?? args.hlc.nodeId,
    },
    workspaceId: args.workspaceId,
    orgId: args.orgId ?? TEST_ORG_ID,
    mutatorVersion: 1,
    body: args.body,
  };
}

export const hlcAt = (physicalMs: number, logical: number, nodeId: string): HLC => ({
  physicalMs,
  logical,
  nodeId,
});
