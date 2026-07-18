/**
 * Workbench `executeWebSocketRequest` route — the node host's Connect
 * over the REAL executor + resolver (entity-store leaves and the
 * storage slots mocked) with an injected scripted transport. Pins the
 * handler contract (snapshot passthrough, uid-vs-draft precedence,
 * required sendId, error mapping) and the executor's laws: pre-wire
 * gates (unresolved variables / empty url / non-ws scheme) as
 * structured error snapshots, the wire request shape (param append,
 * reserved-header filtering, subprotocol + TLS-knob + deadline carry),
 * both directions captured in call order, the rider plane (per-send
 * template resolution, a resolve failure leaving the session open),
 * the Disconnect close, the 1006 → null close mapping, Stop-abort
 * materialization, and the rolling-retention capture cap.
 */

import type { Environment, Vault, WebSocketRequest } from '@openheaders/core/types';
import type {
  WsSessionCallbacks,
  WsSessionWriter,
  WsTransport,
  WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { WsTransportError } from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  vault: vi.fn((): Vault => ({ schemaVersion: 5, secrets: [] })),
  environments: vi.fn((): Environment[] => []),
  activeEnvironmentId: vi.fn((): string | null => null),
  storageSlots: new Map<string, unknown[]>(),
}));

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => h.activeEnvironmentId(),
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => h.environments(),
  getEnvironmentsForWorkspace: () => h.environments(),
  getVault: () => h.vault(),
  getVaultForWorkspace: () => h.vault(),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
  getWorkspaceVariablesForWorkspace: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/files-store', () => ({
  listFiles: async () => [],
}));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
}));
vi.mock('@openheaders/oracle/storage', () => ({
  wsKeys: (ws: string) => ({
    websocketRequests: { key: `oh.ws.${ws}.websocketRequests` },
  }),
  hostStorage: {
    getValidatedArray: async (spec: { key: string }) => h.storageSlots.get(spec.key) ?? [],
  },
}));

