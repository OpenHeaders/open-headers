/**
 * WS executor — the session credential (Phase G auth block): the
 * bearer token resolves with the Connect-time templates and injects
 * `Authorization: Bearer <token>` into the handshake headers; an
 * explicit user Authorization row takes precedence (the gRPC auth
 * law); an unresolved token gates the session as a structured error;
 * and the socketio flavor ALSO lands the token as the CONNECT
 * packet's auth payload — in-band framing captured verbatim.
 *
 * The widened mask (the session-tabs auth slice): an inherited OAuth
 * 2.0 entry attaches the store's bundle (renewed through the host
 * hook when expired), a JWT Bearer entry mints a verifiable token at
 * the dial, an AWS SigV4 entry in query mode re-signs the dial URL
 * (recomputed here from the wire), api-key / OAuth / JWT query modes
 * ride the handshake URL, the bearer-shaped tokens ALSO ride the
 * Socket.IO CONNECT payload — and every credential mints PER DIAL, so
 * an auto-reconnect redials on the store's current token. The
 * placements the handshake cannot carry (SigV4 in header mode, a
 * DPoP-bound bundle) refuse by name before the wire.
 */

import { createHash, createHmac } from 'node:crypto';
import type { AuthCarrier } from '@openheaders/core/auth-inheritance';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { ConcreteAuthConfig, WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { closeActiveWsSession } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tokenStore = vi.hoisted(() => ({
  getTokenBundle: vi.fn<(credentialRef: string, workspaceId?: string) => Promise<OAuth2TokenBundle | null>>(
    async () => null,
  ),
}));
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: [string, string?]) => tokenStore.getTokenBundle(...args),
}));

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-auth-1',
    path: 'requests/suite-col1/probe-auth1',
    name: 'Probe Auth',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const SCOPE: Record<string, string> = {
  token: 'tok-123',
  jwtSecret: 'oh-jwt-secret',
};

function scopedResolution(template: string, unresolved: Set<string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const value = SCOPE[name.trim()];
    if (value === undefined) {
      unresolved.add(name.trim());
      return whole;
    }
    return value;
  });
}

function scriptedTransport(): {
  transport: WsTransport;
  wire: () => WsTransportRequest;
  callbacks: () => WsSessionCallbacks;
  sent: string[];
} {
  let seenRequest: WsTransportRequest | null = null;
  let seenCallbacks: WsSessionCallbacks | null = null;
  const sent: string[] = [];
  return {
    transport: {
      connect(request, callbacks) {
        seenRequest = request;
        seenCallbacks = callbacks;
        return {
          send: (text) => sent.push(text),
          close: () => callbacks.onEnd(),
        };
      },
    },
    wire: () => {
      if (seenRequest === null) throw new Error('connect never reached the transport');
      return seenRequest;
    },
    callbacks: () => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      return seenCallbacks;
    },
    sent,
  };
}

const textFrame = (text: string): { data: Uint8Array; binary: boolean } => ({
  data: new TextEncoder().encode(text),
  binary: false,
});

async function settleTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** A signing credential mints through WebCrypto — real async work, so
 *  the wire is awaited rather than ticked. */
async function awaitWire(rig: { wire: () => WsTransportRequest }): Promise<WsTransportRequest> {
  await vi.waitFor(() => rig.wire());
  return rig.wire();
}

