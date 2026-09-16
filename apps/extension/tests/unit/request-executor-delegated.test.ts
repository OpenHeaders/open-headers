/**
 * The delegated leg of the interactive send — the Execution Place
 * plan's context side in the service worker: with `executionPlace`
 * naming a backend, the resolved, signed wire shape rides the
 * `delegateRequest` frame on THAT backend's wire (deadline-free; the
 * request's own ceiling inside the frame), the place's live frames
 * re-broadcast under the context's own `sendId`, the answer maps onto
 * the snapshot with the node-side facts and `executedOn`, the place's
 * classified failure and refusal land as error snapshots, Stop forwards
 * as the place's abort, a GET keeps its body (the browser's omission is
 * the browser's alone), and multipart file bytes ride base64. Nothing
 * here touches `fetch`.
 */

import type { Collection, Environment, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
// Registers the `requests.*` setting definitions (import side effect) —
// the delegated leg reads the response-body cap.
import '@openheaders/ui/workbench/settings/schema/requests';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  broadcast: vi.fn(),
  wsRequest: vi.fn(),
  frameHandlers: [] as Array<(frame: unknown, wire: { backendId: string }) => boolean | Promise<boolean>>,
}));

vi.mock('@utils/bridge', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  broadcast: (...args: unknown[]) => h.broadcast(...args),
}));
vi.mock('@openheaders/oracle/sync/client/wire-request', () => ({
  wsRequest: (...args: unknown[]) => h.wsRequest(...args),
}));
vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  registerInboundFrameHandler: (handler: (frame: unknown, wire: { backendId: string }) => boolean) => {
    h.frameHandlers.push(handler);
    return () => {};
  },
}));

Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as Collection[]),
  getRequestCollectionsForWorkspace: vi.fn(() => [] as Collection[]),
  getRequestFolders: vi.fn(() => []),
  getRequestFoldersForWorkspace: vi.fn(() => []),
  getRequestUidsForWorkspace: vi.fn(() => null),
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: vi.fn(() => [] as Collection[]),
}));
vi.mock('@/background/modules/workspace/workspace-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getActiveWorkspaceId: () => 'ws-1',
}));
vi.mock('@openheaders/oracle/entity/files-store', () => ({
  getFileBlob: vi.fn(async (fileId: string) =>
    fileId === 'file-1' ? new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' }) : null,
  ),
}));

import { __resetDelegatedWireForTests } from '@openheaders/oracle/sync/client/delegated-wire-client';
import { executeRequestDraft } from '@/background/modules/request-executor';
import { stopActiveSend } from '@/background/modules/request-executor/send-stream';

const PLACE = { executionPlace: { backendId: 'backend-desktop' } };
const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'r1',
    path: 'requests/default-xxxx/r1',
    name: 'R',
    method: 'GET',
    url: 'https://api.openheaders.io/v1/items',
    headers: [],
    params: [],
    auth: { type: 'bearer', token: 'resolved-token' },
    body: { type: 'none' },
    ...overrides,
  };
}

const RESPONSE = {
  status: 200,
  statusText: 'OK',
  url: 'https://api.openheaders.io/v1/items',
  headers: [{ key: 'content-type', value: 'application/json' }],
  body: '{"ok":true}',
  bodyTruncated: false,
  bodyBytes: 11,
  httpVersion: 'h2',
  phaseTimings: { waitingMs: 12, downloadMs: 3 },
};

type SentFrame = { type: string; sendId?: string; workspaceId?: string; request?: Record<string, unknown> };

function sentFrames(type: string): Array<{ frame: SentFrame; options: Record<string, unknown> | undefined }> {
  return h.wsRequest.mock.calls
    .filter(([frame]) => (frame as SentFrame).type === type)
    .map(([frame, options]) => ({
      frame: frame as SentFrame,
      options: options as Record<string, unknown> | undefined,
    }));
}

function injectFrame(backendId: string, payload: Record<string, unknown>): void {
  for (const handler of h.frameHandlers) void handler({ type: 'requestStreamEvent', payload }, { backendId });
}

function contextFrames(kind: string): Array<Record<string, unknown>> {
  return h.broadcast.mock.calls
    .filter(([channel, payload]) => channel === 'requestStreamEvent' && (payload as { kind: string }).kind === kind)
    .map(([, payload]) => payload as Record<string, unknown>);
}