import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { closeActiveWsSession, sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import { handleExecuteWebSocketRequestRpc } from '../../../src/daemon/execute-websocket-request-rpc';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'wsrq0001',
    path: 'requests/default/live-events-wsrq0001',
    name: 'Live Events',
    url: 'wss://events.openheaders.io/live',
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

/**
 * Scripted transport: opens on a microtask (greeting message included
 * unless disabled), records the wire request and every writer call,
 * and answers `writer.close` with a clean Close + end. `signal` abort
 * tears down per the seam contract.
 */
function scriptedTransport(options: { open?: boolean; greet?: boolean } = {}): {
  transport: WsTransport;
  sent: () => WsTransportRequest;
  writes: string[];
  calls: () => number;
} {
  const { open = true, greet = true } = options;
  let captured: WsTransportRequest | undefined;
  const writes: string[] = [];
  let n = 0;
  const transport: WsTransport = {
    connect(request, callbacks: WsSessionCallbacks, signal): WsSessionWriter {
      captured = request;
      n += 1;
      let ended = false;
      let opened = false;
      const settle = (close: { code: number; reason: string; wasClean: boolean } | null): void => {
        if (ended) return;
        ended = true;
        if (close !== null) callbacks.onClose(close);
        callbacks.onEnd();
      };
      signal?.addEventListener('abort', () => {
        if (ended) return;
        if (opened) settle(null);
        else {
          ended = true;
          callbacks.onEnd(new WsTransportError('Session stopped before it connected.'));
        }
      });
      queueMicrotask(() => {
        if (ended) return;
        if (!open) {
          ended = true;
          callbacks.onEnd(new WsTransportError('Connection refused by events.openheaders.io.'));
          return;
        }
        opened = true;
        callbacks.onOpen('chat.v2', '');
        if (greet) callbacks.onMessage({ data: new TextEncoder().encode('greeting'), binary: false });
      });
      return {
        send: (text) => writes.push(text),
        close: (code, reason) => settle({ code, reason, wasClean: true }),
      };
    },
  };
  return {
    transport,
    sent: () => {
      if (!captured) throw new Error('transport.connect not called');
      return captured;
    },
    writes,
    calls: () => n,
  };
}

function seedStorage(requests: WebSocketRequest[], workspace = 'ws-active'): void {
  h.storageSlots.set(`oh.ws.${workspace}.websocketRequests`, requests);
}

/** Run the handler and drive the session with `steps` once it opens. */
async function runSession(
  message: Record<string, unknown>,
  transport: WsTransport,
  steps: (sendId: string) => void | Promise<void>,
): Promise<Awaited<ReturnType<typeof handleExecuteWebSocketRequestRpc>>> {
  const sendId = typeof message.sendId === 'string' ? message.sendId : 'send-x';
  const pending = handleExecuteWebSocketRequestRpc({ sendId, ...message }, transport, () => {});
  // Let the connect microtask (open + greeting) run first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await steps(sendId);
  return pending;
}

afterEach(() => {
  h.storageSlots.clear();
  h.vault.mockReset();
  h.vault.mockImplementation(() => ({ schemaVersion: 5, secrets: [] }));
});

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

describe('handleExecuteWebSocketRequestRpc — happy path', () => {
  it('runs a stored request end to end: open, both directions, Disconnect', async () => {
    seedStorage([makeWsRequest()]);
    const { transport, sent, writes } = scriptedTransport();
    const result = await runSession({ webSocketRequestUid: 'wsrq0001', sendId: 'send-1' }, transport, (sendId) => {
      expect(sendActiveWsSessionMessage(sendId, 'hello')).toEqual({ success: true });
      expect(closeActiveWsSession(sendId)).toBe(true);
    });
    expect(result.success).toBe(true);
    const snapshot = result.snapshot;
    if (!snapshot) throw new Error('no snapshot');
    expect(snapshot.error).toBeNull();
    expect(snapshot.connected).toBe(true);
    expect(snapshot.protocol).toBe('chat.v2');
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['down', 'up']);
    expect(snapshot.messages[1]).toEqual({ direction: 'up', dataBase64: b64('hello'), binary: false });
    expect(snapshot.droppedMessages).toBe(0);
    expect(snapshot.close).toEqual({ code: 1000, reason: '', wasClean: true });
    expect(snapshot.stopped).toBeUndefined();
    expect(sent().url).toBe('wss://events.openheaders.io/live');
    expect(writes).toEqual(['hello']);
  });

  it('emits open / messages / end live frames on the sink', async () => {
    seedStorage([makeWsRequest()]);
    const { transport } = scriptedTransport();
    const events: Array<{ kind: string }> = [];
    const pending = handleExecuteWebSocketRequestRpc(
      { webSocketRequestUid: 'wsrq0001', sendId: 'send-ev' },
      transport,
      (event) => events.push(event),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    closeActiveWsSession('send-ev');
    await pending;
    expect(events.map((e) => e.kind)).toEqual(['open', 'messages', 'end']);
  });

  it('prefers the stored request over a draft and a draft over nothing', async () => {
    seedStorage([makeWsRequest({ url: 'wss://stored.openheaders.io' })]);
    const stored = scriptedTransport();
    await runSession(
      { webSocketRequestUid: 'wsrq0001', draft: makeWsRequest({ url: 'wss://draft.openheaders.io' }), sendId: 's-1' },
      stored.transport,
      (sendId) => void closeActiveWsSession(sendId),
    );
    expect(stored.sent().url).toBe('wss://stored.openheaders.io');

    const draft = scriptedTransport();
    await runSession(
      { draft: makeWsRequest({ url: 'wss://draft.openheaders.io' }), sendId: 's-2' },
      draft.transport,
      (sendId) => void closeActiveWsSession(sendId),
    );
    expect(draft.sent().url).toBe('wss://draft.openheaders.io');
  });

  it('appends enabled params to the session URL and resolves {{refs}} everywhere', async () => {
    h.vault.mockImplementation(() => ({
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'api_token', value: 'tok-123' }],
    }));
    seedStorage([]);
    const { transport, sent } = scriptedTransport();
    await runSession(
      {
        draft: makeWsRequest({
          url: 'wss://{{vault.api_token}}.openheaders.io/live',
          headers: [{ uid: 'h1', key: 'x-api-key', value: '{{vault.api_token}}' }],
          params: [
            { uid: 'p1', key: 'tenant', value: 'open headers' },
            { uid: 'p2', key: 'token', value: '{{vault.api_token}}' },
            { uid: 'p3', key: 'off', value: 'nope', enabled: false },
          ],
        }),
        sendId: 's-3',
      },
      transport,
      (sendId) => void closeActiveWsSession(sendId),
    );
    expect(sent().url).toBe('wss://tok-123.openheaders.io/live?tenant=open%20headers&token=tok-123');
    expect(sent().headers).toEqual([{ key: 'x-api-key', value: 'tok-123' }]);
  });

  it('filters reserved and Sec-WebSocket-* header rows, keeps the rest', async () => {
    seedStorage([]);
    const { transport, sent } = scriptedTransport();
    await runSession(
      {
        draft: makeWsRequest({
          headers: [
            { uid: 'h1', key: 'x-probe-client', value: 'oh' },
            { uid: 'h2', key: 'Sec-WebSocket-Protocol', value: 'spoof' },
            { uid: 'h3', key: 'Host', value: 'spoof.openheaders.io' },
            { uid: 'h4', key: 'upgrade', value: 'h2c' },
            { uid: 'h5', key: 'x-off', value: 'nope', enabled: false },
          ],
        }),
        sendId: 's-4',
      },
      transport,
      (sendId) => void closeActiveWsSession(sendId),
    );
    expect(sent().headers).toEqual([{ key: 'x-probe-client', value: 'oh' }]);
  });

  it('carries subprotocols, the TLS knob, and the connect deadline', async () => {
    seedStorage([]);
    const { transport, sent } = scriptedTransport();
    await runSession(
      {
        draft: makeWsRequest({ subprotocols: ['graphql-ws', 'chat.v2'], sslVerification: false, timeoutMs: 15_000 }),
        sendId: 's-5',
      },
      transport,
      (sendId) => void closeActiveWsSession(sendId),
    );
    expect(sent().subprotocols).toEqual(['graphql-ws', 'chat.v2']);
    expect(sent().sslVerification).toBe(false);
    expect(sent().timeoutMs).toBe(15_000);
  });
});

