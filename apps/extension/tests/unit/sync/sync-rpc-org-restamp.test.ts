/**
 * Phase U2 audit (Session 22) regression — renderer-origin `oh.sync.apply`
 * batches are re-stamped with the host's authoritative `orgId`.
 *
 * The renderer mints envelopes through `createRendererContextHandle`,
 * which reads `resolveWorkspaceOrgId` — but the workspace→Org resolver is
 * installed only in the SW / desktop main, never in a renderer realm. A
 * renderer mint therefore always carries the `pre-bootstrap` sentinel,
 * which no authorized Org set contains, so without this re-stamp every
 * renderer-originated envelope would be dropped at the transport org
 * filter and never sync to a peer.
 */

import type { MutationBatch } from '@openheaders/core/sync';
import { PRE_BOOTSTRAP_ORG_ID, setWorkspaceOrgResolver } from '@openheaders/core/sync';
import { restampApplyOrgIds } from '@openheaders/oracle/rpc';
import { afterEach, describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const REAL_ORG = '0193a8ff-0000-7000-8000-0000000000aa';

function makeBatch(workspaceId: string, orgId: string): MutationBatch {
  return {
    batchId: '01900000-cccc-7000-8000-000000000001',
    mutations: [
      {
        mutationId: '01900000-dddd-7000-8000-000000000001',
        hlc: { physicalMs: 0, logical: 0, nodeId: 'dev' },
        origin: { surfaceId: 'workbench', deviceId: 'dev' },
        workspaceId,
        orgId,
        mutatorVersion: 1,
        body: { kind: 'create', type: 'workspaceVariables', id: 'e1', payload: {} },
      },
    ],
  };
}

describe('restampApplyOrgIds', () => {
  afterEach(() => {
    setWorkspaceOrgResolver(null);
  });

  it('re-stamps a renderer pre-bootstrap orgId from the host resolver', () => {
    setWorkspaceOrgResolver((id) => (id === WS ? REAL_ORG : undefined));
    const out = restampApplyOrgIds({
      type: 'oh.sync.apply',
      batch: makeBatch(WS, PRE_BOOTSTRAP_ORG_ID),
      sideEffects: [],
    });
    expect(out.batch.mutations[0].orgId).toBe(REAL_ORG);
  });

  it('overrides a stale renderer-supplied orgId with the host value', () => {
    // The renderer view is non-authoritative; the host resolver wins
    // even when the renderer happened to carry a non-sentinel value.
    setWorkspaceOrgResolver((id) => (id === WS ? REAL_ORG : undefined));
    const out = restampApplyOrgIds({
      type: 'oh.sync.apply',
      batch: makeBatch(WS, '0193a8ff-0000-7000-8000-0000000000bb'),
      sideEffects: [],
    });
    expect(out.batch.mutations[0].orgId).toBe(REAL_ORG);
  });

  it('falls back to the pre-bootstrap sentinel when no resolver is installed', () => {
    const out = restampApplyOrgIds({
      type: 'oh.sync.apply',
      batch: makeBatch(WS, PRE_BOOTSTRAP_ORG_ID),
      sideEffects: [],
    });
    expect(out.batch.mutations[0].orgId).toBe(PRE_BOOTSTRAP_ORG_ID);
  });

  it('returns an empty batch unchanged', () => {
    const request = { type: 'oh.sync.apply' as const, batch: { batchId: 'b', mutations: [] }, sideEffects: [] };
    expect(restampApplyOrgIds(request)).toBe(request);
  });
});
