/**
 * `ChromeBrowserTargetSource` — the targetId-keyed `chrome.debugger`
 * adapter for browser-scoped service-worker targets (JS contexts Phase B).
 *
 * Coverage:
 *   - discovery filter: `type: 'worker'` + `Service Worker` title prefix +
 *     http(s) URL; pages, dedicated workers, and extension workers drop;
 *   - attach handshake (`Runtime.enable` + `Log.enable` + `Network.enable`),
 *     idempotency, already-attached tolerance, real-failure rejection;
 *   - event routing: the three Runtime context events (incl. the no-params
 *     `executionContextsCleared`), console + exception + Log entries, all
 *     keyed `target:<id>`, plus the raw `Network.*` fan (SW-network Phase
 *     A); unattached targets and tab-session events drop;
 *   - teardown: our detach and the chrome-initiated one both fan
 *     `target-cleared` (contexts are live state, not history).
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BrowserTargetJsContextEvent,
  browserTargetSessionKey,
  ChromeBrowserTargetSource,
} from '@/background/correlator-host/browser-target-source';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

const TARGET = 'SW-TARGET-1';

function rawTarget(overrides: Partial<chrome.debugger.TargetInfo> = {}): chrome.debugger.TargetInfo {
  return {
    id: TARGET,
    type: 'worker',
    title: 'Service Worker https://app.openheaders.io/sw.js?v=1',
    url: 'https://app.openheaders.io/sw.js?v=1',
    attached: false,
    ...overrides,
  };
}

function rawContextCreated(id: number): object {
  return {
    context: { id, name: '', origin: 'https://app.openheaders.io/sw.js?v=1', uniqueId: 'u1' },
  };
}

function rawConsoleApiCalled(executionContextId: number): object {
  return {
    type: 'log',
    args: [{ type: 'string', value: 'sw says hi' }],
    executionContextId,
    timestamp: 1_700_000_000_000,
  };
}

describe('ChromeBrowserTargetSource', () => {
  let source: ChromeBrowserTargetSource;
  let contextEvents: BrowserTargetJsContextEvent[];
  let consoleEvents: Array<{ targetId: string; entry: ConsoleEntry }>;

  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.debugger.getTargets.mockResolvedValue([]);
    source = new ChromeBrowserTargetSource();
    contextEvents = [];
    consoleEvents = [];
    source.subscribeContexts((event) => contextEvents.push(event));
    source.subscribeConsole((targetId, entry) => consoleEvents.push({ targetId, entry }));
  });

  afterEach(() => {
    source.dispose();
  });

  describe('discovery', () => {
    it('keeps http(s) service-worker targets, mapping id + url', async () => {
      chromeMock.debugger.getTargets.mockResolvedValue([rawTarget()]);
      await expect(source.discoverServiceWorkers()).resolves.toEqual([
        { targetId: TARGET, url: 'https://app.openheaders.io/sw.js?v=1' },
      ]);
    });

    it('drops pages, dedicated workers, and extension service workers', async () => {
      chromeMock.debugger.getTargets.mockResolvedValue([
        rawTarget({ id: 'P', type: 'page', title: 'Some page', url: 'https://app.openheaders.io/' }),
        rawTarget({
          id: 'W',
          title: 'https://app.openheaders.io/worker.js',
          url: 'https://app.openheaders.io/worker.js',
        }),
        rawTarget({
          id: 'X',
          title: 'Service Worker chrome-extension://abc/js/background/index.js',
          url: 'chrome-extension://abc/js/background/index.js',
        }),
      ]);
      await expect(source.discoverServiceWorkers()).resolves.toEqual([]);
    });
  });

  describe('attach / detach', () => {
    it('attaches by targetId and enables Runtime + Log + Network', async () => {
      await source.attach(TARGET);
      expect(chromeMock.debugger.attach).toHaveBeenCalledWith({ targetId: TARGET }, '1.3');
      expect(chromeMock.debugger.sendCommand).toHaveBeenCalledWith({ targetId: TARGET }, 'Runtime.enable', undefined);
      expect(chromeMock.debugger.sendCommand).toHaveBeenCalledWith({ targetId: TARGET }, 'Log.enable', undefined);
      expect(chromeMock.debugger.sendCommand).toHaveBeenCalledWith({ targetId: TARGET }, 'Network.enable', {
        maxTotalBufferSize: 250 * 1024 * 1024,
        maxPostDataSize: 64 * 1024,
      });
    });

    it('is idempotent for a live target', async () => {
      await source.attach(TARGET);
      await source.attach(TARGET);
      expect(chromeMock.debugger.attach).toHaveBeenCalledTimes(1);
    });

    it('tolerates the already-attached race', async () => {
      chromeMock.debugger.attach.mockRejectedValueOnce(new Error('Another debugger is already attached'));
      await expect(source.attach(TARGET)).resolves.toBeUndefined();
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextCreated', rawContextCreated(1));
      expect(contextEvents).toHaveLength(1);
    });

    it('rejects on a real attach failure and stays unattached', async () => {
      chromeMock.debugger.attach.mockRejectedValueOnce(new Error('Cannot access this target'));
      await expect(source.attach(TARGET)).rejects.toThrow('Cannot access this target');
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextCreated', rawContextCreated(1));
      expect(contextEvents).toEqual([]);
    });

    it('detach fans target-cleared before the chrome handshake and tolerates not-attached', async () => {
      await source.attach(TARGET);
      chromeMock.debugger.detach.mockRejectedValueOnce(new Error('Debugger is not attached'));
      await source.detach(TARGET);
      expect(contextEvents).toEqual([{ kind: 'target-cleared', targetId: TARGET }]);
    });
  });

  describe('event routing', () => {
    beforeEach(async () => {
      await source.attach(TARGET);
    });

    it('routes executionContextCreated with target session key, service-worker kind, default main world', () => {
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextCreated', rawContextCreated(1));
      expect(contextEvents).toEqual([
        {
          kind: 'context-created',
          targetId: TARGET,
          context: {
            contextKey: `${browserTargetSessionKey(TARGET)}::1`,
            origin: 'https://app.openheaders.io/sw.js?v=1',
            name: '',
            isDefault: true,
            targetKind: 'service-worker',
            worldType: 'default',
          },
        },
      ]);
    });

    it('routes executionContextDestroyed to the minted context key', () => {
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextDestroyed', {
        executionContextId: 1,
      });
      expect(contextEvents).toEqual([
        { kind: 'context-destroyed', targetId: TARGET, contextKey: `${browserTargetSessionKey(TARGET)}::1` },
      ]);
    });

    it('routes the no-params executionContextsCleared as target-cleared', () => {
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextsCleared', undefined);
      expect(contextEvents).toEqual([{ kind: 'target-cleared', targetId: TARGET }]);
    });

    it('routes consoleAPICalled with the target-session context key', () => {
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.consoleAPICalled', rawConsoleApiCalled(1));
      expect(consoleEvents).toHaveLength(1);
      expect(consoleEvents[0].targetId).toBe(TARGET);
      expect(consoleEvents[0].entry.contextKey).toBe(`${browserTargetSessionKey(TARGET)}::1`);
      expect(consoleEvents[0].entry.args[0]).toMatchObject({ text: 'sw says hi' });
    });

    it('routes exceptionThrown and Log.entryAdded as console entries', () => {
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.exceptionThrown', {
        timestamp: 1_700_000_000_000,
        exceptionDetails: { text: 'Uncaught', lineNumber: 0, columnNumber: 0, executionContextId: 1 },
      });
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Log.entryAdded', {
        entry: { source: 'network', level: 'error', text: 'Failed to load', timestamp: 1_700_000_000_001 },
      });
      expect(consoleEvents).toHaveLength(2);
      expect(consoleEvents[0].entry.source).toBe('exception');
      expect(consoleEvents[1].entry.source).toBe('browser');
    });

    it('fans raw Network.* params target-keyed', () => {
      const networkEvents: Array<{ targetId: string; method: string; params: object }> = [];
      source.subscribeNetwork((targetId, method, params) => networkEvents.push({ targetId, method, params }));
      const params = { requestId: 'R1', timestamp: 100.0 };
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Network.loadingFinished', params);
      expect(networkEvents).toEqual([{ targetId: TARGET, method: 'Network.loadingFinished', params }]);
    });

    it('drops events from unattached targets and from tab sessions', () => {
      const networkEvents: object[] = [];
      source.subscribeNetwork((_targetId, _method, params) => networkEvents.push(params));
      chromeMock.debugger.emitEvent({ targetId: 'OTHER' }, 'Runtime.executionContextCreated', rawContextCreated(1));
      chromeMock.debugger.emitEvent(
        { tabId: 7, targetId: TARGET },
        'Runtime.executionContextCreated',
        rawContextCreated(1),
      );
      chromeMock.debugger.emitEvent({ tabId: 7 }, 'Runtime.executionContextCreated', rawContextCreated(1));
      chromeMock.debugger.emitEvent({ targetId: 'OTHER' }, 'Network.loadingFinished', { requestId: 'R1' });
      chromeMock.debugger.emitEvent({ tabId: 7, targetId: TARGET }, 'Network.loadingFinished', { requestId: 'R1' });
      expect(contextEvents).toEqual([]);
      expect(networkEvents).toEqual([]);
    });
  });

  describe('chrome-initiated detach', () => {
    it('fans target-cleared and notifies detach listeners', async () => {
      await source.attach(TARGET);
      const detaches: Array<{ targetId: string; reason: string }> = [];
      source.onDetach((targetId, reason) => detaches.push({ targetId, reason }));
      chromeMock.debugger.emitDetach({ targetId: TARGET }, 'target_closed');
      expect(contextEvents).toEqual([{ kind: 'target-cleared', targetId: TARGET }]);
      expect(detaches).toEqual([{ targetId: TARGET, reason: 'target_closed' }]);
      chromeMock.debugger.emitEvent({ targetId: TARGET }, 'Runtime.executionContextCreated', rawContextCreated(1));
      expect(contextEvents).toHaveLength(1);
    });

    it('ignores detaches for targets we never attached', () => {
      const detaches: string[] = [];
      source.onDetach((targetId) => detaches.push(targetId));
      chromeMock.debugger.emitDetach({ targetId: 'OTHER' }, 'target_closed');
      chromeMock.debugger.emitDetach({ tabId: 7 }, 'target_closed');
      expect(detaches).toEqual([]);
      expect(contextEvents).toEqual([]);
    });
  });
});
