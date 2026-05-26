/**
 * Rule draft handoff — builds a `RuleDraft` from a lifecycle,
 * stashes it in the background via `createRuleDraft`, and opens the
 * workspace at `#/create/<type>/draft-<nonce>`.
 *
 * Only the header CTA is wired for v1; the other five rule types
 * render as placeholder buttons that call `openPlaceholderRuleDraft`
 * with a tooltip explaining the upcoming release.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type {
  BlockRuleDraft,
  DelayRuleDraft,
  HeaderRuleDraft,
  RedirectRuleDraft,
  RuleDraft,
} from '@openheaders/core/types';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';

const HOST_PLACEHOLDER = 'NEW_HOST';

/** Build a RuleDraft for a header rule pre-filled from a lifecycle. */
export function buildHeaderDraftFromRequest(
  lc: RequestLifecycle,
  header: { direction: 'request' | 'response'; headerName: string; value?: string } | undefined,
): HeaderRuleDraft {
  const method = lc.method ? [lc.method.toUpperCase()] : undefined;
  const base: HeaderRuleDraft = {
    type: 'header',
    url: lc.url,
    ...(method ? { requestMethods: method } : {}),
  };
  if (!header) return base;
  const mod = {
    operation: 'override' as const,
    headerName: header.headerName,
    value: header.value ?? '',
  };
  if (header.direction === 'request') {
    return { ...base, requestHeaders: [mod] };
  }
  return { ...base, responseHeaders: [mod] };
}

/** Build a draft for a redirect rule pointing at the SAME url — the
 *  editor's redirectTo field opens empty for the user to fill. */
export function buildRedirectDraftFromRequest(lc: RequestLifecycle): RedirectRuleDraft {
  return { type: 'redirect', url: lc.url, redirectTo: '' };
}

/** Build a "replace host" redirect — preserves path/query but swaps
 *  the host for a clearly-marked placeholder so the user only has to
 *  replace one chunk. */
export function buildReplaceHostDraftFromRequest(lc: RequestLifecycle): RedirectRuleDraft {
  let target = lc.url;
  try {
    const u = new URL(lc.url);
    u.host = HOST_PLACEHOLDER;
    target = u.toString();
  } catch {
    // leave target as-is for non-URL values
  }
  return { type: 'redirect', url: lc.url, redirectTo: target };
}

/** Build a "replace URL part" redirect — copies the URL into the target
 *  verbatim, so the user can edit any segment in place. */
export function buildReplaceUrlPartDraftFromRequest(lc: RequestLifecycle): RedirectRuleDraft {
  return { type: 'redirect', url: lc.url, redirectTo: lc.url };
}

export function buildDelayDraftFromRequest(lc: RequestLifecycle, delayMs = 1000): DelayRuleDraft {
  return { type: 'delay', url: lc.url, delayMs };
}

export function buildBlockDraftFromRequest(lc: RequestLifecycle): BlockRuleDraft {
  return { type: 'block', url: lc.url };
}

/**
 * Stash the draft in the background and dispatch a `create-rule` intent
 * to the workspace via the SW navigator. When a workspace tab is
 * already open, the navigator reuses it (same-window preference) and
 * delivers the intent via runtime messaging — the tab's intent router
 * fetches the stashed draft via `takeRuleDraft` and opens the editor
 * pre-filled. Otherwise a fresh workspace tab opens and its cold-path
 * router does the same via the URL-encoded intent.
 */
export async function handOffRuleDraft(draft: RuleDraft): Promise<void> {
  const res = await hostBridge.call('createRuleDraft', { draft });
  if (!res.success || !res.nonce) {
    throw new Error(res.error ?? 'Failed to create rule draft');
  }
  await openWorkspace({ kind: 'create-rule', ruleType: draft.type, draftNonce: res.nonce }, 'devpanel');
}
