/**
 * Rule draft handoff — builds a `RuleDraft` from an inspector request
 * entry, stashes it in the background via `createRuleDraft`, and
 * opens the workspace at `#/create/<type>/draft-<nonce>`.
 *
 * Only the header CTA is wired for v1; the other five rule types
 * render as placeholder buttons that call `openPlaceholderRuleDraft`
 * with a tooltip explaining the upcoming release.
 */

import type { HeaderRuleDraft, RuleDraft } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import type { InspectorRequest } from './types';

/** Build a RuleDraft for a header rule pre-filled from a request. */
export function buildHeaderDraftFromRequest(
  request: InspectorRequest,
  header: { direction: 'request' | 'response'; headerName: string; value?: string } | undefined,
): HeaderRuleDraft {
  const method = request.method ? [request.method.toUpperCase()] : undefined;
  const base: HeaderRuleDraft = {
    type: 'header',
    url: request.url,
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
  const res = await call('createRuleDraft', { draft });
  if (!res.success || !res.nonce) {
    // Validation failure — surface to the user. In the panel this
    // translates to an AntD message; the caller wires the UX.
    throw new Error(res.error ?? 'Failed to create rule draft');
  }
  await openWorkspace({ kind: 'create-rule', ruleType: draft.type, draftNonce: res.nonce }, 'devpanel');
}
