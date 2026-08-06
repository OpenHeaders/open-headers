/**
 * Replay read-plane pins (AGENT_TRAFFIC_PLAN.md §11.1, C6): a sealed
 * session opens into the verbatim envelope stream in arrival order;
 * the markers resolve where the LIVE contract puts each payload —
 * har-attached bodies and stream frames re-inline into the stream,
 * body-attached events are withheld and served on the `request-body`
 * pull from the CAS; refusals (unsealed, unknown, key-less encrypted)
 * are loud; and the replay lifeline acceptor speaks the exact
 * lifecycle port protocol over `oh-replay:<archiveId>`.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { IncomingLifelinePort } from '@openheaders/core/awareness';
import { setHostLogger } from '@openheaders/core/logger';
import type { LifecycleWireMessage, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { replayLifecyclePortName } from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptTrafficReplayLifeline } from '../../src/traffic/replay-lifeline';
import { createTrafficSessionArchive, type TrafficSessionArchive } from '../../src/traffic/session-archive';

let root: string;

beforeEach(() => {
  setHostLogger(consoleLogger);
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-session-replay-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 7,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function startedEnvelope(requestId: string): LifecycleWireMessage {
  return { kind: 'lifecycle-update', update: { kind: 'started', lifecycle: makeLifecycle({ requestId }) } };
}

function bodyEnvelope(requestId: string, content: string): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: {
      kind: 'body-attached',
      tabId: 7,
      requestId,
      hopIndex: 0,
      body: {
        method: 'GET',
        url: 'https://api.openheaders.io/users',
        startedDateTime: '2026-08-06T00:00:00.000Z',
        content,
        encoding: '',
      },
    },
  };
}

function harEnvelope(requestId: string, responseText: string, postText: string): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: {
      kind: 'har-attached',
      tabId: 7,
      requestId,
      hopIndex: 0,
      har: {
        startedDateTime: '2026-08-06T00:00:00.000Z',
        request: {
          method: 'POST',
          url: 'https://api.openheaders.io/users',
          headers: [],
          queryString: [],
          postData: { mimeType: 'application/json', text: postText },
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: responseText.length, mimeType: 'application/json', text: responseText },
        },
      },
    },
  };
}

function messageEnvelope(requestId: string, data: string): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: {
      kind: 'message-appended',
      tabId: 7,
      requestId,
      message: { kind: 'ws', type: 'receive', atMs: 2_000, opcode: 1, mask: false, data },
    },
  };
}

async function recordAndSeal(
  archive: TrafficSessionArchive,
  sessionId: string,
  envelopes: LifecycleWireMessage[],
): Promise<string> {
  const session = archive.start({
    sessionId,
    sourceUid: 'browser-tab:ext-node-1:7',
    sourceKind: 'browser-tab',
    sourceLabel: 'tab 7 @ ext-node-1',
    name: sessionId,
    partitionTabId: 7,
    initialFidelity: 'cdp',
    bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
    pullBody: () => {},
  });
  for (const envelope of envelopes) session.appendEnvelope(envelope);
  session.stop();
  await vi.waitFor(() => {
    expect(session.projection().state).toBe('sealed');
  });
  const rows = await archive.listSessions();
  const row = rows.find((r) => r.meta.sessionId === sessionId);
  if (row === undefined) throw new Error(`session ${sessionId} missing from the archive index`);
  return row.id;
}

/** A fake incoming lifeline port: collects host→consumer envelopes. */
function fakePort(name: string) {
  const received: LifecycleWireMessage[] = [];
  let messageHandler: ((msg: unknown) => void) | null = null;
  let disconnectHandler: ((info: { errorMessage?: string }) => void) | null = null;
  const port: IncomingLifelinePort = {
    name,
    postMessage(message) {
      received.push(message as LifecycleWireMessage);
    },
    onMessage(handler) {
      messageHandler = handler as (msg: unknown) => void;
    },
    onDisconnect(handler) {
      disconnectHandler = handler;
    },
  };
  return {
    port,
    received,
    send(msg: unknown) {
      messageHandler?.(msg);
    },
    disconnect() {
      disconnectHandler?.({});
    },
  };
}

const BIG = 'B'.repeat(8_000);
const BIG_POST = `{"post":"${'p'.repeat(8_000)}"}`;
const BIG_FRAME = `frame ${'f'.repeat(8_000)}`;

