/**
 * The device grant's three SW channels — thin seams over the oracle's
 * host-neutral runner with the browser transport injected: start
 * answers the pending state (or the step-tagged refusal), status reads
 * the registry, cancel reports whether a flow was there.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const runner = vi.hoisted(() => ({
  startDeviceFlow: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getDeviceFlowState: vi.fn<(...args: unknown[]) => unknown>(),
  cancelDeviceFlow: vi.fn<(...args: unknown[]) => boolean>(),
}));

vi.mock('@openheaders/oracle/live/request-exec/oauth-device', () => ({
  startDeviceFlow: runner.startDeviceFlow,
  getDeviceFlowState: runner.getDeviceFlowState,
  cancelDeviceFlow: runner.cancelDeviceFlow,
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

import { browserRequestTransport } from '@/background/modules/net/browser-request-transport';
import { oauthHandlers } from '@/background/modules/message-handler/handlers/oauth';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

const CONFIG = {
  type: 'oauth2',
  credentialRef: 'cred-1',
  flow: 'device-code',
  deviceAuthorizationEndpoint: 'https://auth.openheaders.io/device',
  tokenEndpoint: 'https://auth.openheaders.io/token',
  clientId: 'client-1',
  scopes: [],
};

const PENDING = {
  state: 'pending',
  approval: {
    userCode: 'OHDC-1234',
    verificationUri: 'https://auth.openheaders.io/activate',
    expiresAt: Date.now() + 600_000,
    intervalSeconds: 5,
  },
  startedAt: Date.now(),
};

function invoke(type: string, message: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const respond = vi.fn();
  oauthHandlers[type]({
    message: { type, ...message },
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
  for (const fn of Object.values(runner)) fn.mockReset();
});

describe('oauthDeviceStart', () => {
  it('runs the oracle runner over the browser transport and answers the pending state', async () => {
    runner.startDeviceFlow.mockResolvedValueOnce(PENDING);
    const respond = invoke('oauthDeviceStart', { config: CONFIG, workspaceId: 'ws-1' });
    await expect(settled(respond)).resolves.toEqual({ success: true, state: PENDING });
    expect(runner.startDeviceFlow).toHaveBeenCalledWith(CONFIG, 'ws-1', browserRequestTransport);
  });

  it('a runner failure answers success:false with its message', async () => {
    runner.startDeviceFlow.mockRejectedValueOnce(new Error('device_authorization: invalid_client'));
    const respond = invoke('oauthDeviceStart', { config: CONFIG });
    await expect(settled(respond)).resolves.toEqual({
      success: false,
      error: 'device_authorization: invalid_client',
    });
  });
});

describe('oauthDeviceStatus / oauthDeviceCancel', () => {
  it('status reads the registry for the credential and workspace', () => {
    runner.getDeviceFlowState.mockReturnValueOnce(PENDING);
    const respond = invoke('oauthDeviceStatus', { credentialRef: 'cred-1', workspaceId: 'ws-1' });
    expect(respond).toHaveBeenCalledWith({ state: PENDING });
    expect(runner.getDeviceFlowState).toHaveBeenCalledWith('cred-1', 'ws-1');
  });

  it('status without a credentialRef answers null and never reads', () => {
    const respond = invoke('oauthDeviceStatus', {});
    expect(respond).toHaveBeenCalledWith({ state: null });
    expect(runner.getDeviceFlowState).not.toHaveBeenCalled();
  });

  it('cancel reports whether a flow was there', () => {
    runner.cancelDeviceFlow.mockReturnValueOnce(true);
    expect(invoke('oauthDeviceCancel', { credentialRef: 'cred-1' })).toHaveBeenCalledWith({
      success: true,
      cancelled: true,
    });
    expect(runner.cancelDeviceFlow).toHaveBeenCalledWith('cred-1', undefined);
    expect(invoke('oauthDeviceCancel', {})).toHaveBeenCalledWith({ success: false, cancelled: false });
  });
});
