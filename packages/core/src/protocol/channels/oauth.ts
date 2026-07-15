/**
 * OAuth 2.0 / OIDC bridge RPCs (Phase 13 — ARCHITECTURE §18).
 *
 * Reads: renderer subscribes `wsKeys(workspaceId).oauth` directly
 * (singleton-with-storage-key, matches Vault / PauseMarkers). Browser-
 * mediated flows stay on bridge RPCs because they need SW-resident
 * `chrome.identity` / `fetch`. Each carries `workspaceId?: string` so
 * the editing-scope workspace surfaces through to `putTokenBundle`.
 */

import type { OAuth2TokenBundle } from '../../oauth';
import type { OAuth2Auth } from '../../types';

export interface OAuthRpc {
  /**
   * Run the full Authorization Code + PKCE flow for the given OAuth
   * config. On success the token bundle is persisted and the returned
   * bundle reflects the fresh state; on failure a descriptive message
   * surfaces so the UI can toast the user (expired provider cert,
   * misconfigured redirect, user cancelled, etc.).
   */
  oauthAuthorize: {
    req: { config: OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; redirectUri?: string; error?: string };
  };
  /**
   * Trigger a client-credentials token fetch for the given config.
   * Used by machine-to-machine auth configurations where no user
   * interaction is required.
   */
  oauthClientCredentials: {
    req: { config: OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /**
   * Trigger a resource-owner password token fetch for the given
   * config (RFC 6749 §4.3). No browser leg — the SW POSTs the stored
   * username + password straight to the token endpoint.
   */
  oauthPasswordCredentials: {
    req: { config: OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /**
   * Force a refresh of the stored token for the given config. Useful
   * when the user wants to proactively rotate the access token or
   * diagnose refresh failures from the editor.
   */
  oauthRefresh: {
    req: { config: OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /** Delete the stored token bundle for `credentialRef`. "Disconnect" flow. */
  oauthRevoke: {
    req: { credentialRef: string; workspaceId?: string };
    res: { success: boolean; removed: boolean };
  };
  /**
   * Canonical redirect URI for this extension build. Shown in the
   * AuthEditor so users paste the right value into the provider's
   * allow-list. Stable across builds once the extension `key` is
   * pinned (Phase 1). The SW is the authoritative source — different
   * surfaces (popup / workspace) both read from here rather than
   * recomputing against `chrome.identity.getRedirectURL()` locally.
   */
  oauthGetRedirectUri: {
    req: Record<string, never>;
    res: { redirectUri: string };
  };
}
