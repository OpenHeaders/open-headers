/**
 * Device Authorization Grant runner — the device authorization POST
 * through the bucket, the poll on the host timer at the provider's
 * cadence (outside the bucket), every §3.5 outcome settling the slot,
 * the change fan-out, cancel / supersede / status, the client-auth leg
 * on both POSTs, and the refusals before any wire activity.
 */

import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetDeviceFlowsForTests,
  cancelDeviceFlow,
  type DeviceFlowChange,
  getDeviceFlowState,
  onDeviceFlowChange,
  startDeviceFlow,
} from '../../../src/live/request-exec/oauth-device';
import { OAuth2FlowError } from '../../../src/live/request-exec/oauth-exchange';
import { __resetRateLimiterForTests, inspectRateLimiter } from '../../../src/live/request-exec/rate-limiter';
import type { RequestTransport, TransportRequest, TransportResponse } from '../../../src/live/request-exec/transport';

const store = vi.hoisted(() => ({
  putTokenBundle: vi.fn(async () => {}),
}));

vi.mock('../../../src/entity/oauth-token-store', () => ({
  putTokenBundle: (...args: unknown[]) => store.putTokenBundle(...(args as [])),
}));

const sendMock = vi.fn<(request: TransportRequest) => Promise<TransportResponse>>();
const transport: RequestTransport = { send: (request) => sendMock(request) };

const DEVICE_ENDPOINT = 'https://auth.openheaders.io/device';
const TOKEN_ENDPOINT = 'https://auth.openheaders.io/token';

function makeAuth(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'device-code',
    deviceAuthorizationEndpoint: DEVICE_ENDPOINT,
    tokenEndpoint: TOKEN_ENDPOINT,
    clientId: 'client-1',
    scopes: ['read'],
    ...overrides,
  };
}

function response(body: unknown, status = 200, url = TOKEN_ENDPOINT): TransportResponse {
  const text = JSON.stringify(body);
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    url,
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: text,
    bodyTruncated: false,
    bodyBytes: text.length,
  };
}

const DEVICE_RESPONSE = {
  device_code: 'dc-secret',
  user_code: 'OHDC-1234',
  verification_uri: 'https://auth.openheaders.io/activate',
  expires_in: 600,
  interval: 5,
};

const GRANT = { access_token: 'at-device', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt-device' };

function bodyFields(request: TransportRequest): Record<string, string> {
  if (request.body.kind !== 'urlencoded') throw new Error(`expected urlencoded body, got ${request.body.kind}`);
  return Object.fromEntries(request.body.fields.map((f) => [f.name, f.value]));
}

function header(request: TransportRequest, key: string): string | undefined {
  return request.headers.find((h) => h.key === key)?.value;
}

/** Let the timer fire and the poll's awaits settle. */
async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

let changes: DeviceFlowChange[];

beforeEach(() => {
  vi.useFakeTimers();
  __resetRateLimiterForTests();
  __resetDeviceFlowsForTests();
  sendMock.mockReset();
  store.putTokenBundle.mockReset();
  store.putTokenBundle.mockResolvedValue(undefined);
  changes = [];
  onDeviceFlowChange((change) => changes.push(change));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startDeviceFlow', () => {
  it('POSTs the device authorization request and answers the pending state without the device code', async () => {
    sendMock.mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT));
    const state = await startDeviceFlow(makeAuth(), 'ws-1', transport);
    expect(state).toMatchObject({
      state: 'pending',
      approval: {
        userCode: 'OHDC-1234',
        verificationUri: 'https://auth.openheaders.io/activate',
        intervalSeconds: 5,
      },
    });
    expect(JSON.stringify(state)).not.toContain('dc-secret');
    const request = sendMock.mock.calls[0]![0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe(DEVICE_ENDPOINT);
    expect(bodyFields(request)).toEqual({ client_id: 'client-1', scope: 'read' });
    expect(header(request, 'Accept')).toBe('application/json');
    expect(getDeviceFlowState('cred-1', 'ws-1')).toEqual(state);
    expect(changes).toEqual([{ workspaceId: 'ws-1', credentialRef: 'cred-1', state }]);
    // The one token-plane POST of the flow paid into the bucket.
    expect(inspectRateLimiter('https://auth.openheaders.io')?.recentStartsInMinute).toBe(1);
  });

  it('carries the client-auth leg on the device authorization POST (basic header)', async () => {
    sendMock.mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT));
    await startDeviceFlow(
      makeAuth({ clientSecret: 'secret-1', clientAuthentication: 'basic-header' }),
      undefined,
      transport,
    );
    const request = sendMock.mock.calls[0]![0];
    expect(bodyFields(request)).toEqual({ scope: 'read' });
    expect(header(request, 'Authorization')).toBe(`Basic ${Buffer.from('client-1:secret-1').toString('base64')}`);
  });

  it('refuses another flow and a missing device endpoint before any wire activity', async () => {
    await expect(startDeviceFlow(makeAuth({ flow: 'client-credentials' }), undefined, transport)).rejects.toMatchObject(
      { step: 'precondition' },
    );
    await expect(
      startDeviceFlow(makeAuth({ deviceAuthorizationEndpoint: '  ' }), undefined, transport),
    ).rejects.toMatchObject({ step: 'precondition', message: expect.stringContaining('deviceAuthorizationEndpoint') });
    expect(sendMock).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  it('a refused or malformed device authorization is the step error and parks nothing', async () => {
    sendMock.mockResolvedValueOnce(response({ error: 'invalid_client' }, 401, DEVICE_ENDPOINT));
    await expect(startDeviceFlow(makeAuth(), undefined, transport)).rejects.toMatchObject({
      step: 'device_authorization',
      message: expect.stringContaining('401'),
    });
    sendMock.mockResolvedValueOnce(response({ user_code: 'X' }, 200, DEVICE_ENDPOINT));
    const err = await startDeviceFlow(makeAuth(), undefined, transport).catch((e: Error) => e);
    expect(err).toBeInstanceOf(OAuth2FlowError);
    expect((err as Error).message).toMatch(/device_code/);
    expect(getDeviceFlowState('cred-1', undefined)).toBeNull();
    expect(changes).toEqual([]);
  });
});

