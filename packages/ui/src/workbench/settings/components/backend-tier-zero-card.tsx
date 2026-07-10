/**
 * Tier-zero card — the pinned, always-on local engine at the top of the
 * Back-end pane (MULTI_BACKEND_PLAN.md §4). Not a list entry: the
 * extension's service worker / the desktop app's embedded back-end runs
 * regardless of what the connections list holds, and it hosts the home
 * Org. On the desktop host the daemon-side inbound surfaces ride along
 * (the LAN-peers bind rows + paired-devices token management) — they
 * configure this process AS a server, orthogonal to any outbound
 * connection below.
 */

import { TeamOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import { useDaemonAdminStatus } from '../../components/daemon-admin/use-daemon-admin-status';
import { useOpenDaemonAdmin } from '../../hooks/OpenDaemonAdminContext';
import type { Host } from '../../../shared/host-vocabulary';
import { tierZeroMode } from '../schema/backend';
import SettingRow from '../fields/SettingRow';
import type { SettingDef } from '../types';
import { BackendIcon, backendModeIcon } from './backend-icons';
import DaemonTokensSection from './daemon-tokens-section';

const HOST_TITLE: Record<Host, string> = {
  extension: 'This browser',
  desktop: 'This app',
  web: 'This app',
};

const HOST_COPY: Record<Host, string> = {
  extension:
    'The extension itself processes and stores your data — workspaces, rules, and vault live in this browser. Always on; no setup.',
  desktop:
    'The desktop app process is the back-end. Other local clients connect into it; your data lives on this machine. Always on; no setup.',
  web: 'The app that served this page is the back-end. Your data lives on that host. Always on; no setup.',
};

export const BackendTierZeroCard: React.FC<{ host: Host; defs: readonly SettingDef[] }> = ({ host, defs }) => {
  const { token } = theme.useToken();
  // Admin-console CTA — rendered only when the probe says this subject
  // administers the back-end (desktop = its own spine, web = the
  // serving daemon over the wire) AND the shell provides the opener.
  // Pure affordance honesty; the server gates every call regardless.
  const adminStatus = useDaemonAdminStatus();
  const openDaemonAdmin = useOpenDaemonAdmin();
  // Daemon-side inbound config exists only where this process IS a
  // daemon. Strip each row's `when` — it gates on the derived mode for
  // search hits, but inside the tier-zero card the daemon context is
  // established by the card itself.
  const daemonDefs =
    host === 'desktop'
      ? defs.filter((d) => d.subcategory === 'lan-peers').map((d) => (d.when ? { ...d, when: undefined } : d))
      : [];

  return (
    <section style={{ marginBottom: 12 }}>
      <div
        className="settings-card"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
          <span style={{ flex: 'none', display: 'inline-flex' }} aria-hidden>
            <BackendIcon kind={backendModeIcon(tierZeroMode(host))} size={30} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{HOST_TITLE[host]}</span>
              <span
                style={{
                  padding: '0 5px',
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  borderRadius: 999,
                  background: token.colorSuccess,
                  color: token.colorTextLightSolid,
                  lineHeight: '14px',
                }}
              >
                Always on
              </span>
            </div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>{HOST_COPY[host]}</div>
          </div>
        </div>
        {daemonDefs.map((def) => (
          <SettingRow key={def.key} def={def} />
        ))}
        {adminStatus === 'admin' && openDaemonAdmin && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>Daemon administration</div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                Manage the user directory and per-workspace access grants.
              </div>
            </div>
            <Button
              size="small"
              icon={<TeamOutlined />}
              onClick={() => openDaemonAdmin()}
              data-testid="open-daemon-admin"
            >
              Open admin console
            </Button>
          </div>
        )}
      </div>
      {host === 'desktop' && <DaemonTokensSection />}
    </section>
  );
};
