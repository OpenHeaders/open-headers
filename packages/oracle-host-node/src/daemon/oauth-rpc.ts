/**
 * OAuth 2.0 RPC plane — the node hosts' answer to the seven `oauth*`
 * channels the shared Authorization editor calls (the extension SW
 * serves the same seven from `handlers/oauth.ts`): token acquisition
 * per flow, refresh, revoke, and the registered redirect URI.
 *
 * Everything but the browser hop is the oracle's host-neutral flows
 * over the spine's transport; the authorization-code leg needs a user
 * agent, so the host injects a {@link AuthorizationLauncher} — the
 * desktop opens the system browser and the loopback callback route
 * collects the redirect; a headless daemon injects none and the
 * authorize channel answers an honest refusal.
 *
 * Local plane only: the renderer reaches it through the spine's
 * `dispatchRpc`; WS peers do not mint tokens on this host.
 */

import type { OAuth2Auth } from '@openheaders/core/types';
import { deleteTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { OAuth2FlowError } from '@openheaders/oracle/live/request-exec/oauth-exchange';
import {
  type AuthorizationLauncher,
  performAuthorizationCodeFlow,
  performClientCredentialsFlow,
  performJwtBearerFlow,
  performPasswordCredentialsFlow,
} from '@openheaders/oracle/live/request-exec/oauth-flows';
import { performRefresh } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';

export const OAUTH_RPC_CHANNELS = [
  'oauthAuthorize',
  'oauthClientCredentials',
  'oauthPasswordCredentials',
  'oauthJwtBearer',
  'oauthRefresh',
  'oauthRevoke',
  'oauthGetRedirectUri',
] as const;

export type OAuthRpcChannel = (typeof OAUTH_RPC_CHANNELS)[number];

export interface OAuthRpcOptions {
  transport: RequestTransport;
  /** The loopback redirect URI for the bound port — read per call so a rebind is reflected. */
  redirectUri: () => string;
  /** Absent on hosts without a user agent (a headless daemon). */
  launchAuthorization: AuthorizationLauncher | null;
}

export interface OAuthRpc {
  owns(type: unknown): type is OAuthRpcChannel;
  dispatch(type: OAuthRpcChannel, message: Record<string, unknown>): Promise<unknown>;
}

const NO_BROWSER =
  'authorize: this host has no browser to open the provider sign-in page — run the authorization from the desktop app or the extension';

const flowError = (err: Error): string =>
  err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;

const workspaceIdOf = (message: Record<string, unknown>): string | undefined =>
  typeof message.workspaceId === 'string' ? message.workspaceId : undefined;

export function createOAuthRpc(options: OAuthRpcOptions): OAuthRpc {
  const { transport } = options;
  const channels: ReadonlySet<string> = new Set(OAUTH_RPC_CHANNELS);

  const bundleResponse = (work: Promise<unknown>) =>
    work
      .then((bundle) => ({ success: true, bundle }))
      .catch((err: Error) => ({ success: false, error: flowError(err) }));

  return {
    owns(type): type is OAuthRpcChannel {
      return typeof type === 'string' && channels.has(type);
    },
    async dispatch(type, message) {
      const config = message.config as OAuth2Auth;
      const workspaceId = workspaceIdOf(message);
      switch (type) {
        case 'oauthGetRedirectUri':
          return { redirectUri: options.redirectUri() };
        case 'oauthAuthorize': {
          const launch = options.launchAuthorization;
          if (launch === null) return { success: false, error: NO_BROWSER };
          return performAuthorizationCodeFlow(config, workspaceId, transport, {
            redirectUri: options.redirectUri(),
            launch,
          })
            .then((result) => ({ success: true, bundle: result.bundle, redirectUri: result.redirectUri }))
            .catch((err: Error) => ({ success: false, error: flowError(err) }));
        }
        case 'oauthClientCredentials':
          return bundleResponse(performClientCredentialsFlow(config, workspaceId, transport));
        case 'oauthPasswordCredentials':
          return bundleResponse(performPasswordCredentialsFlow(config, workspaceId, transport));
        case 'oauthJwtBearer':
          return bundleResponse(performJwtBearerFlow(config, workspaceId, transport));
        case 'oauthRefresh':
          return bundleResponse(performRefresh(config, workspaceId, transport));
        case 'oauthRevoke': {
          const credentialRef = typeof message.credentialRef === 'string' ? message.credentialRef : '';
          if (!credentialRef) return { success: false, removed: false, error: 'missing credentialRef' };
          return deleteTokenBundle(credentialRef, workspaceId)
            .then((removed) => ({ success: true, removed }))
            .catch((err: Error) => ({ success: false, removed: false, error: err.message }));
        }
      }
    },
  };
}