describe('the poll', () => {
  it('waits the interval, honors slow_down, grants on the token response and persists the bundle', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response({ error: 'authorization_pending' }, 400))
      .mockResolvedValueOnce(response({ error: 'slow_down' }, 400))
      .mockResolvedValueOnce(response(GRANT));
    const auth = makeAuth({ clientSecret: 'secret-1' });
    await startDeviceFlow(auth, 'ws-1', transport);
    expect(sendMock).toHaveBeenCalledTimes(1);

    await tick(4999);
    expect(sendMock).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const poll = sendMock.mock.calls[1]![0];
    expect(poll.url).toBe(TOKEN_ENDPOINT);
    expect(bodyFields(poll)).toEqual({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'dc-secret',
      client_id: 'client-1',
      client_secret: 'secret-1',
    });

    // slow_down: the next poll waits ten seconds, and the pending state
    // re-announces the grown interval.
    await tick(5000);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(changes.at(-1)).toMatchObject({ state: { state: 'pending', approval: { intervalSeconds: 10 } } });
    await tick(5000);
    expect(sendMock).toHaveBeenCalledTimes(3);
    await tick(5000);
    expect(sendMock).toHaveBeenCalledTimes(4);

    expect(store.putTokenBundle).toHaveBeenCalledWith(
      'cred-1',
      expect.objectContaining({ accessToken: 'at-device', refreshToken: 'rt-device' }),
      auth,
      'ws-1',
    );
    expect(getDeviceFlowState('cred-1', 'ws-1')).toMatchObject({ state: 'granted' });
    expect(changes.at(-1)).toMatchObject({ workspaceId: 'ws-1', credentialRef: 'cred-1', state: { state: 'granted' } });
    // Polls never paid into the bucket: still the one device POST.
    expect(inspectRateLimiter('https://auth.openheaders.io')?.recentStartsInMinute).toBe(1);
    // A settled slot polls no more.
    await tick(60_000);
    expect(sendMock).toHaveBeenCalledTimes(4);
  });

  it('access_denied settles the slot as denied with the provider wording and stores nothing', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response({ error: 'access_denied', error_description: 'declined' }, 400));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(getDeviceFlowState('cred-1', undefined)).toEqual({
      state: 'denied',
      message: 'access_denied: declined',
    });
    expect(store.putTokenBundle).not.toHaveBeenCalled();
    await tick(60_000);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('expired_token, and a wait past expires_in, settle the slot as expired', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response({ error: 'expired_token' }, 400));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(getDeviceFlowState('cred-1', undefined)).toMatchObject({ state: 'expired' });

    __resetDeviceFlowsForTests();
    onDeviceFlowChange((change) => changes.push(change));
    sendMock
      .mockResolvedValueOnce(response({ ...DEVICE_RESPONSE, expires_in: 7 }, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response({ error: 'authorization_pending' }, 400));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    // The next wait (5 s) would land at 10 s, past the 7 s expiry.
    expect(getDeviceFlowState('cred-1', undefined)).toMatchObject({
      state: 'expired',
      message: expect.stringContaining('expired'),
    });
    expect(sendMock).toHaveBeenCalledTimes(4);
  });

  it('a transport failure mid-poll fails the flow with the host message', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockRejectedValueOnce(new Error('ECONNRESET'));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(getDeviceFlowState('cred-1', undefined)).toEqual({ state: 'failed', message: 'ECONNRESET' });
  });

  it('an unknown refusal fails the flow with the status and the provider words', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response({ error: 'invalid_grant', error_description: 'bad device code' }, 400));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(getDeviceFlowState('cred-1', undefined)).toEqual({
      state: 'failed',
      message: 'Token endpoint returned 400: invalid_grant: bad device code',
    });
  });

  it('a store failure on the grant fails the flow by name', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response(GRANT));
    store.putTokenBundle.mockRejectedValueOnce(new Error('disk full'));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(getDeviceFlowState('cred-1', undefined)).toEqual({
      state: 'failed',
      message: 'Could not store the token: disk full',
    });
  });

  it('carries the extra token params and the Basic header on every poll', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response(GRANT));
    await startDeviceFlow(
      makeAuth({
        clientSecret: 'secret-1',
        clientAuthentication: 'basic-header',
        extraTokenParams: [
          { uid: 'x1', key: 'audience', value: 'api.openheaders.io' },
          { uid: 'x2', key: 'X-Tenant', value: 't1', sendIn: 'header' },
          { uid: 'x3', key: 'resource', value: 'r1', sendIn: 'url' },
        ],
      }),
      undefined,
      transport,
    );
    await tick(5000);
    const poll = sendMock.mock.calls[1]![0];
    expect(poll.url).toBe(`${TOKEN_ENDPOINT}?resource=r1`);
    expect(bodyFields(poll)).toEqual({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'dc-secret',
      audience: 'api.openheaders.io',
    });
    expect(header(poll, 'X-Tenant')).toBe('t1');
    expect(header(poll, 'Authorization')).toBe(`Basic ${Buffer.from('client-1:secret-1').toString('base64')}`);
  });
});

