/**
 * Phase A Fw9 — renderer-side mutator-context factory.
 *
 * Mirrors sw-context.ts: per-surface nodeId, monotonic HLC, batchId
 * passthrough, observed-HLC ratchet.
 */

import { compareHlc } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import {
  createRendererContextHandle,
  ensureRendererContext,
  getActiveRendererContext,
  setActiveRendererContext,
} from '@/context/renderer-mutator-context';

describe('rule mutator context (renderer)', () => {
  it('mints monotonically advancing HLCs', () => {
    const h = createRendererContextHandle({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    const a = h.next();
    const b = h.next();
    expect(compareHlc(b.hlc, a.hlc)).toBeGreaterThan(0);
    expect(a.deviceId).toBe(h.nodeId);
    expect(a.surfaceId).toBe('workbench');
    expect(a.workspaceId).toBe('ws-1');
  });

  it('passes through batchId and surfaceId override', () => {
    const h = createRendererContextHandle({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    const ctx = h.next({ batchId: 'B1', surfaceId: 'inline' });
    expect(ctx.batchId).toBe('B1');
    expect(ctx.surfaceId).toBe('inline');
  });

  it('ratchets past an observed HLC', () => {
    const h = createRendererContextHandle({ workspaceId: 'ws-1', surfaceId: 'popup' });
    const future = { physicalMs: Date.now() + 60_000, logical: 0, nodeId: 'remote' };
    const ctx = h.next({ observed: future });
    expect(compareHlc(ctx.hlc, future)).toBeGreaterThan(0);
  });

  it('ensureRendererContext is idempotent for the same workspace/surface', () => {
    setActiveRendererContext(null);
    const a = ensureRendererContext({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    const b = ensureRendererContext({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    expect(a).toBe(b);
    expect(getActiveRendererContext()).toBe(a);
    const c = ensureRendererContext({ workspaceId: 'ws-2', surfaceId: 'workbench' });
    expect(c).not.toBe(a);
  });

  it('different surfaces mint distinct nodeIds', () => {
    const a = createRendererContextHandle({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    const b = createRendererContextHandle({ workspaceId: 'ws-1', surfaceId: 'popup' });
    expect(a.nodeId).not.toBe(b.nodeId);
    expect(a.nodeId.startsWith('workbench-')).toBe(true);
    expect(b.nodeId.startsWith('popup-')).toBe(true);
  });
});