describe('executeWsSession — session credential', () => {
  it('injects the resolved bearer token as the Authorization handshake header', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '{{token}}' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-1',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onEnd();
    await settled;
  });

  it('lets an explicit user Authorization row take precedence over the credential', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        auth: { type: 'bearer', token: 'ignored' },
        headers: [{ uid: 'h1', key: 'Authorization', value: 'Basic abc' }],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-auth-2',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Basic abc' }]);
    rig.callbacks().onEnd();
    await settled;
  });

  it('reads an empty resolved token as none and gates an unresolved one as a structured error', async () => {
    const emptyRig = scriptedTransport();
    const emptySettled = executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '   ' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: emptyRig.transport,
      sendId: 'send-auth-3a',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(emptyRig.wire().headers).toEqual([]);
    emptyRig.callbacks().onEnd();
    await emptySettled;

    const unresolvedRig = scriptedTransport();
    const snapshot = await executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '{{missing}}' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: unresolvedRig.transport,
      sendId: 'send-auth-3b',
      resolution: scopedResolution,
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('missing');
  });

  it('lands the token as the socketio CONNECT auth payload alongside the header', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        flavor: 'socketio',
        url: 'ws://echo.openheaders.io',
        namespace: 'probe',
        auth: { type: 'bearer', token: '{{token}}' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-auth-4',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(rig.sent).toEqual(['40/probe,{"token":"tok-123"}']);
    rig.callbacks().onEnd();
    await settled;
  });

  it('sends the plain CONNECT when no credential is configured', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ flavor: 'socketio', url: 'ws://echo.openheaders.io' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-5',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(rig.sent).toEqual(['40']);
    rig.callbacks().onEnd();
    await settled;
  });
});

/** A one-entry collection pool the request inherits from. */
function chainWith(config: ConcreteAuthConfig, entryName = 'Gateway'): AuthCarrier[] {
  return [
    {
      level: 'collection',
      uid: 'rcol0001',
      name: 'Payments',
      auths: [{ uid: 'entry001', name: entryName, config }],
      defaultAuthUid: 'entry001',
    },
  ];
}

const OAUTH2: Extract<ConcreteAuthConfig, { type: 'oauth2' }> = {
  type: 'oauth2',
  credentialRef: 'oauth2-cred-abc12345',
  flow: 'client-credentials',
  tokenEndpoint: 'https://idp.openheaders.io/token',
  clientId: 'ws-client',
  scopes: [],
};

const bundle = (accessToken: string, expiresAt: number | null = null): OAuth2TokenBundle => ({
  accessToken,
  tokenType: 'Bearer',
  expiresAt,
  issuedAt: 0,
});

const JWT: Extract<ConcreteAuthConfig, { type: 'jwt' }> = {
  type: 'jwt',
  algorithm: 'HS256',
  secret: 'oh-jwt-secret',
  privateKey: '',
  payload: '{"sub":"ws-session"}',
  addTo: 'header',
  expiresInSeconds: 60,
};

const SIGV4: Extract<ConcreteAuthConfig, { type: 'aws-sigv4' }> = {
  type: 'aws-sigv4',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  service: '',
  region: '',
  addTo: 'query',
};