describe('cancel / supersede / status', () => {
  it('cancel stops the poll, clears the slot and fans out null', async () => {
    sendMock.mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT));
    await startDeviceFlow(makeAuth(), 'ws-1', transport);
    expect(cancelDeviceFlow('cred-1', 'ws-1')).toBe(true);
    expect(getDeviceFlowState('cred-1', 'ws-1')).toBeNull();
    expect(changes.at(-1)).toEqual({ workspaceId: 'ws-1', credentialRef: 'cred-1', state: null });
    await tick(60_000);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(cancelDeviceFlow('cred-1', 'ws-1')).toBe(false);
  });

  it('a restart supersedes the pending flow: the old timer never polls, the new one does', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(
        response({ ...DEVICE_RESPONSE, user_code: 'OHDC-9999', interval: 2 }, 200, DEVICE_ENDPOINT),
      )
      .mockResolvedValueOnce(response(GRANT));
    await startDeviceFlow(makeAuth(), undefined, transport);
    const second = await startDeviceFlow(makeAuth(), undefined, transport);
    expect(second).toMatchObject({ state: 'pending', approval: { userCode: 'OHDC-9999' } });
    await tick(2000);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(getDeviceFlowState('cred-1', undefined)).toMatchObject({ state: 'granted' });
    await tick(10_000);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('a cancel that lands while a poll is in flight discards the poll outcome', async () => {
    let release: (value: TransportResponse) => void = () => {};
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockImplementationOnce(() => new Promise<TransportResponse>((resolve) => (release = resolve)));
    await startDeviceFlow(makeAuth(), undefined, transport);
    await tick(5000);
    expect(sendMock).toHaveBeenCalledTimes(2);
    cancelDeviceFlow('cred-1', undefined);
    release(response(GRANT));
    await tick(0);
    expect(store.putTokenBundle).not.toHaveBeenCalled();
    expect(getDeviceFlowState('cred-1', undefined)).toBeNull();
  });

  it('keys one flow per workspace and credential', async () => {
    sendMock
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT))
      .mockResolvedValueOnce(response(DEVICE_RESPONSE, 200, DEVICE_ENDPOINT));
    await startDeviceFlow(makeAuth(), 'ws-1', transport);
    await startDeviceFlow(makeAuth({ credentialRef: 'cred-2' }), 'ws-1', transport);
    expect(getDeviceFlowState('cred-1', 'ws-1')).toMatchObject({ state: 'pending' });
    expect(getDeviceFlowState('cred-2', 'ws-1')).toMatchObject({ state: 'pending' });
    expect(getDeviceFlowState('cred-1', 'ws-2')).toBeNull();
  });
});
