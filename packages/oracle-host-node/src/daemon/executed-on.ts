/**
 * The `executedOn` stamp — how this host names itself on a run it
 * answered for a peer (the response strip's "Sent from"). The name is
 * the one the host goes by everywhere else: its home Org's name from
 * the live identity snapshot — the configured server name or the
 * machine name at first boot, an admin's rename after — so the stamp
 * reads as the switcher, the pill and the place button do. The OS
 * hostname label is the fallback for a host with no identity yet;
 * inside a container that label is the container id, which is why it
 * is no longer the rule.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import { hostDisplayLabel } from './host-os';

export interface DaemonExecutedOn {
  readonly kind: 'backend';
  readonly name: string;
}

export function daemonExecutedOn(): DaemonExecutedOn {
  const snapshot = getIdentitySnapshot();
  const name = snapshot?.orgs.get(snapshot.user.homeOrgId)?.name.trim() ?? '';
  return { kind: 'backend', name: name !== '' ? name : hostDisplayLabel() };
}
