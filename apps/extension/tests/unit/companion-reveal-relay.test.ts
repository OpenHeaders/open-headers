/**
 * `companionReveal` — the SW relay behind the desktop teasers' "Open in
 * the desktop app": forwards the reveal target to the connected desktop
 * app as a peer RPC and hands its typed verdict back, folding transport
 * failures (no wire, timeout) to an honest `{ ok: false, reason }`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWsRequest } = vi.hoisted(() => ({
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@/background/ws-request', () => ({
  wsRequest: mockWsRequest,
}));

import { navigationHandlers } from '@/background/modules/message-handler/handlers/navigation';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

function invoke(target: unknown): ReturnType<typeof vi.fn> {
  const handler = navigationHandlers.companionReveal;
  const respond = vi.fn();
  handler({
    message: { type: 'companionReveal', target },
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

describe('companionReveal relay', () => {
  it('forwards the target as a peer RPC and answers the verdict', async () => {
    mockWsRequest.mockResolvedValueOnce({ ok: true });
    const respond = invoke('terminal');
    await expect(settled(respond)).resolves.toEqual({ ok: true });
    expect(mockWsRequest).toHaveBeenCalledWith({ type: 'companionReveal', target: 'terminal' });
  });

  it('passes the desktop plane refusal through verbatim', async () => {
    mockWsRequest.mockResolvedValueOnce({ ok: false, reason: 'Unknown reveal target.' });
    const respond = invoke('settings');
    await expect(settled(respond)).resolves.toEqual({ ok: false, reason: 'Unknown reveal target.' });
  });

  it('folds a transport failure to an honest refusal', async () => {
    mockWsRequest.mockRejectedValueOnce(new Error('not-connected'));
    const respond = invoke('terminal');
    await expect(settled(respond)).resolves.toEqual({ ok: false, reason: 'not-connected' });
  });
});