describe('handleExecuteWebSocketRequestRpc — rider plane', () => {
  it('resolves {{refs}} per send through the retained resolver', async () => {
    h.vault.mockImplementation(() => ({
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'api_token', value: 'tok-123' }],
    }));
    seedStorage([]);
    const { transport, writes } = scriptedTransport();
    const result = await runSession({ draft: makeWsRequest(), sendId: 's-6' }, transport, (sendId) => {
      expect(sendActiveWsSessionMessage(sendId, '{"token":"{{vault.api_token}}"}')).toEqual({ success: true });
      closeActiveWsSession(sendId);
    });
    expect(writes).toEqual(['{"token":"tok-123"}']);
    expect(result.snapshot?.messages.at(-1)).toEqual({
      direction: 'up',
      dataBase64: b64('{"token":"tok-123"}'),
      binary: false,
    });
  });

  it('fails a rider with unresolved refs alone — the session stays open', async () => {
    seedStorage([]);
    const { transport, writes } = scriptedTransport();
    const result = await runSession({ draft: makeWsRequest(), sendId: 's-7' }, transport, (sendId) => {
      const bad = sendActiveWsSessionMessage(sendId, 'x {{vault.missing}}');
      expect(bad.success).toBe(false);
      expect(bad.error).toContain('vault.missing');
      expect(sendActiveWsSessionMessage(sendId, 'still-open')).toEqual({ success: true });
      closeActiveWsSession(sendId);
    });
    expect(writes).toEqual(['still-open']);
    expect(result.snapshot?.error).toBeNull();
  });

  it('unregisters the session once settled', async () => {
    seedStorage([]);
    const { transport } = scriptedTransport();
    await runSession({ draft: makeWsRequest(), sendId: 's-8' }, transport, (sendId) => {
      closeActiveWsSession(sendId);
    });
    expect(sendActiveWsSessionMessage('s-8', 'late').success).toBe(false);
    expect(closeActiveWsSession('s-8')).toBe(false);
  });
});

