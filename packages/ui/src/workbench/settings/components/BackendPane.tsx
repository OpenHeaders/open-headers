/**
 * BackendPane — custom right-pane renderer for the Backend settings
 * category (MULTI_BACKEND_PLAN.md §4). Three bands:
 *
 *   1. **Tier-zero card** — the always-on local engine ("This browser" /
 *      "This app"), pinned, never a list entry. Desktop's daemon-side
 *      inbound config (LAN-peers bind + paired devices) rides here.
 *   2. **Connections list** — one row per `OH.backends` record with the
 *      probe-gated enabled toggle, auto-connect, re-pair, edit, remove.
 *   3. **Global sections** — the reliability / notification knobs that
 *      apply to every connection.
 *
 * The four-tile mode picker, the preview/ApplyBar commit machinery, and
 * the mode-switch orchestration retired with the registry UI: "mode" is
 * derived presentation vocabulary (`deriveBackendMode`), and activation
 * is per-record — the enabled toggle verifies the wire before it
 * commits, exactly the gate the old "Switch to …" ran.
 */

import { ArrowRightOutlined } from '@ant-design/icons';
import { Checkbox, theme, Typography } from 'antd';
import type React from 'react';
import { useBackends } from '../../../shared/backend';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import { useOptionalSettingsHost } from './settings-host-context';
import { tierZeroMode } from '../schema/backend';
import { useSetting } from '../hooks';
import type { CategoryPaneProps } from '../types';
import { GlobalConfigSections } from './backend-config-panel';
import { BackendConnectionsList } from './backend-connections-list';
import { BackendDetailDiagram } from './backend-details';
import { BackendTierCard } from './backend-tier-card';
import { BackendTierZeroCard } from './backend-tier-zero-card';

const INTRO_TEXT: React.ReactNode = (
  <>
    <strong>Who:</strong> processes and stores your data. <strong>Where:</strong> local or remote.
  </>
);
const HOST_INTRO: Record<Host, React.ReactNode> = {
  extension: INTRO_TEXT,
  desktop: INTRO_TEXT,
  web: INTRO_TEXT,
};

const BackendPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const host = getCurrentHost();
  // Subscribes this pane to the registry so the `when`-gated global
  // sections re-evaluate the moment a record enables or disables.
  useBackends();

  // Pane-level view toggle, rendered inline as a checkbox rather than a
  // config row — so it stays out of the `fieldDefs` the sections lay
  // out (it remains reachable via settings search).
  const [showDiagrams, setShowDiagrams] = useSetting('backend.showDiagrams');
  const fieldDefs = defs.filter((d) => d.key !== 'backend.showDiagrams');

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
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
        <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {HOST_INTRO[host]} <DocsLink />
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}>
        <Checkbox checked={showDiagrams} onChange={(e) => setShowDiagrams(e.target.checked)}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Show diagrams</span>
        </Checkbox>
      </div>

      <BackendTierZeroCard host={host} defs={fieldDefs} />

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

      <BackendConnectionsList host={host} />

      <GlobalConfigSections host={host} defs={fieldDefs} category={category} />
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
      Learn more <ArrowRightOutlined style={{ fontSize: 10 }} />
    </Typography.Link>
  );
};

export default BackendPane;
