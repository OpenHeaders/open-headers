/**
 * The server's own page for a joined Org — the address of the backend
 * record the Org is bound to, as an http origin. Where a person sees
 * what they hold on that server and an admin grants: the zero-grant
 * banner and the switcher's empty group both point there. Null where
 * the binding has no record (the web tab's serving daemon — that tab
 * IS the page) or the address is not a WebSocket URL.
 */

import { getBackend } from '@openheaders/core/backends';
import { getCapability } from '@openheaders/core/capabilities';
import { getOrgBackendBindings, wsUrlToHttpOrigin } from '@openheaders/core/identity';

export function serverPageForOrg(orgId: string): string | null {
  const backendId = getOrgBackendBindings().get(orgId);
  const record = backendId === undefined ? null : getBackend(backendId);
  return record === null ? null : wsUrlToHttpOrigin(record.url);
}

/** Open the page outside the app — a new tab, the system browser — through the host's opener. */
export function openServerPage(url: string): void {
  void getCapability('openExternalUrl')?.(url);
}