beforeEach(() => {
  h.broadcast.mockReset();
  h.wsRequest.mockReset();
  h.frameHandlers.length = 0;
  __resetDelegatedWireForTests();
  vi.stubGlobal('fetch', () => {
    throw new Error('fetch must not run on the delegated leg');
  });
});

describe('delegated send — the frame', () => {
  it('rides delegateRequest on the named backend, deadline-free, with the resolved wire shape and the workspace', async () => {
    h.wsRequest.mockResolvedValue({ success: true, response: RESPONSE, executedOn: EXECUTED_ON });
    const snap = await executeRequestDraft(
      makeRequest({ params: [{ uid: 'p1', key: 'q', value: '1', enabled: true }], timeoutMs: 4000 }),
      { ...PLACE, sendId: 'ctx-1' },
    );
    const sent = sentFrames('delegateRequest');
    expect(sent).toHaveLength(1);
    expect(sent[0].options).toEqual({ backendId: 'backend-desktop', timeoutMs: 0 });
    expect(sent[0].frame.workspaceId).toBe('ws-1');
    expect(sent[0].frame.sendId).toBeTypeOf('string');
    // The wire id is the transport's own, never the context's.
    expect(sent[0].frame.sendId).not.toBe('ctx-1');
    expect(sent[0].frame.request).toMatchObject({
      method: 'GET',
      url: 'https://api.openheaders.io/v1/items?q=1',
      redirect: 'follow',
      credentials: 'omit',
      timeoutMs: 4000,
      captureNetwork: true,
    });
    const headers = sent[0].frame.request?.headers as Array<{ key: string; value: string }>;
    expect(headers.some((hd) => hd.key.toLowerCase() === 'authorization' && hd.value === 'Bearer resolved-token')).toBe(
      true,
    );
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('{"ok":true}');
    expect(snap.executedOn).toEqual(EXECUTED_ON);
    expect(snap.httpVersion).toBe('h2');
    expect(snap.phaseTimings).toEqual({ waitingMs: 12, downloadMs: 3 });
    expect(snap.requestSize).toBeDefined();
  });

  it("keeps a GET body on the wire — the omission is the browser socket's fact alone", async () => {
    h.wsRequest.mockResolvedValue({ success: true, response: RESPONSE, executedOn: EXECUTED_ON });
    const snap = await executeRequestDraft(
      makeRequest({ method: 'GET', body: { type: 'json', content: '{"filter":1}' } }),
      PLACE,
    );
    expect(sentFrames('delegateRequest')[0].frame.request?.body).toEqual({ kind: 'raw', content: '{"filter":1}' });
    expect(snap.requestBodyOmitted).toBeUndefined();
  });

  it('carries multipart file bytes base64 and text parts verbatim', async () => {
    h.wsRequest.mockResolvedValue({ success: true, response: RESPONSE, executedOn: EXECUTED_ON });
    await executeRequestDraft(
      makeRequest({
        method: 'POST',
        body: {
          type: 'multipart',
          multipartParts: [
            { kind: 'text', uid: 'm1', name: 'note', value: 'hello', enabled: true },
            {
              kind: 'file',
              uid: 'm2',
              name: 'doc',
              enabled: true,
              fileRefs: [
                { fileId: 'file-1', hash: 'h1', filename: 'a.bin', mimeType: 'application/octet-stream', size: 3 },
              ],
            },
          ],
        },
      }),
      PLACE,
    );
    expect(sentFrames('delegateRequest')[0].frame.request?.body).toEqual({
      kind: 'multipart',
      parts: [
        { kind: 'text', name: 'note', value: 'hello' },
        { kind: 'file', name: 'doc', filename: 'a.bin', mimeType: 'application/octet-stream', bytesBase64: 'AQID' },
      ],
    });
  });
});

