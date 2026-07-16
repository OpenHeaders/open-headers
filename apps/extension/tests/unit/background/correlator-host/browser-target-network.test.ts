/**
 * `startBrowserTargetNetwork` — the SW-network Phase A plane: a dedicated
 * `CdpCorrelator` instance over the browser-target source's raw `Network.*`
 * seam, presented once per owner tab on the `target:<id>` synthetic session.
 *
 * Coverage:
 *   - per-owner presentation: one raw event → one row per owner tab, store
 *     ids `target:<targetId>::<rawRequestId>`;
 *   - ownerless events drop; a late-joining owner gets no backfill;
 *   - ownership deltas drive the correlator's attach set, refcounted across
 *     targets (detach only on leaving the LAST owner-set);
 *   - body pulls parse the targetId from the session key and ride
 *     `sendOnTarget` (`getResponseBody` finished / `streamResourceContent`
 *     in-flight); an unknown id on an attached tab emits the EMPTY body —
 *     the clobber trap the composite router exists for;
 *   - `createBodyFetchRouter` dispatches each request to exactly one plane;
 *   - dispose stops the fan.
 */

import { describe, expect, it, vi } from 'vitest';

import type { BrowserTargetOwnersListener } from '@/background/correlator-host/browser-target-attach-controller';
import {
  type BodyFetcherLeg,
  createBodyFetchRouter,
  startBrowserTargetNetwork,
} from '@/background/correlator-host/browser-target-network';
import { browserTargetSessionKey } from '@/background/correlator-host/browser-target-source';

const TARGET = 'SW-TARGET-1';
const OTHER_TARGET = 'SW-TARGET-2';
const TAB = 5;
const OTHER_TAB = 6;

function rawRequestWillBeSent(requestId: string): object {
  return {
    requestId,
    loaderId: '',
    documentURL: 'https://app.openheaders.io/sw.js?v=1',
    request: { url: 'https://api.openheaders.io/data.json', method: 'GET', headers: { accept: '*/*' } },
    timestamp: 100.0,
    wallTime: 1_700_000_000,
    type: 'Fetch',
  };
}

function rawResponseReceived(requestId: string): object {
  return {
    requestId,
    timestamp: 100.2,
    type: 'Fetch',
    response: {
      url: 'https://api.openheaders.io/data.json',
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      mimeType: 'application/json',
    },
  };
}

function rawLoadingFinished(requestId: string): object {
  return { requestId, timestamp: 100.4, encodedDataLength: 512 };
}

function makeRig() {
  let networkListener: (targetId: string, method: string, params: object) => void = () => {};
  let ownersListener: BrowserTargetOwnersListener = () => {};
  const owners = new Map<string, number[]>();
  const sendOnTarget = vi.fn().mockResolvedValue({ body: '{"ok":true}', base64Encoded: false });
  const apply = vi.fn();
  const plane = startBrowserTargetNetwork({
    source: {
      subscribeNetwork(listener) {
        networkListener = listener;
        return () => {};
      },
      sendOnTarget,
    },
    controller: {
      ownersOf: (targetId) => owners.get(targetId) ?? [],
      onOwnersChanged(listener) {
        ownersListener = listener;
        return () => {};
      },
    },
    apply,
  });
  const commitOwners = (targetId: string, next: number[]): void => {
    const prev = owners.get(targetId) ?? [];
    const added = next.filter((tabId) => !prev.includes(tabId));
    const removed = prev.filter((tabId) => !next.includes(tabId));
    owners.set(targetId, next);
    ownersListener(targetId, added, removed);
  };
  return {
    plane,
    apply,
    sendOnTarget,
    commitOwners,
    emitNetwork: (targetId: string, method: string, params: object) => networkListener(targetId, method, params),
  };
}

function storeId(targetId: string, rawRequestId: string): string {
  return `${browserTargetSessionKey(targetId)}::${rawRequestId}`;
}