describe('handleExecuteWebSocketRequestRpc — pre-wire gates', () => {
  it('refuses unresolved variables naming the refs, before the wire', async () => {
    seedStorage([]);
    const { transport, calls } = scriptedTransport();
    const result = await handleExecuteWebSocketRequestRpc(
      { draft: makeWsRequest({ url: 'wss://{{env.missing_host}}/live' }), sendId: 's-9' },
      transport,
    );
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toContain('env.missing_host');
    expect(result.snapshot?.connected).toBe(false);
    expect(calls()).toBe(0);
  });

  it('refuses an empty url and a non-ws(s) scheme distinctly', async () => {
    seedStorage([]);
    const empty = scriptedTransport();
    const emptyResult = await handleExecuteWebSocketRequestRpc(
      { draft: makeWsRequest({ url: '  ' }), sendId: 's-10' },
      empty.transport,
    );
    expect(emptyResult.snapshot?.error).toBe('URL is empty');
    const scheme = scriptedTransport();
    const schemeResult = await handleExecuteWebSocketRequestRpc(
      { draft: makeWsRequest({ url: 'https://events.openheaders.io' }), sendId: 's-11' },
      scheme.transport,
    );
    expect(schemeResult.snapshot?.error).toContain('ws:// or wss://');
  });

  it('requires a sendId and answers missing input with success: false', async () => {
    seedStorage([]);
    const { transport } = scriptedTransport();
    const noSend = await handleExecuteWebSocketRequestRpc({ draft: makeWsRequest() }, transport, () => {});
    expect(noSend).toEqual({ success: false, error: 'No sendId provided — a session needs one' });
    const noInput = await handleExecuteWebSocketRequestRpc({ sendId: 's-12' }, transport, () => {});
    expect(noInput).toEqual({ success: false, error: 'No WebSocket request or draft provided' });
  });

  it('answers a missing stored uid with an error snapshot', async () => {
    seedStorage([]);
    const { transport } = scriptedTransport();
    const result = await handleExecuteWebSocketRequestRpc(
      { webSocketRequestUid: 'gone1234', sendId: 's-13' },
      transport,
      () => {},
    );
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toContain('gone1234 not found');
  });
});

