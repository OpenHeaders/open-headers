/**
 * Streamed interactive body read — the executor must survive responses
 * that never end: capped streaming read (no whole-body buffering), live
 * `requestStreamEvent` frames, Stop/deadline/mid-body-failure partial
 * materialization ("stop and snapshot"), and the `streamedCapture`
 * attribution rider.
 */

import type { Collection, Environment, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
// Registers the `requests.*` setting definitions (import side effect) —
// the executor's success path reads the response-body cap.
import '@openheaders/ui/workbench/settings/schema/requests';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const broadcastMock = vi.fn();
vi.mock('@utils/bridge', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  broadcast: (...args: unknown[]) => broadcastMock(...args),
}));

Object.defineProperty(globalThis.navigator, 'onLine', {
  value: true,
  configurable: true,
  writable: true,
});

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

import { executeRequestDraft } from '@/background/modules/request-executor';
import { stopActiveSend } from '@/background/modules/request-executor/send-stream';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'r1',
    path: 'requests/default-xxxx/r1',
    name: 'R',
    method: 'GET',
    url: 'https://api.openheaders.io/v1/stream',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

const encoder = new TextEncoder();

/** A fetch stub whose Response body is a caller-scripted stream wired
 *  to the exchange signal — aborting the signal errors the stream with
 *  an AbortError, exactly as real fetch propagates an abort mid-read. */
function streamingFetch(
  script: (controller: ReadableStreamDefaultController<Uint8Array>, signal: AbortSignal | null | undefined) => void,
  init?: { status?: number; contentType?: string },
) {
  return (_input: string, fetchInit?: RequestInit) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        fetchInit?.signal?.addEventListener('abort', () =>
          controller.error(new DOMException('The operation was aborted.', 'AbortError')),
        );
        script(controller, fetchInit?.signal);
      },
    });
    return Promise.resolve(
      new Response(stream, {
        status: init?.status ?? 200,
        statusText: 'OK',
        headers: { 'content-type': init?.contentType ?? 'text/event-stream' },
      }),
    );
  };
}