/** Verify an HS256 compact JWT under the secret; returns its claims. */
function verifyHs256(
  jwt: string,
  secret: string,
): { header: Record<string, unknown>; claims: Record<string, unknown> } {
  const [head, body, sig] = jwt.split('.');
  expect(createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')).toBe(sig);
  return {
    header: JSON.parse(Buffer.from(head, 'base64url').toString('utf8')),
    claims: JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
  };
}

const rfc3986 = (v: string): string =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Recompute a query-mode SigV4 signature over the SHIPPED URL and
 *  the shipped header rows — the AWS verifier's own steps, sharing no
 *  code with the signer. */
function recomputeSigV4(url: string, headers: ReadonlyArray<{ key: string; value: string }>): string {
  const parsed = new URL(url);
  const pairs: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    if (key !== 'X-Amz-Signature') pairs.push([rfc3986(key), rfc3986(value)]);
  });
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const canonicalHeaders = new Map<string, string>([['host', parsed.host]]);
  for (const h of headers) canonicalHeaders.set(h.key.toLowerCase(), h.value.trim());
  const names = [...canonicalHeaders.keys()].sort();
  const amzDate = parsed.searchParams.get('X-Amz-Date') ?? '';
  const scope = (parsed.searchParams.get('X-Amz-Credential') ?? '').split('/').slice(1).join('/');
  const [dateStamp, region, service] = scope.split('/');
  const canonicalRequest = [
    'GET',
    parsed.pathname,
    pairs.map(([k, v]) => `${k}=${v}`).join('&'),
    names.map((n) => `${n}:${canonicalHeaders.get(n)}\n`).join(''),
    names.join(';'),
    createHash('sha256').update('').digest('hex'),
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  let key: Buffer = createHmac('sha256', `AWS4${SIGV4.secretAccessKey}`).update(dateStamp).digest();
  for (const part of [region, service, 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
  return createHmac('sha256', key).update(stringToSign).digest('hex');
}

beforeEach(() => {
  tokenStore.getTokenBundle.mockReset();
  tokenStore.getTokenBundle.mockResolvedValue(null);
});

describe('executeWsSession — inherited session credential', () => {
  const BEARER_CHAIN = [
    {
      level: 'collection' as const,
      uid: 'rcol0001',
      name: 'Payments',
      auths: [{ uid: 'admin001', name: 'Admin token', config: { type: 'bearer' as const, token: '{{token}}' } }],
      defaultAuthUid: 'admin001',
    },
  ];

  it('resolves Inherit over the injected chain, injects the header and stamps the attribution', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-6',
      resolution: scopedResolution,
      authChain: BEARER_CHAIN,
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.auth).toEqual({
      type: 'bearer',
      source: {
        level: 'collection',
        uid: 'rcol0001',
        name: 'Payments',
        entryUid: 'admin001',
        entryName: 'Admin token',
      },
    });
  });

  it('composes an inherited Basic pair as the UTF-8 RFC 7617 header; a same-key user row still wins', async () => {
    const chain = [
      {
        level: 'collection' as const,
        uid: 'rcol0001',
        name: 'Payments',
        auths: [
          { uid: 'basic001', name: 'Service', config: { type: 'basic' as const, username: 'pä', password: 'ss' } },
        ],
        defaultAuthUid: 'basic001',
      },
    ];
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-7a',
      resolution: scopedResolution,
      authChain: chain,
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Basic cMOkOnNz' }]);
    rig.callbacks().onEnd();
    await settled;

    const rowRig = scriptedTransport();
    const rowSettled = executeWsSession(
      makeWsRequest({
        auth: { type: 'inherit' },
        headers: [{ uid: 'h1', key: 'Authorization', value: 'Basic abc' }],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rowRig.transport,
        sendId: 'send-auth-7b',
        resolution: scopedResolution,
        authChain: chain,
      },
    );
    await settleTick();
    expect(rowRig.wire().headers).toEqual([{ key: 'Authorization', value: 'Basic abc' }]);
    rowRig.callbacks().onEnd();
    await rowSettled;
  });

  it('an inherited api-key rides its own header; a query-placed key refuses by name', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-8a',
      resolution: scopedResolution,
      authChain: [
        {
          level: 'collection' as const,
          uid: 'rcol0001',
          name: 'Payments',
          auths: [
            {
              uid: 'key00001',
              name: 'Partner',
              config: { type: 'api-key' as const, key: 'X-Api-Key', value: '{{token}}', in: 'header' as const },
            },
          ],
          defaultAuthUid: 'key00001',
        },
      ],
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'X-Api-Key', value: 'tok-123' }]);
    rig.callbacks().onEnd();
    await settled;

    const queryRig = scriptedTransport();
    const querySettled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: queryRig.transport,
      sendId: 'send-auth-8b',
      resolution: scopedResolution,
      authChain: chainWith({ type: 'api-key', key: 'X-Api-Key', value: '{{token}}', in: 'query' }, 'Partner'),
    });
    await settleTick();
    // The handshake URL is a query leg — the key rides it, no header.
    expect(queryRig.wire().url).toBe('wss://echo.openheaders.io/live?X-Api-Key=tok-123');
    expect(queryRig.wire().headers).toEqual([]);
    queryRig.callbacks().onEnd();
    const snapshot = await querySettled;
    expect(snapshot.url).toBe('wss://echo.openheaders.io/live?X-Api-Key=tok-123');
    expect(snapshot.auth?.type).toBe('api-key');
  });

  it('an inherited OAuth 2.0 entry attaches the store bundle under the workspace pin; no bundle attaches nothing', async () => {
    tokenStore.getTokenBundle.mockResolvedValue(bundle('at-1'));
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: 'ws-pinned',
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-10a',
      resolution: scopedResolution,
      authChain: chainWith(OAUTH2, 'Corp SSO'),
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer at-1' }]);
    expect(tokenStore.getTokenBundle).toHaveBeenCalledWith('oauth2-cred-abc12345', 'ws-pinned');
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.requestHeaders).toEqual([{ key: 'Authorization', value: 'Bearer at-1' }]);
    expect(snapshot.auth).toEqual({
      type: 'oauth2',
      source: { level: 'collection', uid: 'rcol0001', name: 'Payments', entryUid: 'entry001', entryName: 'Corp SSO' },
    });

    tokenStore.getTokenBundle.mockResolvedValue(null);
    const bare = scriptedTransport();
    const bareSettled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: bare.transport,
      sendId: 'send-auth-10b',
      resolution: scopedResolution,
      authChain: chainWith(OAUTH2),
    });
    await settleTick();
    expect(bare.wire().headers).toEqual([]);
    expect(tokenStore.getTokenBundle).toHaveBeenLastCalledWith('oauth2-cred-abc12345', undefined);
    bare.callbacks().onEnd();
    await bareSettled;
  });

  it('a set Header Prefix wins the scheme; query mode rides access_token on the URL', async () => {
    tokenStore.getTokenBundle.mockResolvedValue(bundle('at-1'));
    const prefixed = scriptedTransport();
    const prefixedSettled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: prefixed.transport,
      sendId: 'send-auth-11a',
      resolution: scopedResolution,
      authChain: chainWith({ ...OAUTH2, headerPrefix: 'Token' }),
    });
    await settleTick();
    expect(prefixed.wire().headers).toEqual([{ key: 'Authorization', value: 'Token at-1' }]);
    prefixed.callbacks().onEnd();
    await prefixedSettled;

    const query = scriptedTransport();
    const querySettled = executeWsSession(
      makeWsRequest({ auth: { type: 'inherit' }, params: [{ uid: 'p1', key: 'room', value: 'a' }] }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: query.transport,
        sendId: 'send-auth-11b',
        resolution: scopedResolution,
        authChain: chainWith({ ...OAUTH2, sendAs: 'query' }),
      },
    );
    await settleTick();
    expect(query.wire().url).toBe('wss://echo.openheaders.io/live?room=a&access_token=at-1');
    expect(query.wire().headers).toEqual([]);
    query.callbacks().onEnd();
    await querySettled;
  });

  it('an expired renewable bundle renews through the host hook; without the hook the stale bundle attaches', async () => {
    tokenStore.getTokenBundle.mockResolvedValue(bundle('stale', 1_000));
    const refreshOAuth = vi.fn(async () => bundle('fresh'));
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-12a',
      resolution: scopedResolution,
      authChain: chainWith(OAUTH2),
      refreshOAuth,
    });
    await settleTick();
    expect(refreshOAuth).toHaveBeenCalledWith(OAUTH2);
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer fresh' }]);
    rig.callbacks().onEnd();
    await settled;

    const stale = scriptedTransport();
    const staleSettled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: stale.transport,
      sendId: 'send-auth-12b',
      resolution: scopedResolution,
      authChain: chainWith(OAUTH2),
    });
    await settleTick();
    expect(stale.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer stale' }]);
    stale.callbacks().onEnd();
    await staleSettled;
  });

  it('the socketio flavor lands an OAuth 2.0 or JWT token as the CONNECT auth payload too', async () => {
    tokenStore.getTokenBundle.mockResolvedValue(bundle('at-1'));
    const oauthRig = scriptedTransport();
    const oauthSettled = executeWsSession(
      makeWsRequest({
        flavor: 'socketio',
        url: 'ws://echo.openheaders.io',
        namespace: 'probe',
        auth: { type: 'inherit' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: oauthRig.transport,
        sendId: 'send-auth-13a',
        resolution: scopedResolution,
        authChain: chainWith(OAUTH2),
      },
    );
    await settleTick();
    oauthRig.callbacks().onOpen('', '');
    oauthRig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(oauthRig.sent).toEqual(['40/probe,{"token":"at-1"}']);
    oauthRig.callbacks().onEnd();
    await oauthSettled;

    const jwtRig = scriptedTransport();
    const jwtSettled = executeWsSession(
      makeWsRequest({
        flavor: 'socketio',
        url: 'ws://echo.openheaders.io',
        namespace: 'probe',
        auth: { type: 'inherit' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: jwtRig.transport,
        sendId: 'send-auth-13b',
        resolution: scopedResolution,
        authChain: chainWith({ ...JWT, addTo: 'query' }),
      },
    );
    await awaitWire(jwtRig);
    jwtRig.callbacks().onOpen('', '');
    jwtRig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    const token = new URL(jwtRig.wire().url).searchParams.get('token');
    expect(token).not.toBeNull();
    expect(jwtRig.sent).toEqual([`40/probe,${JSON.stringify({ token })}`]);
    jwtRig.callbacks().onEnd();
    await jwtSettled;
  });

  it('an inherited JWT Bearer mints a verifiable token at the dial — header mode, then query mode', async () => {
    const before = Math.floor(Date.now() / 1000);
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-14a',
      resolution: scopedResolution,
      authChain: chainWith({ ...JWT, secret: '{{jwtSecret}}' }),
    });
    await awaitWire(rig);
    const [header] = rig.wire().headers;
    expect(header.key).toBe('Authorization');
    expect(header.value.startsWith('Bearer ')).toBe(true);
    const { header: jose, claims } = verifyHs256(header.value.slice('Bearer '.length), 'oh-jwt-secret');
    expect(jose).toEqual({ typ: 'JWT', alg: 'HS256' });
    expect(claims.sub).toBe('ws-session');
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.exp).toBe((claims.iat as number) + 60);
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.auth?.type).toBe('jwt');

    const query = scriptedTransport();
    const querySettled = executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: query.transport,
      sendId: 'send-auth-14b',
      resolution: scopedResolution,
      authChain: chainWith({ ...JWT, addTo: 'query' }),
    });
    await awaitWire(query);
    expect(query.wire().headers).toEqual([]);
    const token = new URL(query.wire().url).searchParams.get('token') ?? '';
    expect(verifyHs256(token, 'oh-jwt-secret').claims.sub).toBe('ws-session');
    query.callbacks().onEnd();
    await querySettled;
  });

  it("a JWT payload that is not JSON settles the session with the signer's error, nothing on the wire", async () => {
    const rig = scriptedTransport();
    const snapshot = await executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-15',
      resolution: scopedResolution,
      authChain: chainWith({ ...JWT, payload: '{not json' }),
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toMatch(/^JWT Bearer signing failed: JWT payload is not valid JSON/);
    expect(() => rig.wire()).toThrow();
    expect(snapshot.auth?.type).toBe('jwt');
  });

  it('an inherited AWS signature in query mode re-signs the dial URL — host alone, then with the shipped rows', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        url: 'wss://abc123.execute-api.us-east-1.amazonaws.com/prod',
        params: [{ uid: 'p1', key: 'room', value: 'a b' }],
        auth: { type: 'inherit' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-auth-16a',
        resolution: scopedResolution,
        authChain: chainWith(SIGV4),
      },
    );
    await awaitWire(rig);
    const wire = rig.wire();
    expect(wire.headers).toEqual([]);
    const signedUrl = new URL(wire.url);
    expect(signedUrl.searchParams.get('room')).toBe('a b');
    expect(signedUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(signedUrl.searchParams.get('X-Amz-Credential')).toMatch(
      /^AKIDEXAMPLE\/\d{8}\/us-east-1\/execute-api\/aws4_request$/,
    );
    expect(signedUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(wire.url.split('&').at(-1)).toMatch(/^X-Amz-Signature=[0-9a-f]{64}$/);
    expect(signedUrl.searchParams.get('X-Amz-Signature')).toBe(recomputeSigV4(wire.url, []));
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.url).toBe(wire.url);
    expect(snapshot.auth?.type).toBe('aws-sigv4');

    const rows = scriptedTransport();
    const rowsSettled = executeWsSession(
      makeWsRequest({
        url: 'wss://abc123.execute-api.us-east-1.amazonaws.com/prod',
        headers: [{ uid: 'h1', key: 'X-Probe-Client', value: 'oh' }],
        auth: { type: 'inherit' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rows.transport,
        sendId: 'send-auth-16b',
        resolution: scopedResolution,
        authChain: chainWith(SIGV4),
      },
    );
    await awaitWire(rows);
    const rowsWire = rows.wire();
    expect(new URL(rowsWire.url).searchParams.get('X-Amz-SignedHeaders')).toBe('host;x-probe-client');
    expect(new URL(rowsWire.url).searchParams.get('X-Amz-Signature')).toBe(
      recomputeSigV4(rowsWire.url, rowsWire.headers),
    );
    rows.callbacks().onEnd();
    await rowsSettled;
  });

  it('an AWS signature in header mode and a DPoP-bound OAuth entry refuse by name — nothing on the wire', async () => {
    const headerRig = scriptedTransport();
    const headerSnapshot = await executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: headerRig.transport,
      sendId: 'send-auth-17a',
      resolution: scopedResolution,
      authChain: chainWith({ ...SIGV4, addTo: 'header' }),
    });
    if (headerSnapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(headerSnapshot.outcome.error).toBe(
      "Inherited AWS Signature v4 in header from Collection 'Payments' › Gateway cannot be applied to a WebSocket session.",
    );
    expect(() => headerRig.wire()).toThrow();

    const dpopRig = scriptedTransport();
    const dpopSnapshot = await executeWsSession(makeWsRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: dpopRig.transport,
      sendId: 'send-auth-17b',
      resolution: scopedResolution,
      authChain: chainWith({ ...OAUTH2, tokenBinding: 'dpop' }, 'Corp SSO'),
    });
    if (dpopSnapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(dpopSnapshot.outcome.error).toBe(
      "Inherited OAuth 2.0 bound to a DPoP key from Collection 'Payments' › Corp SSO cannot be applied to a WebSocket session.",
    );
    expect(() => dpopRig.wire()).toThrow();
    expect(tokenStore.getTokenBundle).not.toHaveBeenCalled();
    expect(dpopSnapshot.auth).toEqual({
      type: 'oauth2',
      source: { level: 'collection', uid: 'rcol0001', name: 'Payments', entryUid: 'entry001', entryName: 'Corp SSO' },
    });
  });
});

