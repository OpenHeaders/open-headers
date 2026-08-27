/**
 * BackendPane — custom right-pane renderer for the Backend › Connections
 * page (the multi-backend plan §4). Two bands:
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

import { ArrowRightOutlined } from '@ant-design/icons';
import { Checkbox, theme, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import { useOptionalSettingsHost } from './settings-host-context';
import { hostJoinsBackends, tierZeroMode } from '../schema/backend';
import { useSetting } from '../hooks';
import type { CategoryPaneProps } from '../types';
import { BackendConnectionsList } from './backend-connections-list';
import { BackendDetailDiagram } from './backend-details';
import { BackendTierCard } from './backend-tier-card';
import { BackendTierZeroCard } from './backend-tier-zero-card';
import { PaneTitle } from './pane-chrome';

const Intro: React.FC = () => {
  const t = useT();
  return (
    <>
      <strong>{t('workbench.settings.backendPane.intro.whoLabel')}</strong>{' '}
      {t('workbench.settings.backendPane.intro.whoText')}{' '}
      <strong>{t('workbench.settings.backendPane.intro.whereLabel')}</strong>{' '}
      {t('workbench.settings.backendPane.intro.whereText')}
    </>
  );
};

const BackendPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const host = getCurrentHost();

  // Pane-level view toggle, rendered inline as a checkbox rather than a
  // config row (it remains reachable via settings search).
  const [showDiagrams, setShowDiagrams] = useSetting('backend.showDiagrams');

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          margin: '8px 0',
        }}
      >
        <PaneTitle category={category} />
        <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
          <Intro /> <DocsLink />
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}>
        <Checkbox checked={showDiagrams} onChange={(e) => setShowDiagrams(e.target.checked)}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {t('workbench.settings.backendPane.showDiagrams')}
          </span>
        </Checkbox>
      </div>

      <BackendTierZeroCard host={host} />

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
    </div>
  );
};

// ── Docs link ──────────────────────────────────────────────────────

/**
 * "Learn more" link to the back-end diagram in the docs. When the
 * inspector-nav provider isn't mounted (e.g. settings opened from a
 * surface that doesn't host the docs panel), the link silently hides.
 * A modal host is dismissed on click — the docs open behind it.
 */
const DocsLink: React.FC = () => {
  const t = useT();
  const nav = useOptionalInspectorNav();
  const host = useOptionalSettingsHost();
  if (!nav) return null;
  return (
    <Typography.Link
      onClick={(e) => {
        e.preventDefault();
        nav.openDocs('paradigm');
        host?.close();
      }}
      style={{ fontSize: 12, whiteSpace: 'nowrap' }}
    >
      {t('workbench.settings.backendPane.learnMore')} <ArrowRightOutlined style={{ fontSize: 10 }} />
    </Typography.Link>
  );
};

export default BackendPane;
