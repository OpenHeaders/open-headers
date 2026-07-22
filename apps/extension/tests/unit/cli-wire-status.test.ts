/**
 * `getCliWireStatus` — the SW relay behind the Add-ons CLI row's honest
 * state: forwards the read-only `getCliStatusSummary` peer verb over
 * the backend wire and folds every failure shape (no wire, an older
 * desktop without the verb, a timeout, a shapeless answer) to
 * `state: null` so the surface falls back to the pointer copy.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWsRequest } = vi.hoisted(() => ({
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@/background/ws-request', () => ({
  wsRequest: mockWsRequest,
}));

import { observabilityHandlers } from '@/background/modules/message-handler/handlers/observability';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

function invoke(type: string): ReturnType<typeof vi.fn> {
  const handler = observabilityHandlers[type];
  const respond = vi.fn();
  handler({
    message: { type },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  return respond;
}

async function settled(respond: ReturnType<typeof vi.fn>): Promise<unknown> {
  await vi.waitFor(() => expect(respond).toHaveBeenCalled());
  return respond.mock.calls[0][0];
}

beforeEach(() => {
  mockWsRequest.mockReset();
});

describe('getCliWireStatus', () => {
  it('relays the wire verb and answers the coarse state', async () => {
    mockWsRequest.mockResolvedValueOnce({ state: 'configured' });
    const respond = invoke('getCliWireStatus');
    await expect(settled(respond)).resolves.toEqual({ state: 'configured' });
    expect(mockWsRequest).toHaveBeenCalledWith({ type: 'getCliStatusSummary' }, { timeoutMs: 3_000 });
  });

  it('answers state: null when the wire rejects (not connected / timeout)', async () => {
    mockWsRequest.mockRejectedValueOnce(new Error('not-connected'));
    const respond = invoke('getCliWireStatus');
    await expect(settled(respond)).resolves.toEqual({ state: null });
  });

  it('answers state: null on a shapeless payload', async () => {
    mockWsRequest.mockResolvedValueOnce(undefined);
    const respond = invoke('getCliWireStatus');
    await expect(settled(respond)).resolves.toEqual({ state: null });
  });
});