describe('openReplay (session reader)', () => {
  it('streams the recorded envelopes in order with the live-idiom marker split', async () => {
    const key = randomBytes(32);
    const archive = createTrafficSessionArchive({ dir: root, sealKey: key });
    const id = await recordAndSeal(archive, 'ses-replay', [
      startedEnvelope('r-1'),
      harEnvelope('r-1', BIG, BIG_POST),
      bodyEnvelope('r-1', BIG),
      startedEnvelope('r-2'),
      messageEnvelope('r-2', BIG_FRAME),
      bodyEnvelope('r-2', 'tiny'),
    ]);

    const replay = await archive.openReplay(id);
    expect(replay.partitionTabId).toBe(7);
    expect(replay.initialFidelity).toBe('cdp');

    // body-attached events are WITHHELD (the live lazy-pull contract);
    // everything else streams in arrival order.
    const kinds = replay.envelopes.map((e) => (e.kind === 'lifecycle-update' ? e.update.kind : e.kind));
    expect(kinds).toEqual(['started', 'har-attached', 'started', 'message-appended']);

    // The HAR carve points re-inlined to the exact recorded payloads.
    const har = replay.envelopes[1];
    if (har?.kind !== 'lifecycle-update' || har.update.kind !== 'har-attached') throw new Error('missing har');
    expect(har.update.har.response?.content.text).toBe(BIG);
    expect(har.update.har.request?.postData?.text).toBe(BIG_POST);

    // Stream frames re-inlined too — the live wire pushes them inline.
    const frame = replay.envelopes[3];
    if (frame?.kind !== 'lifecycle-update' || frame.update.kind !== 'message-appended')
      throw new Error('missing frame');
    expect(frame.update.message.data).toBe(BIG_FRAME);

    // Withheld bodies answer the pull — externalized and inline alike.
    const bigBody = await replay.resolveBody('r-1', 0);
    if (bigBody?.kind !== 'lifecycle-update' || bigBody.update.kind !== 'body-attached') throw new Error('no body');
    expect(bigBody.update.body.content).toBe(BIG);
    const tinyBody = await replay.resolveBody('r-2', 0);
    if (tinyBody?.kind !== 'lifecycle-update' || tinyBody.update.kind !== 'body-attached') throw new Error('no body');
    expect(tinyBody.update.body.content).toBe('tiny');

    // A hop the session never recorded answers null (silent-drop wire law).
    expect(await replay.resolveBody('r-404', 0)).toBeNull();
  });

  it('refuses unknown, unsealed and key-less-encrypted sessions loudly', async () => {
    const key = randomBytes(32);
    const archive = createTrafficSessionArchive({ dir: root, sealKey: key });
    await expect(archive.openReplay('missing')).rejects.toThrow('unknown session');
    await expect(archive.openReplay('../escape')).rejects.toThrow('unknown session');

    const live = archive.start({
      sessionId: 'ses-live',
      sourceUid: 'browser-tab:ext-node-1:7',
      sourceKind: 'browser-tab',
      sourceLabel: 'tab 7',
      name: 'live',
      partitionTabId: 7,
      initialFidelity: 'cdp',
      bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
      pullBody: () => {},
    });
    live.appendEnvelope(startedEnvelope('r-1'));
    await vi.waitFor(() => {
      expect(live.projection().events).toBe(1);
    });
    const [row] = await archive.listSessions();
    if (row === undefined) throw new Error('missing row');
    await expect(archive.openReplay(row.id)).rejects.toThrow('not sealed');
    live.stop();
    await vi.waitFor(() => {
      expect(live.projection().state).toBe('sealed');
    });

    // The same archive root opened WITHOUT the seal key cannot decrypt.
    const keyless = createTrafficSessionArchive({ dir: root, sealKey: null });
    await expect(keyless.openReplay(row.id)).rejects.toThrow(/no seal key/);
  });
});

describe('replay lifeline acceptor', () => {
  it('serves subscribe with ready + the recorded stream, answers request-body from the CAS', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const id = await recordAndSeal(archive, 'ses-port', [
      startedEnvelope('r-1'),
      harEnvelope('r-1', BIG, BIG_POST),
      bodyEnvelope('r-1', BIG),
    ]);

    const rig = fakePort(replayLifecyclePortName(id));
    expect(acceptTrafficReplayLifeline(archive, rig.port)).toBe(true);
    rig.send({ kind: 'subscribe' });
    await vi.waitFor(() => {
      expect(rig.received.length).toBe(4);
    });
    // Synthesized ready first (the consumer's clear-then-fold contract),
    // then the provenance replant (the fidelity `source` frame crossed
    // the wire before recording began, so the log starts source-less),
    // then the recorded envelopes; the withheld body is not streamed.
    expect(rig.received[0]).toEqual({ kind: 'ready', tabId: 7, watermarkMs: -1 });
    expect(rig.received[1]).toEqual({ kind: 'source', tabId: 7, source: 'cdp' });
    expect(rig.received.map((e) => (e.kind === 'lifecycle-update' ? e.update.kind : e.kind))).toEqual([
      'ready',
      'source',
      'started',
      'har-attached',
    ]);

    // The one pull on the port answers with an ordinary body-attached.
    rig.send({ kind: 'request-body', requestId: 'r-1', hopIndex: 0 });
    await vi.waitFor(() => {
      expect(rig.received.length).toBe(5);
    });
    const body = rig.received[4];
    if (body?.kind !== 'lifecycle-update' || body.update.kind !== 'body-attached') throw new Error('no body answer');
    expect(body.update.body.content).toBe(BIG);

    // clear-session is a no-op — the archive is immutable through replay.
    rig.send({ kind: 'clear-session' });
    // A re-subscribe re-streams from memory: same contract, fresh fold.
    rig.send({ kind: 'subscribe' });
    await vi.waitFor(() => {
      expect(rig.received.length).toBe(9);
    });
    expect(rig.received[5]).toEqual({ kind: 'ready', tabId: 7, watermarkMs: -1 });
  });

  it('answers watch-refused (replay-unavailable) when the session cannot open, and ignores foreign names', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });

    const rig = fakePort(replayLifecyclePortName('never-recorded'));
    expect(acceptTrafficReplayLifeline(archive, rig.port)).toBe(true);
    rig.send({ kind: 'subscribe' });
    await vi.waitFor(() => {
      expect(rig.received.length).toBe(1);
    });
    expect(rig.received[0]).toEqual({ kind: 'watch-refused', tabId: 0, reason: 'replay-unavailable' });

    // Live lifecycle names pass through unclaimed — by shape, not order.
    const foreign = fakePort('oh-lifecycle:7@ext-node-1');
    expect(acceptTrafficReplayLifeline(archive, foreign.port)).toBe(false);
    const local = fakePort('oh-lifecycle:-59210');
    expect(acceptTrafficReplayLifeline(archive, local.port)).toBe(false);
  });
});
