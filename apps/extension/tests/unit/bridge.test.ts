import { BridgeError, broadcast, call, presence, subscribe } from '@utils/bridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function setLastError(err: { message?: string } | null): void {
  Object.defineProperty(chrome.runtime, 'lastError', {
    value: err,
    writable: true,
    configurable: true,
  });
}

describe('bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLastError(null);
  });

  describe('call', () => {
    it('resolves with the typed response for no-argument RPCs', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((_message, callback) => {
        (callback as (response: { rules: []; isConnected: boolean }) => void)({
          rules: [],
          isConnected: true,
        });
      });

      const response = await call('getRules');

      expect(response.isConnected).toBe(true);
      expect(response.rules).toEqual([]);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getRules' }, expect.any(Function));
    });

    it('merges payload with the type field', async () => {
      let sentMessage: unknown;
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((message, callback) => {
        sentMessage = message;
        (callback as (response: { success: boolean }) => void)({ success: true });
      });

      await call('deleteRule', { ruleId: 'local-42' });

      expect(sentMessage).toEqual({ type: 'deleteRule', ruleId: 'local-42' });
    });

    it('rejects with BridgeError when lastError is set', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((_message, callback) => {
        setLastError({ message: 'No receiving end' });
        (callback as (response: unknown) => void)(undefined);
        setLastError(null);
      });

      const error = await call('getRules').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BridgeError);
      expect((error as BridgeError).type).toBe('getRules');
      expect((error as BridgeError).message).toContain('No receiving end');
    });

    it('rejects with BridgeError when no handler answers (undefined response, no lastError)', async () => {
      // Firefox resolves an unhandled sendMessage with undefined instead
      // of setting lastError — the bridge must still reject.
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((_message, callback) => {
        (callback as (response: unknown) => void)(undefined);
      });

      const error = await call('getRules').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BridgeError);
      expect((error as BridgeError).type).toBe('getRules');
      expect((error as BridgeError).message).toContain('no response');
    });

    it('rejects with "unknown error" when lastError has no message', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation((_message, callback) => {
        setLastError({});
        (callback as (response: unknown) => void)(undefined);
        setLastError(null);
      });

      const error = await call('getRules').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BridgeError);
      expect((error as BridgeError).message).toContain('unknown error');
    });
  });

  describe('broadcast', () => {
    it('sends a fire-and-forget message', () => {
      broadcast('rulesUpdated', { rules: [], timestamp: 123 });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'rulesUpdated',
        rules: [],
        timestamp: 123,
      });
    });

    it('swallows "no receivers" errors silently', () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(() => {
        throw new Error('Could not establish connection');
      });

      expect(() => broadcast('connectionStatus', { connected: true })).not.toThrow();
    });

    it('swallows Firefox-style Promise rejection', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        () => Promise.reject(new Error('No receiver')) as unknown as undefined,
      );

      expect(() => broadcast('connectionStatus', { connected: false })).not.toThrow();
      // Give the microtask queue a chance to run the rejection handler attached
      // inside broadcast — if it wasn't attached, Node would log an
      // unhandled-rejection warning.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe('subscribe', () => {
    type OnMessageListener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | undefined;

    it('filters messages by type and unwraps the payload', () => {
      let registeredListener: OnMessageListener | null = null;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(((listener: OnMessageListener) => {
        registeredListener = listener;
      }) as typeof chrome.runtime.onMessage.addListener);

      const handler = vi.fn();
      const unsubscribe = subscribe('storageInvalidated', handler);

      const fakeSender = {} as chrome.runtime.MessageSender;
      const fakeSendResponse = (): void => undefined;
      const fire = (msg: unknown): void => {
        const listener = registeredListener as OnMessageListener | null;
        listener?.(msg, fakeSender, fakeSendResponse);
      };

      // Matching message
      fire({ type: 'storageInvalidated', tabId: 9, kind: 'indexeddb' });
      expect(handler).toHaveBeenCalledWith({ type: 'storageInvalidated', tabId: 9, kind: 'indexeddb' });

      // Non-matching message (different type)
      handler.mockClear();
      fire({ type: 'rulesUpdated', rules: [] });
      expect(handler).not.toHaveBeenCalled();

      // Non-object messages
      fire(null);
      fire('string');
      expect(handler).not.toHaveBeenCalled();

      unsubscribe();
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });
  });

  describe('presence', () => {
    it('opens a port and returns a disposer that disconnects', () => {
      const disconnect = vi.fn();
      const port = {
        name: 'popup',
        disconnect,
        onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        postMessage: vi.fn(),
      };
      vi.mocked(chrome.runtime.connect).mockReturnValue(port as unknown as chrome.runtime.Port);

      const dispose = presence('popup');

      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'popup' });
      expect(port.onDisconnect.addListener).toHaveBeenCalled();

      dispose();
      expect(disconnect).toHaveBeenCalled();

      // Calling dispose twice is a no-op.
      dispose();
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('returns a disposer even when connect throws', () => {
      vi.mocked(chrome.runtime.connect).mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      const dispose = presence('popup');
      expect(typeof dispose).toBe('function');
      expect(() => dispose()).not.toThrow();
    });
  });
});
