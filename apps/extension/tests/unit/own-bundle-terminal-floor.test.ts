/**
 * `own-bundle-terminal-floor` — tab-bound loads of the extension's own
 * packaged assets never receive completion events from webRequest, so the
 * floor synthesizes the browser's status-less "Finished" terminal at
 * `onSendHeaders`. Network URLs and other extensions' resources pass
 * untouched — their own completion (or the CDP plane) resolves them.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/browser-api.js', () => ({
  runtime: { getURL: (path: string): string => `chrome-extension://ohtestid/${path}` },
}));

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';
import { startOwnBundleTerminalFloor } from '@/background/correlator-host/own-bundle-terminal-floor';

const OWN_ORIGIN = 'chrome-extension://ohtestid';

function sendHeaders(url: string, requestId: string, atMs: number): WebRequestEvent {
  return {
    method_kind: 'onSendHeaders',
    tabId: 42,
    requestId,
    url,
    method: 'GET',
    type: 'script',
    initiator: OWN_ORIGIN,
    frameId: 0,
    timeStamp: atMs,
    requestHeaders: [{ name: 'Accept', value: '*/*' }],
  };
}

describe('startOwnBundleTerminalFloor', () => {
  function harness() {
    const listeners = new Set<(event: WebRequestEvent) => void>();
    const applied: RequestLifecycleUpdate[] = [];
    const floor = startOwnBundleTerminalFloor({
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      apply: (update) => applied.push(update),
    });
    const feed = (event: WebRequestEvent): void => {
      for (const listener of [...listeners]) listener(event);
    };
    return { applied, feed, floor, listeners };
  }

  it('floors an own-bundle load to a status-less terminal at onSendHeaders', () => {
    const { applied, feed } = harness();
    feed(sendHeaders(`${OWN_ORIGIN}/assets/editor.worker.js`, '501', 10_000));

    expect(applied).toEqual([
      {
        kind: 'phase',
        tabId: 42,
        requestId: '501',
        patch: { phase: 'completed', completedAtMs: 10_000 },
      },
    ]);
  });

  it('ignores network URLs and other extensions', () => {
    const { applied, feed } = harness();
    feed(sendHeaders('https://telemetry.openheaders.io/v1/events', '502', 20_000));
    feed(sendHeaders('chrome-extension://otherextension/asset.js', '503', 20_001));
    expect(applied).toEqual([]);
  });

  it('ignores non-send events for own-bundle URLs', () => {
    const { applied, feed } = harness();
    feed({
      method_kind: 'onBeforeRequest',
      tabId: 42,
      requestId: '504',
      url: `${OWN_ORIGIN}/assets/html.worker.js`,
      method: 'GET',
      type: 'script',
      initiator: OWN_ORIGIN,
      frameId: 0,
      timeStamp: 30_000,
    });
    expect(applied).toEqual([]);
  });

  it('dispose detaches the channel listener', () => {
    const { applied, feed, floor, listeners } = harness();
    floor.dispose();
    expect(listeners.size).toBe(0);
    feed(sendHeaders(`${OWN_ORIGIN}/assets/editor.worker.js`, '505', 40_000));
    expect(applied).toEqual([]);
  });
});