describe('delegated send — frames and Stop', () => {
  it("re-broadcasts the place's head and chunks under the context's own sendId", async () => {
    h.wsRequest.mockImplementation(async (frame: SentFrame) => {
      if (frame.type !== 'delegateRequest') return { success: true };
      const wireId = frame.sendId ?? '';
      injectFrame('backend-desktop', {
        sendId: wireId,
        seq: 0,
        kind: 'head',
        head: { status: 200, statusText: 'OK', url: RESPONSE.url, headers: [] },
      });
      injectFrame('backend-desktop', {
        sendId: wireId,
        seq: 1,
        kind: 'chunk',
        chunkBase64: btoa('{"ok"'),
        totalBytes: 5,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      injectFrame('backend-desktop', {
        sendId: wireId,
        seq: 2,
        kind: 'chunk',
        chunkBase64: btoa(':true}'),
        totalBytes: 11,
      });
      injectFrame('backend-desktop', { sendId: wireId, seq: 3, kind: 'done' });
      return { success: true, response: RESPONSE, executedOn: EXECUTED_ON };
    });
    const snap = await executeRequestDraft(makeRequest(), { ...PLACE, sendId: 'ctx-live' });
    expect(snap.error).toBeNull();
    const heads = contextFrames('head');
    expect(heads).toHaveLength(1);
    expect(heads[0]).toMatchObject({ sendId: 'ctx-live', head: { status: 200 } });
    const chunks = contextFrames('chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((c) => c.sendId === 'ctx-live')).toBe(true);
    expect(contextFrames('done')).toHaveLength(1);
    expect(snap.streamedCapture).toEqual({ endedBy: 'end' });
  });

  it("ignores frames from another backend or an unknown id — they are not this send's", async () => {
    h.wsRequest.mockImplementation(async (frame: SentFrame) => {
      if (frame.type !== 'delegateRequest') return { success: true };
      injectFrame('backend-other', {
        sendId: frame.sendId,
        seq: 0,
        kind: 'head',
        head: { status: 500, statusText: 'x', url: 'u', headers: [] },
      });
      injectFrame('backend-desktop', {
        sendId: 'someone-else',
        seq: 0,
        kind: 'head',
        head: { status: 500, statusText: 'x', url: 'u', headers: [] },
      });
      return { success: true, response: RESPONSE, executedOn: EXECUTED_ON };
    });
    await executeRequestDraft(makeRequest(), { ...PLACE, sendId: 'ctx-2' });
    expect(contextFrames('head')).toHaveLength(0);
  });

  it("forwards Stop as the place's abortRequestSend on the same backend, by the wire id", async () => {
    const pendingAnswer: { settle?: (value: unknown) => void } = {};
    h.wsRequest.mockImplementation((frame: SentFrame) => {
      if (frame.type === 'abortRequestSend') return Promise.resolve({ success: true });
      return new Promise((resolve) => {
        pendingAnswer.settle = resolve;
      });
    });
    const pending = executeRequestDraft(makeRequest(), { ...PLACE, sendId: 'ctx-stop' });
    await vi.waitFor(() => expect(sentFrames('delegateRequest')).toHaveLength(1));
    const wireId = sentFrames('delegateRequest')[0].frame.sendId;
    expect(stopActiveSend('ctx-stop')).toBe(true);
    const aborts = sentFrames('abortRequestSend');
    expect(aborts).toHaveLength(1);
    expect(aborts[0].frame.sendId).toBe(wireId);
    expect(aborts[0].options).toEqual({ backendId: 'backend-desktop' });
    pendingAnswer.settle?.({
      success: true,
      response: { ...RESPONSE, body: '{"ok"', bodyBytes: 5, streamEndedEarly: { reason: 'aborted' } },
      executedOn: EXECUTED_ON,
    });
    const snap = await pending;
    expect(snap.error).toBeNull();
    expect(snap.streamedCapture).toEqual({ endedBy: 'stop' });
    expect(stopActiveSend('ctx-stop')).toBe(false);
  });
});

describe('delegated send — failures', () => {
  it("lands the place's classified failure as an error snapshot with its hint and stamp", async () => {
    h.wsRequest.mockResolvedValue({
      success: false,
      error: 'self signed certificate',
      hint: { kind: 'trust-certificate', host: 'api.openheaders.io', port: 443, code: 'DEPTH_ZERO_SELF_SIGNED_CERT' },
      executedOn: EXECUTED_ON,
    });
    const snap = await executeRequestDraft(makeRequest(), { ...PLACE, sendId: 'ctx-fail' });
    expect(snap.error).toBe('self signed certificate');
    expect(snap.errorHint).toMatchObject({ kind: 'trust-certificate' });
    expect(snap.executedOn).toEqual(EXECUTED_ON);
    expect(snap.status).toBe(0);
    expect(contextFrames('done')).toHaveLength(0);
  });

  it("lands the place's refusal or a dead wire as an error snapshot without a stamp", async () => {
    h.wsRequest.mockRejectedValue(new Error('not-connected'));
    const snap = await executeRequestDraft(makeRequest(), PLACE);
    expect(snap.error).toBe('not-connected');
    expect(snap.executedOn).toBeUndefined();
  });
});
