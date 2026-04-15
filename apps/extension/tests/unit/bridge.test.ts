import { BridgeError, broadcast, call, presence, receive, subscribe, tabCall } from '@utils/bridge';
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

      await call('toggleRule', { ruleId: 'local-42', enabled: true });

      expect(sentMessage).toEqual({ type: 'toggleRule', ruleId: 'local-42', enabled: true });
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

      expect(() => broadcast('testRunDeleted', { runId: 'run-1' })).not.toThrow();
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
      const unsubscribe = subscribe('testRunDeleted', handler);

      const fakeSender = {} as chrome.runtime.MessageSender;
      const fakeSendResponse = (): void => undefined;
      const fire = (msg: unknown): void => {
        const listener = registeredListener as OnMessageListener | null;
        listener?.(msg, fakeSender, fakeSendResponse);
      };

      // Matching message
      fire({ type: 'testRunDeleted', runId: 'run-9' });
      expect(handler).toHaveBeenCalledWith({ type: 'testRunDeleted', runId: 'run-9' });

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

  describe('tabCall', () => {
    it('sends the typed message to the given tab and resolves with the response', async () => {
      let sentTabId: number | undefined;
      let sentMessage: unknown;
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(((
        tabId: number,
        message: unknown,
        callback: (response: unknown) => void,
      ) => {
        sentTabId = tabId;
        sentMessage = message;
        callback({ success: true });
      }) as typeof chrome.tabs.sendMessage);

      const response = await tabCall(42, 'recordingStateChanged', {
        state: 'recording',
        isRecording: true,
        isPreNav: false,
        recordingId: 'rec-7',
        startTime: 1000,
      });

      expect(sentTabId).toBe(42);
      expect(sentMessage).toEqual({
        type: 'recordingStateChanged',
        state: 'recording',
        isRecording: true,
        isPreNav: false,
        recordingId: 'rec-7',
        startTime: 1000,
      });
      expect(response).toEqual({ success: true });
    });

    it('supports zero-payload messages with no payload argument', async () => {
      let sentMessage: unknown;
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(((
        _tabId: number,
        message: unknown,
        callback: (response: unknown) => void,
      ) => {
        sentMessage = message;
        callback({ success: true });
      }) as typeof chrome.tabs.sendMessage);

      await tabCall(5, 'stopRecording');

      expect(sentMessage).toEqual({ type: 'stopRecording' });
    });

    it('rejects with BridgeError when lastError fires (no content script)', async () => {
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(((
        _tabId: number,
        _message: unknown,
        callback: (response: unknown) => void,
      ) => {
        setLastError({ message: 'Could not establish connection. Receiving end does not exist.' });
        callback(undefined);
        setLastError(null);
      }) as typeof chrome.tabs.sendMessage);

      const error = await tabCall(1, 'stopRecording').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BridgeError);
      expect((error as BridgeError).type).toBe('stopRecording');
      expect((error as BridgeError).message).toContain('Receiving end does not exist');
    });
  });

  describe('receive', () => {
    type OnMessageListener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | undefined;

    function captureListener(): () => OnMessageListener | null {
      let captured: OnMessageListener | null = null;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(((listener: OnMessageListener) => {
        captured = listener;
      }) as typeof chrome.runtime.onMessage.addListener);
      return () => captured;
    }

    it('responds synchronously and filters on message type', () => {
      const getListener = captureListener();
      const handler = vi.fn().mockReturnValue({ success: true });

      const unsubscribe = receive('stopRecording', handler);

      const listener = getListener() as OnMessageListener | null;
      if (!listener) throw new Error('receive did not register a listener');
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      // Matching message
      const result = listener({ type: 'stopRecording' }, sender, sendResponse);
      expect(handler).toHaveBeenCalledWith({ type: 'stopRecording' });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      // Sync handlers must return false so chrome closes the response channel.
      expect(result).toBe(false);

      // Non-matching type — the listener must not invoke the handler.
      handler.mockClear();
      sendResponse.mockClear();
      listener({ type: 'recordingStateChanged' }, sender, sendResponse);
      expect(handler).not.toHaveBeenCalled();
      expect(sendResponse).not.toHaveBeenCalled();

      // Non-object messages are ignored.
      listener(null, sender, sendResponse);
      listener('string', sender, sendResponse);
      expect(handler).not.toHaveBeenCalled();

      unsubscribe();
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });

    it('returns true and awaits the promise for async handlers', async () => {
      const getListener = captureListener();
      let resolveHandler: (value: { success: boolean }) => void = () => undefined;
      const handler = vi.fn(
        () =>
          new Promise<{ success: boolean }>((resolve) => {
            resolveHandler = resolve;
          }),
      );

      receive('recordingStateChanged', handler);

      const listener = getListener() as OnMessageListener | null;
      if (!listener) throw new Error('receive did not register a listener');
      const sendResponse = vi.fn();

      const result = listener(
        {
          type: 'recordingStateChanged',
          state: 'recording',
          isRecording: true,
          isPreNav: false,
        },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      // Async handlers MUST return true — required by the chrome onMessage
      // contract to keep the response channel open.
      expect(result).toBe(true);
      expect(sendResponse).not.toHaveBeenCalled();

      resolveHandler({ success: true });
      await Promise.resolve();
      await Promise.resolve();

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('responds with undefined when the handler throws', () => {
      const getListener = captureListener();
      const handler = vi.fn(() => {
        throw new Error('boom');
      });

      receive('stopRecording', handler);

      const listener = getListener() as OnMessageListener | null;
      if (!listener) throw new Error('receive did not register a listener');
      const sendResponse = vi.fn();

      listener({ type: 'stopRecording' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith(undefined);
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
