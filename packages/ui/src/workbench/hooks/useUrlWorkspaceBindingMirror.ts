/**
 * useUrlWorkspaceBindingMirror — keeps the workbench tab's URL hash in
 * sync with its current editing-scope workspace binding.
 *
 * Two responsibilities:
 *
 *   1. **Mirror.** Whenever `editingScopeWorkspaceId` changes (in-tab
 *      switcher gesture, cross-workspace inheritance, runtime deletion
 *      of the bound workspace flipping to default), rewrite the URL via
 *      `history.replaceState` so the address bar and any future
 *      bookmark / tab-restore reflect the actual binding. Uses
 *      `boundIntentToHash` to preserve any intent already in the hash.
 *
 *   2. **Stale-URL fallback.** On mount, if the URL's `/ws/<wsId>/`
 *      prefix points at a workspace that doesn't exist (deleted while
 *      bookmarked), the resolver has already booted us on global active
 *      — we just need to replaceState the URL to match. The mirror in
 *      (1) handles this naturally once `editingScopeWorkspaceId`
 *      diverges from the URL's stale id.
 */

import { boundIntentToHash, hashToBoundIntent } from '@openheaders/core/workspace-intent';
import { useEffect } from 'react';

export function useUrlWorkspaceBindingMirror(editingScopeWorkspaceId: string | null): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!editingScopeWorkspaceId) return;
    const currentHash = window.location.hash;
    const bound = hashToBoundIntent(currentHash);
    // Preserve any intent already in the hash; default to open-workspace
    // when the tab was opened on the bare workbench URL.
    const intent = bound?.intent ?? { kind: 'open-workspace' };
    const desired = boundIntentToHash({ workspaceId: editingScopeWorkspaceId, intent });
    if (currentHash === desired) return;
    // replaceState (not pushState) — binding changes shouldn't pollute
    // browser history. Same behavior as Google Docs / Notion / Figma.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${desired}`);
  }, [editingScopeWorkspaceId]);
}
