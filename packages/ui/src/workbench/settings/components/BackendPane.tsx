/**
 * BackendPane — custom right-pane renderer for the Backend › Connections
 * page (the multi-backend plan §4), on the shared pane chrome. Two bands:
 *
 *   1. **Tier-zero card** — the always-on local engine ("This browser" /
 *      "This app"), pinned, never a list entry.
 *   2. **Connections list** — one row per `OH.backends` record with the
 *      probe-gated enabled toggle, auto-connect, re-pair, edit, remove.
 *      Only on hosts that dial outward at all (`hostJoinsBackends`): a
 *      served web tab is served BY its back-end and has no second one to
 *      manage, so the band is absent there rather than empty.
 *
 * The daemon-side inbound config, the browser-side pairing consent and
 * the reliability knobs each have their own page under the Backend
 * group. The four-tile mode picker, the preview/ApplyBar commit
 * machinery, and the mode-switch orchestration retired with the registry
 * UI: "mode" is derived presentation vocabulary (`deriveBackendMode`),
 * and activation is per-record — the enabled toggle verifies the wire
 * before it commits, exactly the gate the old "Switch to …" ran.
 */

import { Checkbox, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { useServerAdminStatus } from '../../components/server-admin/use-server-admin-status';
import { useOpenServerAdmin } from '../../hooks/OpenServerAdminContext';
import { hostJoinsBackends, tierZeroMode } from '../schema/backend';
import { useSetting } from '../hooks';
import type { CategoryPaneProps } from '../types';
import { BackendConnectionsList } from './backend-connections-list';
import { BackendDetailDiagram } from './backend-details';
import { BackendTierCard } from './backend-tier-card';
import { BackendTierZeroCard } from './backend-tier-zero-card';
import { Pane, PaneHeader } from './pane-chrome';

const BackendPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const host = getCurrentHost();

  // Pane-level view toggle, rendered inline as a checkbox rather than a
  // config row (it remains reachable via settings search).
  const [showDiagrams, setShowDiagrams] = useSetting('backend.showDiagrams');

  // Admin-console entry — rendered only when the probe says this subject
  // administers the back-end AND the shell provides the opener. The
  // probe answers for the host's own server: the desktop's spine is
  // band 1's card; the web host's serving daemon is its band-2 row.
  // Pure affordance honesty; the server gates every call regardless.
  const adminStatus = useServerAdminStatus();
  const openServerAdmin = useOpenServerAdmin();
  const administer = adminStatus === 'admin' && openServerAdmin ? openServerAdmin : null;

  return (
    <Pane>
      <PaneHeader category={category} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
        <Checkbox checked={showDiagrams} onChange={(e) => setShowDiagrams(e.target.checked)}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {t('workbench.settings.backendPane.showDiagrams')}
          </span>
        </Checkbox>
      </div>

      <BackendTierZeroCard host={host} administer={administer} />

      {showDiagrams && (
        <div
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 360px', minWidth: 320 }}>
            <BackendTierCard mode={tierZeroMode(host)} />
          </div>
          <div style={{ flex: '1 1 360px', minWidth: 320 }}>
            <BackendDetailDiagram mode={tierZeroMode(host)} />
          </div>
        </div>
      )}

      {hostJoinsBackends(host) && <BackendConnectionsList host={host} />}
    </Pane>
  );
};

export default BackendPane;
