/**
 * The discovery SW channel — a thin seam over the oracle's host-neutral
 * metadata walk with the browser transport injected: the document and
 * its URL on success, the step-tagged refusal otherwise, nothing stored.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const runner = vi.hoisted(() => ({
  discoverAuthorizationServer: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@openheaders/oracle/live/request-exec/oauth-discovery', () => ({
  discoverAuthorizationServer: runner.discoverAuthorizationServer,
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-device', () => ({
  startDeviceFlow: vi.fn(),
  getDeviceFlowState: vi.fn(),
  cancelDeviceFlow: vi.fn(),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  deleteTokenBundle: vi.fn(),
}));
vi.mock('@/background/modules/oauth-flow', () => ({
  OAuth2FlowError: class OAuth2FlowError extends Error {
    readonly step: string;
    constructor(step: string, message: string) {
      super(message);
      this.step = step;
    }
  },
}));

import { oauthHandlers } from '@/background/modules/message-handler/handlers/oauth';
import type { HandlerArgs } from '@/background/modules/message-handler/types';
import { browserRequestTransport } from '@/background/modules/net/browser-request-transport';
import { OAuth2FlowError } from '@/background/modules/oauth-flow';

const METADATA = {
  issuer: 'https://auth.openheaders.io',
  authorizationEndpoint: 'https://auth.openheaders.io/authorize',
  tokenEndpoint: 'https://auth.openheaders.io/token',
};

function invoke(message: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const respond = vi.fn();
  oauthHandlers.oauthDiscover({
    message: { type: 'oauthDiscover', ...message },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  return respond;
}

async function settled(respond: ReturnType<typeof vi.fn>): Promise<unknown> {
  await vi.waitFor(() => expect(respond).toHaveBeenCalled());
  return respond.mock.calls[0][0];
}

beforeEach(() => {
  runner.discoverAuthorizationServer.mockReset();
});

describe('oauthDiscover', () => {
  it('runs the oracle walk over the browser transport and answers the document and its URL', async () => {
    runner.discoverAuthorizationServer.mockResolvedValueOnce({
      metadata: METADATA,
      url: 'https://auth.openheaders.io/.well-known/openid-configuration',
    });
    const respond = invoke({ input: 'https://auth.openheaders.io' });
    await expect(settled(respond)).resolves.toEqual({
      success: true,
      metadata: METADATA,
      url: 'https://auth.openheaders.io/.well-known/openid-configuration',
    });
    expect(runner.discoverAuthorizationServer).toHaveBeenCalledWith(
      'https://auth.openheaders.io',
      browserRequestTransport,
    );
  });

  it('a step-tagged refusal answers success:false with the step named', async () => {
    runner.discoverAuthorizationServer.mockRejectedValueOnce(
      new OAuth2FlowError('discovery', 'no metadata document for https://auth.openheaders.io'),
    );
    const respond = invoke({ input: 'https://auth.openheaders.io' });
    await expect(settled(respond)).resolves.toEqual({
      success: false,
      error: 'discovery: no metadata document for https://auth.openheaders.io',
    });
  });

  it('a missing input reaches the walk as an empty string', async () => {
    runner.discoverAuthorizationServer.mockRejectedValueOnce(new Error('"" is not a URL'));
    const respond = invoke({});
    await expect(settled(respond)).resolves.toEqual({ success: false, error: '"" is not a URL' });
    expect(runner.discoverAuthorizationServer).toHaveBeenCalledWith('', browserRequestTransport);
  });
});
