/**
 * Rule draft handoff — builds a `RuleDraft` from an inspector request
 * entry, stashes it in the background via `createRuleDraft`, and
 * opens the workspace at `#/create/<type>/draft-<nonce>`.
 *
 * Only the header CTA is wired for v1; the other five rule types
 * render as placeholder buttons that call `openPlaceholderRuleDraft`
 * with a tooltip explaining the upcoming release.
 */

import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import type { InspectorRequest } from './types';

/** Build a RuleDraft for a header rule pre-filled from a request. */
export function buildHeaderDraftFromRequest(
  request: InspectorRequest,
  header: { direction: 'request' | 'response'; headerName: string; value?: string } | undefined,
): V5.HeaderRuleDraft {
  const method = request.method ? [request.method.toUpperCase()] : undefined;
  const base: V5.HeaderRuleDraft = {
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
 * Stash the draft in the background and open the workspace at the
 * matching `#/create/<type>/draft-<nonce>` route. The caller is
 * responsible for providing a well-formed draft; the background
 * re-validates through the valibot schema before minting the nonce.
 */
export async function handOffRuleDraft(draft: V5.RuleDraft): Promise<void> {
  const res = await call('createRuleDraft', { draft });
  if (!res.success || !res.nonce) {
    // Validation failure — surface to the user. In the panel this
    // translates to an AntD message; the caller wires the UX.
    throw new Error(res.error ?? 'Failed to create rule draft');
  }
  const workspaceUrl = chrome.runtime.getURL(`workspace.html#/create/${draft.type}/draft-${res.nonce}`);
  await chrome.tabs.create({ url: workspaceUrl, active: true });
}
