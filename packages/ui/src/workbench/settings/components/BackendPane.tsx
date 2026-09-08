/**
 * BackendPane — the Backup and Sync › Sync page (the Backup and Sync UX
 * plan §5.2), on the shared pane chrome. Three bands:
 *
 *   1. **This browser / This computer / This server** — the always-on
 *      place your workspaces live (`backend-tier-zero-card.tsx`),
 *      pinned, never a list entry.
 *   2. **Synced with** — one row per `OH.backends` record, place first
 *      (`backend-connections-list.tsx`), with the two verbs beneath. A
 *      served web tab is served BY its one back-end and holds no
 *      registry (`hostJoinsBackends`), so its band is the one synthesised
 *      row (`backend-served-row.tsx`) — nothing there adds a connection.
 *   3. **Where new workspaces go** — the new-workspace placement row.
 *
 * The daemon-side inbound config, the browser-side pairing consent and
 * the reliability knobs each have their own page under Backup and Sync.
 * "Mode" is derived presentation vocabulary (`deriveBackendMode`), and
 * activation is per-record — Connect verifies the wire before it
 * commits, the one activation path.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { useServerAdminStatus } from '../../components/server-admin/use-server-admin-status';
import { useOpenServerAdmin } from '../../hooks/OpenServerAdminContext';
import { hostJoinsBackends } from '../schema/backend';
import type { CategoryPaneProps } from '../types';
import { BackendConnectionsList } from './backend-connections-list';
import { BackendPlacementRow } from './backend-placement-row';
import { BackendServedRow } from './backend-served-row';
import { BackendTierZeroCard } from './backend-tier-zero-card';
import { Pane, PaneHeader, PaneSection } from './pane-chrome';

const BackendPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const t = useT();
  const host = getCurrentHost();

  // Admin-console entry — rendered only when the probe says this subject
  // administers the server AND the shell provides the opener. The probe
  // answers for the host's own server, so the verb sits on the ⋯ of the
  // thing that IS the server: band 1's card on the desktop (its own
  // spine), the served row on the web (the daemon that serves the tab).
  // Pure affordance honesty; the server gates every call regardless.
  const adminStatus = useServerAdminStatus();
  const openServerAdmin = useOpenServerAdmin();
  const administer = adminStatus === 'admin' && openServerAdmin ? openServerAdmin : null;

  return (
    <Pane>
      <PaneHeader category={category} />

      <BackendTierZeroCard host={host} administer={host === 'desktop' ? administer : null} />

      {hostJoinsBackends(host) ? (
        <BackendConnectionsList host={host} />
      ) : (
        <PaneSection title={t('workbench.settings.backendPane.connections.title')}>
          <BackendServedRow administer={administer} />
        </PaneSection>
      )}

      <BackendPlacementRow />
    </Pane>
  );
};

export default BackendPane;
