/**
 * OAuth 2.0 / OIDC RPCs (Phase 13).
 *
 * Renderer reads tokens via `hostStorage.subscribe(wsKeys(ws).oauth)`
 * (MWPT-FULL § 8.3.10); the former `listOAuthTokens` RPC + broadcast were
 * deleted. These RPCs only run flows and revoke.
 */

import type { OAuth2Auth } from '@openheaders/core/types';
import { deleteTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import {
  getOAuthRedirectUri,
  launchAuthorizationCodeFlow,
  OAuth2FlowError,
  performClientCredentialsFlow,
  performPasswordCredentialsFlow,
  performRefresh,
} from '../../oauth-flow';
import type { HandlerMap } from '../types';

const flowError = (err: Error): string =>
  err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;

const workspaceIdOf = (message: Record<string, unknown>): string | undefined =>
  typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;

export const oauthHandlers: HandlerMap = {
  oauthAuthorize: ({ message, respond }) => {
    launchAuthorizationCodeFlow(message.config as OAuth2Auth, workspaceIdOf(message))
      .then((result) => respond({ success: true, bundle: result.bundle, redirectUri: result.redirectUri }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  oauthClientCredentials: ({ message, respond }) => {
    performClientCredentialsFlow(message.config as OAuth2Auth, workspaceIdOf(message))
      .then((bundle) => respond({ success: true, bundle }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  oauthPasswordCredentials: ({ message, respond }) => {
    performPasswordCredentialsFlow(message.config as OAuth2Auth, workspaceIdOf(message))
      .then((bundle) => respond({ success: true, bundle }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  oauthRefresh: ({ message, respond }) => {
    performRefresh(message.config as OAuth2Auth, workspaceIdOf(message))
      .then((bundle) => respond({ success: true, bundle }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  oauthRevoke: ({ message, respond }) => {
    const credentialRef = message.credentialRef as string;
    deleteTokenBundle(credentialRef, workspaceIdOf(message))
      .then((removed) => respond({ success: true, removed }))
      .catch((err: Error) => respond({ success: false, removed: false, error: err.message }));
    return true;
  },

  oauthGetRedirectUri: ({ respond }) => {
    respond({ redirectUri: getOAuthRedirectUri() });
    return true;
  },
};
