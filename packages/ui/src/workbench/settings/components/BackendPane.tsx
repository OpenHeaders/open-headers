/**
 * BackendPane — custom right-pane renderer for the Backend settings
 * category. Compact by design: a row of picker buttons (each carrying
 * the small back-end-tier glyph the docs use), a "Learn more in the
 * docs" link for users who want the full picture, and the config rows
 * for the active mode. The full back-end diagram lives in the docs
 * page — settings stays scrollable and short.
 *
 * Per-host filtering: read `getCurrentHost()` and only show the
 * scenarios that are valid for the running host. The setting itself is
 * shared across hosts, but each host gets a different subset:
 *
 *   - browser extension — all four scenarios
 *   - desktop app       — desktop-app (server-side) + daemon + VM
 *   - web bundle        — desktop-app (when served from the desktop) + daemon + VM
 *
 * If the stored mode isn't valid for the current host, auto-correct to
 * the first valid mode and persist.
 */

import { ArrowRightOutlined } from '@ant-design/icons';
import { Alert, theme, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import { useSetting } from '../hooks';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
import type { CategoryPaneProps, SettingDef } from '../types';
import SettingRow from '../fields/SettingRow';
import { BackendDetailDiagram } from './backend-details';
import { type BackendIconKey, BackendIcon } from './backend-icons';

interface ScenarioDescriptor {
  mode: BackendMode;
  /** Matches the back-end-tier glyph key. */
  icon: BackendIconKey;
  title: string;
  /** One-line copy beside the button title. */
  caption: string;
  /**
   * Hosts where this scenario is selectable. The browser extension can
   * be any of the four; the desktop app can't run `in-browser` (no SW
   * for workspace data); a web bundle is always a client of something
   * (desktop on localhost, daemon on LAN, or your VM).
   */
  validHosts: readonly Host[];
}

const SCENARIOS: readonly ScenarioDescriptor[] = [
  {
    mode: 'in-browser',
    icon: 'browser',
    title: 'In this browser',
    caption: 'SW is the back-end · zero setup',
    validHosts: ['extension'],
  },
  {
    mode: 'desktop-app',
    icon: 'desktop',
    title: 'Desktop app',
    caption: 'Shared back-end on this machine',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'local-self-hosted',
    icon: 'daemon',
    title: 'Local / LAN daemon',
    caption: 'Cross-device on your LAN',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'remote-self-hosted',
    icon: 'vm',
    title: 'Remote (self-hosted)',
    caption: 'Your VM · anywhere · TLS + auth',
    validHosts: ['extension', 'desktop', 'web'],
  },
];

const HOST_INTRO: Record<Host, string> = {
  extension: 'Pick where the back-end lives — every option is local-only; you stay in control of your data.',
  desktop: 'The desktop app IS the back-end by default; you can also point it at a daemon or your VM if other devices need to share the workspace.',
  web: 'A web tab has no service-worker workspace store — it talks to a back-end you host (the desktop app on this machine, a LAN daemon, or your VM).',
};

function firstValidMode(host: Host): BackendMode {
  return (SCENARIOS.find((s) => s.validHosts.includes(host))?.mode ?? SCENARIOS[0].mode) as BackendMode;
}

const BackendPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useSetting('backend.mode');
  const host = getCurrentHost();
  const visibleScenarios = useMemo(
    () => SCENARIOS.filter((s) => s.validHosts.includes(host)),
    [host],
  );

  useEffect(() => {
    if (!visibleScenarios.some((s) => s.mode === mode)) {
      setMode(firstValidMode(host));
    }
  }, [host, mode, setMode, visibleScenarios]);

  const activeScenario =
    visibleScenarios.find((s) => s.mode === mode) ?? visibleScenarios[0] ?? SCENARIOS[0];
  const fieldDefs = defs.filter((d) => d.key !== 'backend.mode');
  const pending = backendModeIsPending(activeScenario.mode);

  return (
    <div style={{ padding: '20px 24px 28px', maxWidth: 760 }}>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: token.colorTextSecondary, maxWidth: 720 }}>
          {HOST_INTRO[host]} <DocsLink />
        </p>
      </header>

      <ModePicker scenarios={visibleScenarios} value={activeScenario.mode} onChange={setMode} />

      <DetailFrame>
        <BackendDetailDiagram mode={activeScenario.mode} />
      </DetailFrame>

      <ConfigPanel pending={pending} mode={activeScenario.mode} defs={fieldDefs} />
    </div>
  );
};

const DetailFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
};

// ── Picker ─────────────────────────────────────────────────────────

interface ModePickerProps {
  scenarios: readonly ScenarioDescriptor[];
  value: BackendMode;
  onChange: (next: BackendMode) => void;
}

const ModePicker: React.FC<ModePickerProps> = ({ scenarios, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Backend mode"
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(scenarios.length, 4)}, minmax(0, 1fr))`,
      gap: 8,
      marginBottom: 14,
    }}
  >
    {scenarios.map((s) => (
      <PickerButton key={s.mode} descriptor={s} active={value === s.mode} onSelect={() => onChange(s.mode)} />
    ))}
  </div>
);

const PickerButton: React.FC<{
  descriptor: ScenarioDescriptor;
  active: boolean;
  onSelect: () => void;
}> = ({ descriptor, active, onSelect }) => {
  const { token } = theme.useToken();
  const pending = backendModeIsPending(descriptor.mode);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: active ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
        fontFamily: 'inherit',
        color: token.colorText,
        textAlign: 'left',
        minHeight: 56,
      }}
    >
      {pending && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '0 5px',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            borderRadius: 999,
            background: token.colorWarningBg,
            color: token.colorWarningText,
            border: `1px solid ${token.colorWarningBorder}`,
          }}
        >
          Soon
        </span>
      )}
      <div
        style={{
          flex: 'none',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: active ? 'none' : 'grayscale(0.7) opacity(0.7)',
          transition: 'filter 120ms',
        }}
      >
        <BackendIcon kind={descriptor.icon} size={32} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 1 }}>{descriptor.title}</div>
        <div style={{ fontSize: 11, color: token.colorTextSecondary, lineHeight: 1.35 }}>{descriptor.caption}</div>
      </div>
    </button>
  );
};

// ── Docs link ──────────────────────────────────────────────────────

/**
 * "Learn more" link to the back-end diagram in the docs. When the
 * inspector-nav provider isn't mounted (e.g. settings opened from a
 * surface that doesn't host the docs panel), the link silently hides.
 */
const DocsLink: React.FC = () => {
  const nav = useOptionalInspectorNav();
  if (!nav) return null;
  return (
    <Typography.Link
      onClick={(e) => {
        e.preventDefault();
        nav.openDocs('paradigm');
      }}
      style={{ fontSize: 12, whiteSpace: 'nowrap' }}
    >
      Learn more <ArrowRightOutlined style={{ fontSize: 10 }} />
    </Typography.Link>
  );
};

// ── Config panel ───────────────────────────────────────────────────

const ConfigPanel: React.FC<{ pending: boolean; mode: BackendMode; defs: readonly SettingDef[] }> = ({
  pending,
  mode,
  defs,
}) => {
  const { token } = theme.useToken();

  if (mode === 'in-browser') {
    return (
      <Alert
        type="success"
        showIcon
        message="Nothing to configure"
        description="The browser service worker is the back-end. Workspaces, rules, and vault live in this browser only — no external host to point at."
      />
    );
  }

  return (
    <>
      {pending && (
        <Alert
          type="info"
          showIcon
          message="Coming soon"
          description={
            mode === 'local-self-hosted'
              ? 'The standalone local / LAN daemon is on the roadmap. Pre-selecting this mode is fine; the connection layer activates once the daemon ships.'
              : 'Self-hosted remote back-ends are on the roadmap. Pre-selecting this mode is fine; the connection layer activates once the remote endpoint protocol ships.'
          }
          style={{ marginBottom: 12 }}
        />
      )}
      {defs.length > 0 && (
        <div
          className="settings-card"
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {defs.map((def) => (
            <SettingRow key={def.key} def={def} />
          ))}
        </div>
      )}
    </>
  );
};

export default BackendPane;