describe('executeWsSession — the credential mints per dial', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = () => vi.advanceTimersByTimeAsync(0);

  it("an auto-reconnect redials on the store's CURRENT token and restamps the handshake headers", async () => {
    tokenStore.getTokenBundle.mockResolvedValueOnce(bundle('at-1')).mockResolvedValueOnce(bundle('at-2'));
    const dials: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks }> = [];
    const transport: WsTransport = {
      connect(request, callbacks) {
        dials.push({ request, callbacks });
        return { send: () => {}, close: () => callbacks.onEnd() };
      },
    };
    const settled = executeWsSession(
      makeWsRequest({
        auth: { type: 'inherit' },
        autoReconnect: true,
        reconnectBackoff: false,
        reconnectPeriodMs: 1_000,
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport,
        sendId: 'send-auth-18',
        resolution: scopedResolution,
        authChain: chainWith(OAUTH2),
        reconnectJitter: () => 0,
      },
    );
    await tick();
    expect(dials).toHaveLength(1);
    expect(dials[0].request.headers).toEqual([{ key: 'Authorization', value: 'Bearer at-1' }]);
    dials[0].callbacks.onOpen('', '');
    // The socket drops under the open session — the loop redials on
    // the period, minting the credential again.
    dials[0].callbacks.onEnd();
    await tick();
    expect(dials).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(dials).toHaveLength(2);
    expect(dials[1].request.headers).toEqual([{ key: 'Authorization', value: 'Bearer at-2' }]);
    expect(tokenStore.getTokenBundle).toHaveBeenCalledTimes(2);
    dials[1].callbacks.onOpen('', '');
    closeActiveWsSession('send-auth-18');
    await tick();
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.requestHeaders).toEqual([{ key: 'Authorization', value: 'Bearer at-2' }]);
    expect(snapshot.lifecycle?.map((l) => l.kind)).toEqual(['lost', 'reconnecting', 'reconnected']);
  });
});
