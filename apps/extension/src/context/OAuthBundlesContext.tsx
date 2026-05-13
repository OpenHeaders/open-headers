/**
 * OAuthBundlesContext — OAuth-bundle singleton-entity provider.
 *
 * Mirrors `VaultContext` / `PauseMarkersContext` (per MWPT-FULL § 8.3.10 —
 * singleton-with-storage-key baseline). The persisted OAuth blob (three
 * Records keyed by `credentialRef`: `tokens` / `configs` / `refreshErrors`)
 * is projected to `wsKeys(workspaceId).oauth` AND owned as a sync-engine
 * singleton entity (`OAUTH_BUNDLE_ENTITY_TYPE`). The cache writes the
 * storage key on every oracle broadcast (`oauth-bundle-cache.ts`); this
 * provider subscribes the storage key directly.
 *
 *   - Override branch: reads `wsKeys(workspaceId).oauth` via
 *     `extensionStorage.subscribe`; revoke routes through
 *     `oauth-bundle-write-client` with the explicit workspaceId.
 *     Browser-mediated flows (authorize / clientCredentials / refresh)
 *     stay on bridge RPCs but carry `workspaceId` through to the SW.
 *     Diverged tabs editing W2 see W2's bundles and persist back to W2.
 *   - Legacy branch: reads `wsKeys(useActiveWorkspaceId()).oauth`
 *     (re-binds on `workspaceChanged`); writes route the same way with
 *     the active workspace id.
 *
 * No § 4.1.c residual: every OAuth write is editing-scope by construction.
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { applyOAuthRevoke } from '@/shared/sync/oauth-bundle-write-client';

interface PersistedOAuthBlob {
  schemaVersion?: number;
  tokens?: Record<string, OAuth2TokenBundle>;
  configs?: Record<string, unknown>;
  refreshErrors?: Record<string, unknown>;
}

const EMPTY_TOKENS: Readonly<Record<string, OAuth2TokenBundle>> = Object.freeze({});

export interface OAuthAuthorizeResult {
  success: boolean;
  bundle?: OAuth2TokenBundle;
  redirectUri?: string;
  error?: string;
}

export interface OAuthFlowResult {
  success: boolean;
  bundle?: OAuth2TokenBundle;
  error?: string;
}

export interface OAuthBundlesContextValue {
  tokens: Readonly<Record<string, OAuth2TokenBundle>>;
  isReady: boolean;
  redirectUri: string | null;
  authorize: (config: OAuth2Auth) => Promise<OAuthAuthorizeResult>;
  clientCredentials: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  refresh: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  revoke: (credentialRef: string) => Promise<boolean>;
}

const defaultContextValue: OAuthBundlesContextValue = {
  tokens: EMPTY_TOKENS,
  isReady: false,
  redirectUri: null,
  authorize: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  clientCredentials: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  refresh: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  revoke: async () => false,
};

export const OAuthBundlesContext = createContext<OAuthBundlesContextValue>(defaultContextValue);

interface OAuthBundlesProviderProps {
  children: React.ReactNode;
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop
   * (BC-MWPT-FULL-1-oauth).
   */
  activeWorkspaceIdOverride?: string | null;
}

export const OAuthBundlesProvider: React.FC<OAuthBundlesProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const activeWorkspaceId = useActiveWorkspaceId();
  const readWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : activeWorkspaceId;
  const writeWorkspaceId = readWorkspaceId;

  const [tokens, setTokens] = useState<Readonly<Record<string, OAuth2TokenBundle>>>(EMPTY_TOKENS);
  const [isReady, setIsReady] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const readIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Subscribe `wsKeys(readWorkspaceId).oauth` directly. The
  // SW-side `oauth-bundle-cache.ts` writes that key on every oracle
  // broadcast; this listener is the renderer's read path.
  // chrome.storage.local.onChanged fires per-key — the override branch's
  // subscription is naturally scoped to its workspace.

  useEffect(() => {
    const wsId = readWorkspaceId;
    readIdRef.current = wsId;
    if (!wsId) {
      setTokens(EMPTY_TOKENS);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void extensionStorage.get(wsKeys(wsId).oauth).then((blob) => {
      if (readIdRef.current !== wsId) return;
      setTokens(extractTokens(blob));
      setIsReady(true);
    });
    return extensionStorage.subscribe(wsKeys(wsId).oauth, (blob) => {
      setTokens(extractTokens(blob));
    });
  }, [readWorkspaceId]);

  // ── Redirect URI (one-shot at mount) ──────────────────────────
  //
  // Stable across builds once the extension key is pinned; fetched
  // once per surface lifetime. The SW is the authoritative source so
  // popup / workspace agree on the value.

  useEffect(() => {
    let cancelled = false;
    void call('oauthGetRedirectUri')
      .then((resp) => {
        if (!cancelled) setRedirectUri(resp.redirectUri ?? null);
      })
      .catch(() => {
        // Surface stays null; the editor renders a placeholder.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Authorize / clientCredentials / refresh are SW-resident
  // (browser-mediated for authorize; SW-resident `fetch` for the
  // others). They thread `workspaceId` through the bridge so the
  // SW persists tokens against the editing-scope workspace.
  //
  // Revoke goes renderer-direct via Phase B — the SW dispatch on
  // `batch.mutations[0].workspaceId` (F-1) routes the apply to the
  // correct oracle.

  const authorize = useCallback<OAuthBundlesContextValue['authorize']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return call('oauthAuthorize', { config, workspaceId }).catch(
        (err: Error): OAuthAuthorizeResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const clientCredentials = useCallback<OAuthBundlesContextValue['clientCredentials']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return call('oauthClientCredentials', { config, workspaceId }).catch(
        (err: Error): OAuthFlowResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const refresh = useCallback<OAuthBundlesContextValue['refresh']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return call('oauthRefresh', { config, workspaceId }).catch(
        (err: Error): OAuthFlowResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const revoke = useCallback<OAuthBundlesContextValue['revoke']>(
    async (credentialRef) => {
      const wsId = writeWorkspaceId;
      if (!wsId) return false;
      const result = await applyOAuthRevoke({ credentialRef }, { workspaceId: wsId, surfaceId });
      return result.ok;
    },
    [writeWorkspaceId, surfaceId],
  );

  const value = useMemo<OAuthBundlesContextValue>(
    () => ({ tokens, isReady, redirectUri, authorize, clientCredentials, refresh, revoke }),
    [tokens, isReady, redirectUri, authorize, clientCredentials, refresh, revoke],
  );

  return <OAuthBundlesContext.Provider value={value}>{children}</OAuthBundlesContext.Provider>;
};

export function useOAuthBundlesContext(): OAuthBundlesContextValue {
  return useContext(OAuthBundlesContext);
}

function extractTokens(blob: unknown): Readonly<Record<string, OAuth2TokenBundle>> {
  if (!blob || typeof blob !== 'object') return EMPTY_TOKENS;
  const record = (blob as PersistedOAuthBlob).tokens;
  if (!record || typeof record !== 'object') return EMPTY_TOKENS;
  return record as Readonly<Record<string, OAuth2TokenBundle>>;
}
