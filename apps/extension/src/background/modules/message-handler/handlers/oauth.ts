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
  cancelDeviceFlow,
  getDeviceFlowState,
  startDeviceFlow,
} from '@openheaders/oracle/live/request-exec/oauth-device';
import { browserRequestTransport } from '../../net/browser-request-transport';
import {
  getOAuthRedirectUri,
  launchAuthorizationCodeFlow,
  OAuth2FlowError,
  performClientCredentialsFlow,
  performJwtBearerFlow,
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

  oauthJwtBearer: ({ message, respond }) => {
    performJwtBearerFlow(message.config as OAuth2Auth, workspaceIdOf(message))
      .then((bundle) => respond({ success: true, bundle }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  // The device grant is the oracle's host-neutral runner over the
  // browser transport — no SW twin: the poll's timer and its fetches
  // live in the SW, the transitions reach the surfaces on the
  // `oauthDeviceState` broadcast the bootstrap wires.
  oauthDeviceStart: ({ message, respond }) => {
    startDeviceFlow(message.config as OAuth2Auth, workspaceIdOf(message), browserRequestTransport)
      .then((state) => respond({ success: true, state }))
      .catch((err: Error) => respond({ success: false, error: flowError(err) }));
    return true;
  },

  oauthDeviceStatus: ({ message, respond }) => {
    const credentialRef = message.credentialRef as string;
    respond({ state: credentialRef ? getDeviceFlowState(credentialRef, workspaceIdOf(message)) : null });
    return true;
  },

  oauthDeviceCancel: ({ message, respond }) => {
    const credentialRef = message.credentialRef as string;
    if (!credentialRef) {
      respond({ success: false, cancelled: false });
      return true;
    }
    respond({ success: true, cancelled: cancelDeviceFlow(credentialRef, workspaceIdOf(message)) });
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
