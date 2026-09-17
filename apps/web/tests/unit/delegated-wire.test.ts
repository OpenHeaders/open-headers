/**
 * The web tab's delegated wire — the request family's seam over the
 * tab's one wire: the frame rides `delegateRequest` as a wire RPC
 * whose wait follows the request's own timeout knob (plus slack), the
 * daemon's answer comes back as the family's result and a dead or
 * unreadable answer rejects; a claimed send id routes its live
 * `requestStreamEvent` frames to the transport's observer (the frame
 * is consumed, never passed to the generic mirror) and an unclaimed
 * id passes onward; the Stop rider forwards as `abortRequestSend`.
 * The socket family's seam: an OPEN and a rider ride as wire RPCs on
 * their own channels and answer the place's result verbatim; a
 * claimed socket id's `delegatedSocketEvent` frames route to the
 * transport that minted it (consumed), an unclaimed id passes onward,
 * and a released claim stops routing.
 */

import { setHostLogger } from '@openheaders/core/logger';
import {
  DELEGATE_MQTT_OPEN_CHANNEL,
  DELEGATE_REQUEST_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATE_WS_SEND_CHANNEL,
  DELEGATED_SOCKET_EVENT_FRAME,
} from '@openheaders/core/protocol';
import type { DelegatedRequestFrame } from '@openheaders/oracle/live/request-exec/delegated-wire';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetDelegatedWireForTests,
  handleIncomingDelegatedSocketFrame,
  handleIncomingDelegatedStreamFrame,
  webDelegatedSocketWire,
  webDelegatedWire,
} from '@/host/delegated-wire';
import { handleWireRpcResponseFrame, setWireRpcSender } from '@/host/wire-rpc';

function frame(timeoutMs?: number): DelegatedRequestFrame {
  return {
    type: DELEGATE_REQUEST_CHANNEL,
    sendId: 'wire-1',
    workspaceId: 'ws-tab',
    request: {
      method: 'GET',
      url: 'https://api.openheaders.io/items',
      headers: [],
      body: { kind: 'none' },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: 4096,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    },
  };
}

const RESPONSE = {
  status: 200,
  statusText: 'OK',
  url: 'https://api.openheaders.io/items',
  headers: [],
  body: '[]',
  bodyTruncated: false,
  bodyBytes: 2,
};

describe('delegated-wire', () => {
  let sent: Record<string, unknown>[];

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    sent = [];
    __resetDelegatedWireForTests();
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it('rides the delegateRequest frame up the wire and answers the family result', async () => {
    const call = webDelegatedWire.call(frame(3000));
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: DELEGATE_REQUEST_CHANNEL, sendId: 'wire-1', workspaceId: 'ws-tab' });
    handleWireRpcResponseFrame({
      type: `${DELEGATE_REQUEST_CHANNEL}:response`,
      payload: { success: true, response: RESPONSE, executedOn: { kind: 'backend', name: 'workbox' } },
    });
    await expect(call).resolves.toMatchObject({ success: true, response: { status: 200 } });
  });

  it("relays the place's classified failure, and rejects on the daemon's in-band refusal or a dead wire", async () => {
    const failed = webDelegatedWire.call(frame());
    await Promise.resolve();
    handleWireRpcResponseFrame({
      type: `${DELEGATE_REQUEST_CHANNEL}:response`,
      payload: { success: false, error: 'Could not reach api.openheaders.io' },
    });
    await expect(failed).resolves.toEqual({ success: false, error: 'Could not reach api.openheaders.io' });

    const refused = webDelegatedWire.call(frame());
    await Promise.resolve();
    handleWireRpcResponseFrame({ type: `${DELEGATE_REQUEST_CHANNEL}:response`, __error: 'permission denied' });
    await expect(refused).rejects.toThrow('permission denied');

    setWireRpcSender(() => false);
    await expect(webDelegatedWire.call(frame())).rejects.toThrow('daemon wire is not connected');
  });

  it('rejects an answer that is not the family result shape', async () => {
    const call = webDelegatedWire.call(frame());
    await Promise.resolve();
    handleWireRpcResponseFrame({ type: `${DELEGATE_REQUEST_CHANNEL}:response`, payload: { ok: true } });
    await expect(call).rejects.toThrow('no readable answer');
  });

  it('routes a claimed send id’s live frames to its observer and passes unclaimed ones onward', () => {
    const received: unknown[] = [];
    const release = webDelegatedWire.subscribeFrames('wire-1', (event) => {
      received.push(event);
    });
    const claimed = { type: 'requestStreamEvent', payload: { sendId: 'wire-1', seq: 1, kind: 'done' } };
    expect(handleIncomingDelegatedStreamFrame(claimed)).toBe(true);
    expect(received).toEqual([claimed.payload]);
    expect(
      handleIncomingDelegatedStreamFrame({ type: 'requestStreamEvent', payload: { sendId: 'other', seq: 1 } }),
    ).toBe(false);
    expect(handleIncomingDelegatedStreamFrame({ type: 'grpcStreamEvent', payload: { sendId: 'wire-1' } })).toBe(false);
    release();
    expect(handleIncomingDelegatedStreamFrame(claimed)).toBe(false);
  });

  it("forwards the Stop as the place's abortRequestSend by the wire id", async () => {
    webDelegatedWire.abort('wire-1');
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: 'abortRequestSend', sendId: 'wire-1' });
    handleWireRpcResponseFrame({ type: 'abortRequestSend:response', payload: { success: true } });
  });
});

