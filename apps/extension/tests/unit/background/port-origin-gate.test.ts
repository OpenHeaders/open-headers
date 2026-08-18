/**
 * Extension-origin gate shared by every `runtime.onConnect` accept
 * site: only ports opened by the extension's own pages attach; a port
 * dialed from a tab realm is dropped after its name matches.
 */

import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { describe, expect, it, vi } from 'vitest';
import { acceptPagePort } from '@/background/page-port-host/accept-port';
import { isExtensionOriginPort } from '@/background/port-origin-gate';

function port(name: string, senderUrl?: string): chrome.runtime.Port {
  return {
    name,
    ...(senderUrl !== undefined ? { sender: { url: senderUrl } } : {}),
    onMessage: { addListener: () => {} },
    onDisconnect: { addListener: () => {} },
    postMessage: () => {},
    disconnect: () => {},
  } as unknown as chrome.runtime.Port;
}

describe('isExtensionOriginPort', () => {
  it('accepts a port from an extension page', () => {
    expect(isExtensionOriginPort(port('oh-page:1', 'chrome-extension://test-id/panel.html'), 'Test')).toBe(true);
  });

  it('rejects a port from a web page realm', () => {
    expect(isExtensionOriginPort(port('oh-page:1', 'https://openheaders.io/'), 'Test')).toBe(false);
  });

  it('rejects a port with no sender url', () => {
    expect(isExtensionOriginPort(port('oh-page:1'), 'Test')).toBe(false);
  });
});

describe('accept sites honor the gate', () => {
  it('acceptPagePort refuses a tab-realm port with a valid name', () => {
    const hub = { attach: vi.fn() } as unknown as PageStreamHub;
    expect(acceptPagePort(hub, port('oh-page:3', 'https://openheaders.io/'))).toBe(false);
    expect(hub.attach).not.toHaveBeenCalled();
  });

  it('acceptPagePort attaches an extension-origin port', () => {
    const hub = { attach: vi.fn(() => ({ detach: () => {} })) } as unknown as PageStreamHub;
    expect(acceptPagePort(hub, port('oh-page:3', 'chrome-extension://test-id/panel.html'))).toBe(true);
    expect(hub.attach).toHaveBeenCalledTimes(1);
  });
});