describe('handleExecuteWebSocketRequestRpc — settle shapes', () => {
  it('maps a pre-open failure onto an error snapshot, success stays true', async () => {
    seedStorage([]);
    const { transport } = scriptedTransport({ open: false });
    const result = await handleExecuteWebSocketRequestRpc(
      { draft: makeWsRequest(), sendId: 's-14' },
      transport,
      () => {},
    );
    expect(result.success).toBe(true);
    expect(result.snapshot?.connected).toBe(false);
    expect(result.snapshot?.error).toContain('Connection refused');
  });

  it('records the platform 1006 no-Close-frame marker as the null close it is', async () => {
    seedStorage([]);
    let sessionCallbacks: WsSessionCallbacks | undefined;
    const transport: WsTransport = {
      connect(_request, callbacks): WsSessionWriter {
        sessionCallbacks = callbacks;
        queueMicrotask(() => callbacks.onOpen('', ''));
        return { send: () => {}, close: () => {} };
      },
    };
    const pending = handleExecuteWebSocketRequestRpc({ draft: makeWsRequest(), sendId: 's-15' }, transport, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    sessionCallbacks?.onClose({ code: 1006, reason: '', wasClean: false });
    sessionCallbacks?.onEnd();
    const result = await pending;
    expect(result.snapshot?.connected).toBe(true);
    expect(result.snapshot?.close).toBeNull();
    expect(result.snapshot?.error).toBeNull();
  });

  it('keeps a real server close verbatim, wasClean included', async () => {
    seedStorage([]);
    let sessionCallbacks: WsSessionCallbacks | undefined;
    const transport: WsTransport = {
      connect(_request, callbacks): WsSessionWriter {
        sessionCallbacks = callbacks;
        queueMicrotask(() => callbacks.onOpen('', ''));
        return { send: () => {}, close: () => {} };
      },
    };
    const pending = handleExecuteWebSocketRequestRpc({ draft: makeWsRequest(), sendId: 's-16' }, transport, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    sessionCallbacks?.onClose({ code: 4444, reason: 'menu-reason', wasClean: true });
    sessionCallbacks?.onEnd();
    const result = await pending;
    expect(result.snapshot?.close).toEqual({ code: 4444, reason: 'menu-reason', wasClean: true });
  });

  it('Stop-abort materializes what arrived with stopped: true', async () => {
    seedStorage([]);
    const { transport } = scriptedTransport();
    const pending = handleExecuteWebSocketRequestRpc({ draft: makeWsRequest(), sendId: 's-17' }, transport, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stopActiveSend('s-17')).toBe(true);
    const result = await pending;
    expect(result.snapshot?.connected).toBe(true);
    expect(result.snapshot?.stopped).toBe(true);
    expect(result.snapshot?.messages.map((m) => m.direction)).toEqual(['down']);
    expect(result.snapshot?.close).toBeNull();
    expect(result.snapshot?.error).toBeNull();
  });

  it('Stop before the handshake settles as the classified stop error', async () => {
    seedStorage([]);
    let abortSignal: AbortSignal | undefined;
    const transport: WsTransport = {
      connect(_request, callbacks, signal): WsSessionWriter {
        abortSignal = signal;
        signal?.addEventListener('abort', () => {
          callbacks.onEnd(new WsTransportError('Session stopped before it connected.'));
        });
        return { send: () => {}, close: () => {} };
      },
    };
    const pending = handleExecuteWebSocketRequestRpc({ draft: makeWsRequest(), sendId: 's-18' }, transport, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(abortSignal).toBeDefined();
    expect(stopActiveSend('s-18')).toBe(true);
    const result = await pending;
    expect(result.snapshot?.connected).toBe(false);
    expect(result.snapshot?.error).toBe('Session stopped before it connected.');
  });
});

describe('handleExecuteWebSocketRequestRpc — rolling retention', () => {
  it('keeps the most recent messages under the count cap and counts the dropped', async () => {
    seedStorage([]);
    let sessionCallbacks: WsSessionCallbacks | undefined;
    const transport: WsTransport = {
      connect(_request, callbacks): WsSessionWriter {
        sessionCallbacks = callbacks;
        queueMicrotask(() => callbacks.onOpen('', ''));
        return { send: () => {}, close: () => {} };
      },
    };
    const pending = handleExecuteWebSocketRequestRpc({ draft: makeWsRequest(), sendId: 's-19' }, transport, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    const payload = new TextEncoder().encode('m');
    for (let i = 0; i < 10_005; i++) sessionCallbacks?.onMessage({ data: payload, binary: false });
    sessionCallbacks?.onClose({ code: 1000, reason: '', wasClean: true });
    sessionCallbacks?.onEnd();
    const result = await pending;
    expect(result.snapshot?.messages).toHaveLength(10_000);
    expect(result.snapshot?.droppedMessages).toBe(5);
  });
});