describe('delegated-wire — the socket family', () => {
  let sent: Record<string, unknown>[];

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    sent = [];
    __resetDelegatedWireForTests();
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it("rides the two OPEN frames up the wire and answers the place's result verbatim", async () => {
    const ws = webDelegatedSocketWire.call({
      type: DELEGATE_WS_OPEN_CHANNEL,
      socketId: 'sock-1',
      workspaceId: 'ws-tab',
      request: { url: 'wss://echo.openheaders.io/ws', headers: [], subprotocols: [] },
    });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: DELEGATE_WS_OPEN_CHANNEL, socketId: 'sock-1', workspaceId: 'ws-tab' });
    handleWireRpcResponseFrame({
      type: `${DELEGATE_WS_OPEN_CHANNEL}:response`,
      payload: { success: true, executedOn: { kind: 'backend', name: 'workbox' } },
    });
    await expect(ws).resolves.toEqual({ success: true, executedOn: { kind: 'backend', name: 'workbox' } });

    const mqtt = webDelegatedSocketWire.call({
      type: DELEGATE_MQTT_OPEN_CHANNEL,
      socketId: 'sock-2',
      workspaceId: 'ws-tab',
      request: { url: 'mqtts://broker.openheaders.io:8883' },
    });
    await Promise.resolve();
    expect(sent[1]).toMatchObject({ type: DELEGATE_MQTT_OPEN_CHANNEL, socketId: 'sock-2' });
    handleWireRpcResponseFrame({
      type: `${DELEGATE_MQTT_OPEN_CHANNEL}:response`,
      payload: {
        success: false,
        error: 'Malformed delegated MQTT open frame',
        executedOn: { kind: 'backend', name: 'workbox' },
      },
    });
    await expect(mqtt).resolves.toMatchObject({ success: false, error: 'Malformed delegated MQTT open frame' });
  });

  it("rides a rider and the abort on their own channels, and rejects on the daemon's refusal or a dead wire", async () => {
    const send = webDelegatedSocketWire.call({ type: DELEGATE_WS_SEND_CHANNEL, socketId: 'sock-1', text: 'ping' });
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: DELEGATE_WS_SEND_CHANNEL, socketId: 'sock-1', text: 'ping' });
    handleWireRpcResponseFrame({ type: `${DELEGATE_WS_SEND_CHANNEL}:response`, payload: { success: true } });
    await expect(send).resolves.toEqual({ success: true });

    const abort = webDelegatedSocketWire.call({ type: DELEGATE_SOCKET_ABORT_CHANNEL, socketId: 'sock-1' });
    await Promise.resolve();
    expect(sent[1]).toEqual({ type: DELEGATE_SOCKET_ABORT_CHANNEL, socketId: 'sock-1' });
    handleWireRpcResponseFrame({ type: `${DELEGATE_SOCKET_ABORT_CHANNEL}:response`, __error: 'permission denied' });
    await expect(abort).rejects.toThrow('permission denied');

    setWireRpcSender(() => false);
    await expect(
      webDelegatedSocketWire.call({ type: DELEGATE_SOCKET_ABORT_CHANNEL, socketId: 'sock-1' }),
    ).rejects.toThrow('daemon wire is not connected');
  });

  it('routes a claimed socket id’s events to its transport, passes unclaimed ones onward, and stops on release', () => {
    const received: unknown[] = [];
    const release = webDelegatedSocketWire.subscribe('sock-1', (event) => {
      received.push(event);
    });
    const open = {
      type: DELEGATED_SOCKET_EVENT_FRAME,
      payload: { socketId: 'sock-1', seq: 0, kind: 'open', protocol: '', extensions: '' },
    };
    expect(handleIncomingDelegatedSocketFrame(open)).toBe(true);
    expect(received).toEqual([open.payload]);
    expect(
      handleIncomingDelegatedSocketFrame({
        type: DELEGATED_SOCKET_EVENT_FRAME,
        payload: { socketId: 'other-tab', seq: 0, kind: 'end' },
      }),
    ).toBe(false);
    expect(handleIncomingDelegatedSocketFrame({ type: 'requestStreamEvent', payload: { socketId: 'sock-1' } })).toBe(
      false,
    );
    expect(handleIncomingDelegatedSocketFrame({ type: DELEGATED_SOCKET_EVENT_FRAME })).toBe(false);
    release();
    expect(handleIncomingDelegatedSocketFrame(open)).toBe(false);
    expect(received).toHaveLength(1);
  });
});