describe('startBrowserTargetNetwork', () => {
  it('presents one raw event per owner tab, store ids target-namespaced', () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB, OTHER_TAB]);
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    const started = rig.apply.mock.calls.map(([update]) => update).filter((update) => update.kind === 'started');
    expect(started.map((update) => update.lifecycle.tabId)).toEqual([TAB, OTHER_TAB]);
    for (const update of started) {
      expect(update.lifecycle.requestId).toBe(storeId(TARGET, 'R1'));
      expect(update.lifecycle.url).toBe('https://api.openheaders.io/data.json');
      expect(update.lifecycle.issuedByWorker).toBe('service-worker');
    }
  });

  it('drops events for an ownerless target and unconsumed Network methods', () => {
    const rig = makeRig();
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    rig.commitOwners(TARGET, [TAB]);
    rig.emitNetwork(TARGET, 'Network.resourceChangedPriority', { requestId: 'R1', newPriority: 'High' });
    expect(rig.apply).not.toHaveBeenCalled();
  });

  it('gives a late-joining owner no backfill of rows already minted', () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB]);
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    rig.commitOwners(TARGET, [TAB, OTHER_TAB]);
    const started = rig.apply.mock.calls.map(([update]) => update).filter((update) => update.kind === 'started');
    expect(started).toHaveLength(1);
    expect(started[0].lifecycle.tabId).toBe(TAB);
  });

  it('detaches a tab only when it leaves its last owner-set', () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB]);
    rig.commitOwners(OTHER_TARGET, [TAB]);
    rig.commitOwners(TARGET, []);
    // Still owning OTHER_TARGET — its stream keeps flowing.
    rig.emitNetwork(OTHER_TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R2'));
    expect(rig.apply).toHaveBeenCalled();
    rig.apply.mockClear();
    rig.commitOwners(OTHER_TARGET, []);
    rig.emitNetwork(OTHER_TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R3'));
    expect(rig.apply).not.toHaveBeenCalled();
  });

  it('fetches a finished body over sendOnTarget with the parsed targetId', async () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB]);
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    rig.emitNetwork(TARGET, 'Network.responseReceived', rawResponseReceived('R1'));
    rig.emitNetwork(TARGET, 'Network.loadingFinished', rawLoadingFinished('R1'));
    await rig.plane.requestBody(TAB, storeId(TARGET, 'R1'), 0);
    expect(rig.sendOnTarget).toHaveBeenCalledWith(TARGET, 'Network.getResponseBody', { requestId: 'R1' });
    const attached = rig.apply.mock.calls.map(([update]) => update).find((update) => update.kind === 'body-attached');
    expect(attached).toMatchObject({
      tabId: TAB,
      requestId: storeId(TARGET, 'R1'),
      hopIndex: 0,
      body: { content: '{"ok":true}', encoding: '' },
    });
  });

  it('streams an in-flight body via streamResourceContent', async () => {
    const rig = makeRig();
    rig.sendOnTarget.mockResolvedValue({ bufferedData: 'aGVsbG8=' });
    rig.commitOwners(TARGET, [TAB]);
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    rig.emitNetwork(TARGET, 'Network.responseReceived', rawResponseReceived('R1'));
    await rig.plane.requestBody(TAB, storeId(TARGET, 'R1'), 0);
    expect(rig.sendOnTarget).toHaveBeenCalledWith(TARGET, 'Network.streamResourceContent', { requestId: 'R1' });
  });

  it('emits the EMPTY body for an unknown id on an attached tab (the clobber trap)', async () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB]);
    await rig.plane.requestBody(TAB, storeId(TARGET, 'NEVER-SEEN'), 0);
    expect(rig.sendOnTarget).not.toHaveBeenCalled();
    const attached = rig.apply.mock.calls.map(([update]) => update).find((update) => update.kind === 'body-attached');
    expect(attached).toMatchObject({ tabId: TAB, body: { content: '', encoding: '' } });
  });

  it('is a no-op for a tab outside its attach set', async () => {
    const rig = makeRig();
    await rig.plane.requestBody(TAB, storeId(TARGET, 'R1'), 0);
    expect(rig.apply).not.toHaveBeenCalled();
  });

  it('dispose stops the fan', () => {
    const rig = makeRig();
    rig.commitOwners(TARGET, [TAB]);
    rig.plane.dispose();
    rig.emitNetwork(TARGET, 'Network.requestWillBeSent', rawRequestWillBeSent('R1'));
    expect(rig.apply).not.toHaveBeenCalled();
  });
});

describe('createBodyFetchRouter', () => {
  function leg(): BodyFetcherLeg & { requestBody: ReturnType<typeof vi.fn> } {
    return { requestBody: vi.fn().mockResolvedValue(undefined) };
  }

  it('routes target-prefixed store ids to the SW plane alone', async () => {
    const sw = leg();
    const tab = leg();
    const router = createBodyFetchRouter(sw, tab);
    await router.requestBody(TAB, storeId(TARGET, 'R1'), 0);
    expect(sw.requestBody).toHaveBeenCalledWith(TAB, storeId(TARGET, 'R1'), 0);
    expect(tab.requestBody).not.toHaveBeenCalled();
  });

  it('routes every other store id to the tab plane alone', async () => {
    const sw = leg();
    const tab = leg();
    const router = createBodyFetchRouter(sw, tab);
    await router.requestBody(TAB, 'oh-root::R1', 2);
    await router.requestBody(TAB, '12345', 0);
    expect(tab.requestBody).toHaveBeenCalledTimes(2);
    expect(sw.requestBody).not.toHaveBeenCalled();
  });
});
