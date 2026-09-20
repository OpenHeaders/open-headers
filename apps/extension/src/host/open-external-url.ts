/**
 * `openExternalUrl` host impl — the capability body shared by the
 * standard capability install (`install-capabilities.ts`, popup /
 * panel / sidepanel) and the workbench's curated entry, which skips
 * that module for its popup-only RPCs and must register this one
 * itself (the server wizard's "Sign in on <host>" opens the server's
 * approval page through it from the workbench tab).
 *
 * External links route through the SW's existing `openTab` handler so
 * the new tab inherits the user's session / cookies / extension trust.
 * The `{ success, tabId? }` response is reshaped into the capability's
 * `{ ok, error? }` shape; a bridge failure folds to an honest refusal.
 */

import { hostBridge } from '@openheaders/core/bridge';

export function openExternalUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  return hostBridge
    .call('openTab', { url })
    .then((resp) => ({ ok: resp.success, error: resp.error }))
    .catch((err: Error) => ({ ok: false, error: err.message }));
}
