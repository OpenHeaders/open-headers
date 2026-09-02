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
 *     `hostStorage.subscribe`; revoke routes through
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

import { useActiveWorkspaceId } from '../shared/hooks/readers/useActiveWorkspaceId';
import type { OAuth2DeviceState, OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import { applyOAuthRevoke } from '../shared/sync/oauth-bundle-write-client';

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

export interface OAuthDeviceStartResult {
  success: boolean;
  state?: OAuth2DeviceState;
  error?: string;
}

export interface OAuthBundlesContextValue {
  tokens: Readonly<Record<string, OAuth2TokenBundle>>;
  isReady: boolean;
  redirectUri: string | null;
  authorize: (config: OAuth2Auth) => Promise<OAuthAuthorizeResult>;
  clientCredentials: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  passwordCredentials: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  /** The JWT bearer grant (RFC 7523 §2.1) — the host signs the assertion. */
  jwtBearer: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  /**
   * The device grant (RFC 8628): `deviceStart` runs the device
   * authorization request and answers the pending state; the host
   * polls on its own, every transition landing in `deviceStates`
   * (keyed by credentialRef — the `oauthDeviceState` broadcast, with
   * the status RPC hydrating a late joiner); the grant lands in
   * `tokens` like every other flow. `deviceCancel` stops the poll.
   */
  deviceStart: (config: OAuth2Auth) => Promise<OAuthDeviceStartResult>;
  deviceCancel: (credentialRef: string) => Promise<boolean>;
  deviceStates: Readonly<Record<string, OAuth2DeviceState>>;
  refresh: (config: OAuth2Auth) => Promise<OAuthFlowResult>;
  revoke: (credentialRef: string) => Promise<boolean>;
}

const EMPTY_DEVICE_STATES: Readonly<Record<string, OAuth2DeviceState>> = Object.freeze({});

const defaultContextValue: OAuthBundlesContextValue = {
  tokens: EMPTY_TOKENS,
  isReady: false,
  redirectUri: null,
  authorize: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  clientCredentials: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  passwordCredentials: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  jwtBearer: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  deviceStart: async () => ({ success: false, error: 'OAuthBundlesProvider not mounted' }),
  deviceCancel: async () => false,
  deviceStates: EMPTY_DEVICE_STATES,
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
  const [deviceStates, setDeviceStates] = useState<Readonly<Record<string, OAuth2DeviceState>>>(EMPTY_DEVICE_STATES);
  const readIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Subscribe `wsKeys(readWorkspaceId).oauth` directly. The
  // SW-side `oauth-bundle-cache.ts` writes that key on every oracle
  // broadcast; this listener is the renderer's read path.
  // the host storage layer's change events fire per-key — the override branch's
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
    void hostStorage.get(wsKeys(wsId).oauth).then((blob) => {
      if (readIdRef.current !== wsId) return;
      setTokens(extractTokens(blob));
      setIsReady(true);
    });
    return hostStorage.subscribe(wsKeys(wsId).oauth, (blob) => {
      setTokens(extractTokens(blob));
    });
  }, [readWorkspaceId]);

  // ── Device grant transitions ──────────────────────────────────
  //
  // The host fans every device-flow transition out as a broadcast (the
  // full state; `null` clears). A flow started against the editing
  // workspace carries its id; one started against the host's active
  // workspace carries none — both belong to this provider's workspace.

  useEffect(() => {
    const wsId = readWorkspaceId;
    setDeviceStates(EMPTY_DEVICE_STATES);
    return hostBridge.subscribe('oauthDeviceState', (payload) => {
      if (payload.workspaceId !== undefined && payload.workspaceId !== wsId) return;
      setDeviceStates((prev) => {
        if (payload.state === null) {
          if (!(payload.credentialRef in prev)) return prev;
          const { [payload.credentialRef]: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, [payload.credentialRef]: payload.state };
      });
    });
  }, [readWorkspaceId]);

  // ── Redirect URI (one-shot at mount) ──────────────────────────
  //
  // Stable across builds once the extension key is pinned; fetched
  // once per surface lifetime. The SW is the authoritative source so
  // popup / workspace agree on the value.

  useEffect(() => {
    let cancelled = false;
    void hostBridge.call('oauthGetRedirectUri')
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
      return hostBridge.call('oauthAuthorize', { config, workspaceId }).catch(
        (err: Error): OAuthAuthorizeResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const clientCredentials = useCallback<OAuthBundlesContextValue['clientCredentials']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return hostBridge.call('oauthClientCredentials', { config, workspaceId }).catch(
        (err: Error): OAuthFlowResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const passwordCredentials = useCallback<OAuthBundlesContextValue['passwordCredentials']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return hostBridge.call('oauthPasswordCredentials', { config, workspaceId }).catch(
        (err: Error): OAuthFlowResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const jwtBearer = useCallback<OAuthBundlesContextValue['jwtBearer']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return hostBridge.call('oauthJwtBearer', { config, workspaceId }).catch(
        (err: Error): OAuthFlowResult => ({ success: false, error: err.message }),
      );
    },
    [writeWorkspaceId],
  );

  const deviceStart = useCallback<OAuthBundlesContextValue['deviceStart']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      const result = await hostBridge
        .call('oauthDeviceStart', { config, workspaceId })
        .catch((err: Error): OAuthDeviceStartResult => ({ success: false, error: err.message }));
      // The broadcast may have raced the RPC answer; the answer is the
      // authoritative pending state either way.
      if (result.success && result.state) {
        const state = result.state;
        setDeviceStates((prev) => ({ ...prev, [config.credentialRef]: state }));
      }
      return result;
    },
    [writeWorkspaceId],
  );

  const deviceCancel = useCallback<OAuthBundlesContextValue['deviceCancel']>(
    async (credentialRef) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      const result = await hostBridge
        .call('oauthDeviceCancel', { credentialRef, workspaceId })
        .catch((): { success: boolean; cancelled: boolean } => ({ success: false, cancelled: false }));
      setDeviceStates((prev) => {
        if (!(credentialRef in prev)) return prev;
        const { [credentialRef]: _drop, ...rest } = prev;
        return rest;
      });
      return result.cancelled;
    },
    [writeWorkspaceId],
  );

  const refresh = useCallback<OAuthBundlesContextValue['refresh']>(
    async (config) => {
      const workspaceId = writeWorkspaceId ?? undefined;
      return hostBridge.call('oauthRefresh', { config, workspaceId }).catch(
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
    () => ({
      tokens,
      isReady,
      redirectUri,
      authorize,
      clientCredentials,
      passwordCredentials,
      jwtBearer,
      deviceStart,
      deviceCancel,
      deviceStates,
      refresh,
      revoke,
    }),
    [
      tokens,
      isReady,
      redirectUri,
      authorize,
      clientCredentials,
      passwordCredentials,
      jwtBearer,
      deviceStart,
      deviceCancel,
      deviceStates,
      refresh,
      revoke,
    ],
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
