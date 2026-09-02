/**
 * Authorization-server discovery over the transport — the candidate
 * walk (a miss moves on, a document answers, a foreign issuer refuses),
 * the GET's shape, and the refusals before any wire activity.
 */

import { describe, expect, it, vi } from 'vitest';
import { discoverAuthorizationServer } from '../../../src/live/request-exec/oauth-discovery';
import { OAuth2FlowError } from '../../../src/live/request-exec/oauth-exchange';
import type { RequestTransport, TransportRequest, TransportResponse } from '../../../src/live/request-exec/transport';

const ISSUER = 'https://auth.openheaders.io/realms/oh';
const OPENID_URL = `${ISSUER}/.well-known/openid-configuration`;
const RFC8414_URL = 'https://auth.openheaders.io/.well-known/oauth-authorization-server/realms/oh';

const DOCUMENT = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
  token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
  grant_types_supported: ['authorization_code', 'client_credentials'],
};

function response(body: string, status = 200, url = OPENID_URL): TransportResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    url,
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
  };
}

function makeTransport(answers: Record<string, TransportResponse>) {
  const send = vi.fn<(request: TransportRequest) => Promise<TransportResponse>>(async (request) => {
    const answer = answers[request.url];
    if (answer === undefined) return response('', 404, request.url);
    return answer;
  });
  const transport: RequestTransport = { send: (request) => send(request) };
  return { transport, send };
}

describe('discoverAuthorizationServer', () => {
  it('reads the OpenID form first with a JSON Accept, no body and no credentials', async () => {
    const { transport, send } = makeTransport({ [OPENID_URL]: response(JSON.stringify(DOCUMENT)) });
    const result = await discoverAuthorizationServer(ISSUER, transport);
    expect(result.url).toBe(OPENID_URL);
    expect(result.metadata.tokenEndpoint).toBe(`${ISSUER}/protocol/openid-connect/token`);
    expect(result.metadata.grantTypesSupported).toEqual(['authorization_code', 'client_credentials']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      url: OPENID_URL,
      headers: [{ key: 'Accept', value: 'application/json' }],
      body: { kind: 'none' },
      credentials: 'omit',
      redirect: 'follow',
    });
  });

  it('moves on from a 404 to the RFC 8414 inserted form', async () => {
    const { transport, send } = makeTransport({ [RFC8414_URL]: response(JSON.stringify(DOCUMENT), 200, RFC8414_URL) });
    const result = await discoverAuthorizationServer(ISSUER, transport);
    expect(result.url).toBe(RFC8414_URL);
    expect(send.mock.calls.map((c) => c[0].url)).toEqual([OPENID_URL, RFC8414_URL]);
  });

  it('moves on from a 2xx that is not a JSON object', async () => {
    const { transport } = makeTransport({
      [OPENID_URL]: response('<html>login</html>'),
      [RFC8414_URL]: response(JSON.stringify(DOCUMENT), 200, RFC8414_URL),
    });
    const result = await discoverAuthorizationServer(ISSUER, transport);
    expect(result.url).toBe(RFC8414_URL);
  });

  it('reads a pasted well-known URL verbatim first', async () => {
    const { transport, send } = makeTransport({ [OPENID_URL]: response(JSON.stringify(DOCUMENT)) });
    const result = await discoverAuthorizationServer(OPENID_URL, transport);
    expect(result.metadata.issuer).toBe(ISSUER);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses a document naming another issuer without walking further', async () => {
    const { transport, send } = makeTransport({
      [OPENID_URL]: response(JSON.stringify({ ...DOCUMENT, issuer: 'https://other.openheaders.io' })),
      [RFC8414_URL]: response(JSON.stringify(DOCUMENT), 200, RFC8414_URL),
    });
    const err = await discoverAuthorizationServer(ISSUER, transport).catch((e: Error) => e);
    expect(err).toBeInstanceOf(OAuth2FlowError);
    expect((err as OAuth2FlowError).step).toBe('discovery');
    expect((err as Error).message).toMatch(/names issuer "https:\/\/other.openheaders.io"/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('names the last answer when no candidate carries a document', async () => {
    const { transport, send } = makeTransport({});
    const err = await discoverAuthorizationServer(ISSUER, transport).catch((e: Error) => e);
    expect((err as OAuth2FlowError).step).toBe('discovery');
    expect((err as Error).message).toMatch(/no metadata document for https:\/\/auth.openheaders.io\/realms\/oh/);
    expect((err as Error).message).toMatch(/answered 404 Not Found/);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('refuses a non-URL before any wire activity', async () => {
    const { transport, send } = makeTransport({});
    const err = await discoverAuthorizationServer('auth.openheaders.io', transport).catch((e: Error) => e);
    expect((err as OAuth2FlowError).step).toBe('discovery');
    expect((err as Error).message).toMatch(/is not a URL/);
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a transport failure through as it is', async () => {
    const transport: RequestTransport = {
      send: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:1');
      },
    };
    await expect(discoverAuthorizationServer(ISSUER, transport)).rejects.toThrow(/ECONNREFUSED/);
  });
});
