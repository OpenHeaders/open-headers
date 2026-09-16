/**
 * The service worker's face of a page realm's delegated session: the
 * `delegatedSocketCall` handler forwards an OPEN or a rider on the
 * frame's EXPLICIT backend (never the default wire) and answers the
 * place's result or a structured failure; the relay claims the place's
 * `delegatedSocketEvent` frames off the wire and re-broadcasts them
 * for the page realm's delegating transport.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast, mockWsRequest } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@utils/bridge', () => ({ broadcast: mockBroadcast }));
vi.mock('@/background/ws-request', () => ({ wsRequest: mockWsRequest }));

import { handleIncomingDelegatedSocketFrame } from '@/background/delegated-socket-relay';
import { delegatedSocketHandlers } from '@/background/modules/message-handler/handlers/delegated-sockets';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

function invoke(type: string, extra: Record<string, unknown> = {}) {
  const handler = (delegatedSocketHandlers as Record<string, (args: HandlerArgs) => boolean | undefined>)[type];
  const respond = vi.fn();
  handler({
    message: { type, ...extra },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  return respond;
}

beforeEach(() => {
  mockBroadcast.mockReset();
  mockWsRequest.mockReset();
});

describe('delegatedSocketCall', () => {
  it("forwards the frame on the named backend and answers the place's result verbatim", async () => {
    const answer = { success: true, executedOn: { kind: 'backend', name: 'workbox' } };
    mockWsRequest.mockResolvedValue(answer);
    const frame = { type: 'delegateWsOpen', socketId: 's-1', workspaceId: 'ws-1', request: { url: 'wss://x' } };
    const respond = invoke('delegatedSocketCall', { backendId: 'backend-desktop', frame });
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(mockWsRequest).toHaveBeenCalledWith(frame, { backendId: 'backend-desktop', timeoutMs: 15_000 });
    expect(respond).toHaveBeenCalledWith(answer);
  });

  it('answers a structured failure without touching the wire for a call naming no backend or frame', () => {
    const respond = invoke('delegatedSocketCall', { frame: { type: 'delegateWsSend' } });
    expect(respond).toHaveBeenCalledWith({ success: false, error: 'No backend or frame provided' });
    const second = invoke('delegatedSocketCall', { backendId: 'b', frame: {} });
    expect(second).toHaveBeenCalledWith({ success: false, error: 'No backend or frame provided' });
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it("answers a dead wire or the place's refusal as a structured failure", async () => {
    mockWsRequest.mockRejectedValue(new Error('not-connected'));
    const respond = invoke('delegatedSocketCall', {
      backendId: 'b',
      frame: { type: 'delegateSocketAbort', socketId: 's' },
    });
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({ success: false, error: 'not-connected' });
  });
});

describe('the delegated socket relay', () => {
  const EVENT = { socketId: 's-1', seq: 0, kind: 'open', protocol: '', extensions: '' };

  it('claims a delegatedSocketEvent frame and re-broadcasts its payload', () => {
    expect(handleIncomingDelegatedSocketFrame({ type: 'delegatedSocketEvent', payload: EVENT })).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith('delegatedSocketEvent', EVENT);
  });

  it('leaves other frames to the next handler and drops a malformed one of its own', () => {
    expect(handleIncomingDelegatedSocketFrame({ type: 'requestStreamEvent', payload: EVENT })).toBe(false);
    expect(handleIncomingDelegatedSocketFrame(null)).toBe(false);
    expect(handleIncomingDelegatedSocketFrame({ type: 'delegatedSocketEvent', payload: { seq: 1 } })).toBe(true);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
