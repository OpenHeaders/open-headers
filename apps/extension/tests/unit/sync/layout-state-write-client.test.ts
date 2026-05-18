/**
 * Renderer-side write client for layout-state mutations.
 *
 * Layout-state is a singleton entity (`LAYOUT_STATE_ID = 'layout-state'`)
 * holding a single opaque `layout` field. The renderer's responsive-
 * layout hook is the canonical caller; this helper just wraps the
 * setField envelope.
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  LAYOUT_STATE_PATH,
} from '@openheaders/core/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(() => () => undefined),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyLayoutSet } from '@openheaders/ui/shared/sync/layout-state-write-client';
import type { RendererContextHandle } from '@openheaders/ui/context';

function makeContextHandle(workspaceId = 'ws-1', surfaceId = 'workbench'): RendererContextHandle {
  let hlc = initialHlc(`${surfaceId}-test`, 0);
  return {
    nodeId: `${surfaceId}-test`,
    surfaceId,
    workspaceId,
    peekHlc: () => hlc,
    next: (opts = {}) => {
      hlc = advanceHlc(hlc, hlc.physicalMs + 1, opts.observed);
      const ctx: MutatorContext = {
        workspaceId,
        hlc,
        surfaceId: opts.surfaceId ?? surfaceId,
        deviceId: `${surfaceId}-test`,
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
      };
      return ctx;
    },
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyLayoutSet', () => {
  it('emits one setField envelope at the layout-state singleton', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const layout = { sidebarWidth: 240, panelOrder: ['rules', 'collections'] };
    const result = await applyLayoutSet(
      { layout },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: LAYOUT_STATE_ENTITY_TYPE,
      id: LAYOUT_STATE_ID,
      path: LAYOUT_STATE_PATH,
      value: layout,
    });
  });

  it('passes the opaque layout payload through verbatim (catalog does not validate the shape)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    // Catalog accepts an opaque blob; the renderer hook owns the shape.
    const layout: unknown = ['arbitrary', { shape: true }];
    await applyLayoutSet(
      { layout },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const value = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch.mutations[0].body as {
      value: unknown;
    };
    expect(value.value).toBe(layout);
  });
});
