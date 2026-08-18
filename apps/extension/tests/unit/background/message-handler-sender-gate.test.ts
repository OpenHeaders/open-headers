/**
 * Sender-context gate on the SW message router: a message from outside
 * the extension origin (a tab realm) may only use the tab-originated
 * allowlist; every other RPC type is dropped before dispatch.
 */

import { describe, expect, it, vi } from 'vitest';
import { handleGeneralMessage } from '@/background/modules/message-handler';
import type { MessageHandlerContext } from '@/types/browser';

const ctx = {
  isWebSocketConnected: vi.fn(() => false),
  sendViaWebSocket: vi.fn(),
  scheduleUpdate: vi.fn(),
  revalidateTrackedRequests: vi.fn(),
  updateBadgeCallback: vi.fn(),
} as unknown as MessageHandlerContext;

function tabSender(url = 'https://openheaders.io/app'): chrome.runtime.MessageSender {
  return { url, tab: { id: 7 } as chrome.tabs.Tab };
}

function extensionSender(path = 'popup.html'): chrome.runtime.MessageSender {
  return { url: `chrome-extension://test-id/${path}` };
}

describe('handleGeneralMessage sender gate', () => {
  it('drops a non-allowlisted RPC from a tab realm without dispatching', () => {
    const respond = vi.fn();
    const result = handleGeneralMessage({ type: 'consoleEval', code: '1+1' }, tabSender(), respond, ctx);
    expect(result).toBe(false);
    expect(respond).not.toHaveBeenCalled();
  });

  it('drops a non-allowlisted RPC when the sender has no url at all', () => {
    const respond = vi.fn();
    const result = handleGeneralMessage(
      { type: 'consoleEval', code: '1+1' },
      { tab: { id: 7 } } as never,
      respond,
      ctx,
    );
    expect(result).toBe(false);
    expect(respond).not.toHaveBeenCalled();
  });

  it('lets a tab realm reach the tab-originated allowlist', () => {
    const respond = vi.fn();
    handleGeneralMessage({ type: 'getWorkspaceTabOrdinal' }, tabSender(), respond, ctx);
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ count: expect.any(Number) }));
  });

  it('lets extension-origin senders through untouched', () => {
    const respond = vi.fn();
    handleGeneralMessage({ type: 'getWorkspaceTabOrdinal' }, extensionSender(), respond, ctx);
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ ordinal: null }));
  });
});
