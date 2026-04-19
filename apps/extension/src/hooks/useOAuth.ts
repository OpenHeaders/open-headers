/**
 * useOAuth — renderer-side view of the SW-owned OAuth token store
 * (ARCHITECTURE §18). One bridge call at mount for the initial
 * snapshot, one `oauthTokensChanged` subscription that keeps every
 * surface in sync afterwards.
 *
 * Flow initiation (`authorize`, `clientCredentials`, `refresh`) +
 * revocation go through typed bridge RPCs. The SW owns
 * `chrome.identity.launchWebAuthFlow` so the user sees a single
 * coherent authorization window regardless of whether the click
 * originated in the workspace, the popup, or a devpanel surface.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';

export type OAuthAuthorizeResult = BridgeRpcResponse<'oauthAuthorize'>;
export type OAuthFlowResult = BridgeRpcResponse<'oauthClientCredentials'>;

export interface UseOAuthApi {
  tokens: Record<string, OAuth2TokenBundle>;
  isReady: boolean;
  redirectUri: string | null;
  authorize: (config: V5.OAuth2Auth) => Promise<OAuthAuthorizeResult>;
  clientCredentials: (config: V5.OAuth2Auth) => Promise<OAuthFlowResult>;
  refresh: (config: V5.OAuth2Auth) => Promise<OAuthFlowResult>;
  revoke: (credentialRef: string) => Promise<boolean>;
}

export function useOAuth(): UseOAuthApi {
  const [tokens, setTokens] = useState<Record<string, OAuth2TokenBundle>>({});
  const [isReady, setIsReady] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      const [tokensResp, redirectResp] = await Promise.all([
        call('listOAuthTokens').catch(() => null),
        call('oauthGetRedirectUri').catch(() => null),
      ]);
      if (cancelled) return;
      setTokens(tokensResp?.tokens ?? {});
      setRedirectUri(redirectResp?.redirectUri ?? null);
      setIsReady(true);
    };
    void loadInitial();

    const unsub = subscribe('oauthTokensChanged', (payload) => {
      setTokens(payload.tokens);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void loadInitial();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, []);

  const authorize = useCallback<UseOAuthApi['authorize']>(async (config) => {
    return call('oauthAuthorize', { config }).catch(
      (err: Error) => ({ success: false, error: err.message }) as OAuthAuthorizeResult,
    );
  }, []);

  const clientCredentials = useCallback<UseOAuthApi['clientCredentials']>(async (config) => {
    return call('oauthClientCredentials', { config }).catch(
      (err: Error) => ({ success: false, error: err.message }) as OAuthFlowResult,
    );
  }, []);

  const refresh = useCallback<UseOAuthApi['refresh']>(async (config) => {
    return call('oauthRefresh', { config }).catch(
      (err: Error) => ({ success: false, error: err.message }) as OAuthFlowResult,
    );
  }, []);

  const revoke = useCallback(async (credentialRef: string) => {
    const resp = await call('oauthRevoke', { credentialRef }).catch(() => null);
    return Boolean(resp?.removed);
  }, []);

  return { tokens, isReady, redirectUri, authorize, clientCredentials, refresh, revoke };
}