function framesOf(kind: string): Array<Record<string, unknown>> {
  return broadcastMock.mock.calls
    .filter(([channel, payload]) => channel === 'requestStreamEvent' && (payload as { kind: string }).kind === kind)
    .map(([, payload]) => payload as Record<string, unknown>);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('streamed interactive read', () => {
  beforeEach(() => {
    broadcastMock.mockReset();
  });

  it('ordinary response with a sendId: normal snapshot, head + done frames, no chunk frames, no rider', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('{"ok":true}'));
        controller.close();
      }),
    );
    const snap = await executeRequestDraft(makeRequest(), { sendId: 'send-ordinary' });
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('{"ok":true}');
    expect(snap.streamedCapture).toBeUndefined();
    // The body completed inside the first flush window — head + done
    // only; the snapshot carries the body.
    const heads = framesOf('head');
    expect(heads).toHaveLength(1);
    expect(heads[0]).toMatchObject({
      sendId: 'send-ordinary',
      head: { status: 200, statusText: 'OK' },
    });
    expect(framesOf('chunk')).toHaveLength(0);
    expect(framesOf('done')).toHaveLength(1);
  });

  it('no sendId: no frames at all (chain/workflow fetches stay silent)', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('ok'));
        controller.close();
      }),
    );
    const snap = await executeRequestDraft(makeRequest());
    expect(snap.body).toBe('ok');
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('live stream: flush-batched chunk frames while reading, endedBy "end" on server close', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('data: one\n\n'));
        // Second event lands after the first 100ms flush window so at
        // least one chunk frame goes out mid-stream.
        setTimeout(() => {
          controller.enqueue(encoder.encode('data: two\n\n'));
          controller.close();
        }, 150);
      }),
    );
    const snap = await executeRequestDraft(makeRequest(), { sendId: 'send-live' });
    expect(snap.error).toBeNull();
    expect(snap.body).toBe('data: one\n\ndata: two\n\n');
    expect(snap.streamedCapture).toEqual({ endedBy: 'end' });
    const chunks = framesOf('chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const first = chunks[0] as { chunkBase64: string; totalBytes: number; seq: number };
    expect(atob(first.chunkBase64)).toBe('data: one\n\n');
    expect(first.totalBytes).toBe('data: one\n\n'.length);
    // done frame flushes the tail when the live phase engaged.
    const all = broadcastMock.mock.calls
      .filter(([channel]) => channel === 'requestStreamEvent')
      .map(([, payload]) => payload as { seq: number });
    const seqs = all.map((p) => p.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('Stop mid-stream materializes the partial body with endedBy "stop" (not truncated, no error)', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('data: partial\n\n'));
        // …then the stream hangs forever; only Stop ends it.
      }),
    );
    const pending = executeRequestDraft(makeRequest(), { sendId: 'send-stop' });
    await sleep(30);
    expect(stopActiveSend('send-stop')).toBe(true);
    const snap = await pending;
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('data: partial\n\n');
    expect(snap.bodyTruncated).toBe(false);
    expect(snap.streamedCapture).toEqual({ endedBy: 'stop' });
    expect(framesOf('done')).toHaveLength(1);
    // The send unregistered on settle — a second Stop finds nothing.
    expect(stopActiveSend('send-stop')).toBe(false);
  });

  it('deadline mid-stream materializes the partial body with endedBy "timeout"', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('tick 1\n'));
        // …then hangs; the 60ms deadline ends the exchange.
      }),
    );
    const snap = await executeRequestDraft(makeRequest({ timeoutMs: 60 }), { sendId: 'send-timeout' });
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('tick 1\n');
    expect(snap.streamedCapture).toEqual({ endedBy: 'timeout' });
  });

  it('mid-body connection failure materializes the partial body with endedBy "error" + message', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(encoder.encode('partial payload'));
        setTimeout(() => controller.error(new Error('connection reset')), 10);
      }),
    );
    const snap = await executeRequestDraft(makeRequest(), { sendId: 'send-err' });
    expect(snap.error).toBeNull();
    expect(snap.status).toBe(200);
    expect(snap.body).toBe('partial payload');
    expect(snap.streamedCapture).toEqual({ endedBy: 'error', message: 'connection reset' });
  });

  it('cap overflow aborts the read: truncated snapshot, capped body, bytesRead past the cap', async () => {
    const capOverflow = new Uint8Array(3 * 1024 * 1024).fill(0x41); // 3 MB of 'A'
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(capOverflow);
        controller.close();
      }),
    );
    const snap = await executeRequestDraft(makeRequest(), { sendId: 'send-cap' });
    expect(snap.error).toBeNull();
    expect(snap.bodyTruncated).toBe(true);
    expect(snap.bodyCapBytes).toBeDefined();
    expect(snap.body.length).toBe(snap.bodyCapBytes);
    expect(snap.bodyBytes).toBe(capOverflow.byteLength);
    // Everything arrived within the first flush window — the cap abort
    // is ordinary truncation, not a live-stream fact: no rider.
    expect(snap.streamedCapture).toBeUndefined();
  });

  it('Stop before any response head yields an error snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      (_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    const pending = executeRequestDraft(makeRequest(), { sendId: 'send-prehead' });
    await sleep(10);
    expect(stopActiveSend('send-prehead')).toBe(true);
    const snap = await pending;
    expect(snap.status).toBe(0);
    expect(snap.error).toBe('Request stopped before a response arrived.');
    expect(snap.streamedCapture).toBeUndefined();
  });

  it('stopActiveSend on an unknown id is a no-op returning false', () => {
    expect(stopActiveSend('never-registered')).toBe(false);
  });

  it('wire bytes stay exact through a live stream (base64 body for non-UTF-8)', async () => {
    const wire = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0x41, 0x42]);
    vi.stubGlobal(
      'fetch',
      streamingFetch((controller) => {
        controller.enqueue(wire);
        controller.close();
      }),
    );
    const snap = await executeRequestDraft(makeRequest(), { sendId: 'send-binary' });
    expect(snap.bodyEncoding).toBe('base64');
    expect(Array.from(Uint8Array.from(atob(snap.body), (c) => c.charCodeAt(0)))).toEqual(Array.from(wire));
    expect(snap.bodyBytes).toBe(wire.byteLength);
  });
});
