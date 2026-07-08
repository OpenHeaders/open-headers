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
import { Alert, Checkbox, theme, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { updatePrimaryBackend } from '@openheaders/core/backends';
import { hasCapability } from '@openheaders/core/capabilities';
import { usePrimaryBackendUrl } from '../../../shared/backend';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import { useOptionalSettingsHost } from './settings-host-context';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
import { useSetting } from '../hooks';
import { ConnectionDraftProvider } from './connection-draft';
import { ApplyBar } from './backend-apply-bar';
import { BackendPreviewModeProvider } from './backend-preview-context';
import { useBackendModeSwitch } from './backend-mode-switch';
import type { CategoryPaneProps } from '../types';
import { ConfigPanel } from './backend-config-panel';
import { ModePicker } from './backend-mode-picker';
import { firstValidMode, SCENARIOS } from './backend-scenarios';
import { useBackendAuthRequired, useBackendLive } from './use-backend-status';
import { BackendDetailDiagram } from './backend-details';
import { BackendTierCard } from './backend-tier-card';
import { PairPopover } from './pair-popover';

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

const BackendPaneInner: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const host = getCurrentHost();
  const { mode, attemptChange, disabled, overlayElement } = useBackendModeSwitch();

  // The system setting is `mode`. The 4-tile picker is a PREVIEW
  // explorer — clicking a tile updates a local `previewMode` so the
  // detail diagram + scenario copy switch, but the active back-end
  // doesn't change until the user picks one from the dropdown below
  // the tiles. This lets users compare scenarios visually without
  // committing.
  const [previewMode, setPreviewMode] = useState<BackendMode>(mode);

  // Keep the preview in sync when the active mode changes (e.g. after
  // a switch commits).
  useEffect(() => {
    setPreviewMode(mode);
  }, [mode]);

  // If the stored value isn't valid for the current host (e.g. user
  // imported a config from a different host), correct it through the
  // same switch path as a manual change. attemptChange is a no-op when
  // the target equals the current value.
  useEffect(() => {
    const stored = SCENARIOS.find((s) => s.mode === mode);
    if (!stored || !stored.validHosts.includes(host)) {
      void attemptChange(firstValidMode(host));
    }
  }, [host, mode, attemptChange]);

  // Pane-level view toggle, rendered inline as a checkbox rather than a
  // config row — so it stays out of the `fieldDefs` the ConfigPanel lays
  // out (it remains reachable via settings search like `backend.mode`).
  const [showDiagrams, setShowDiagrams] = useSetting('backend.showDiagrams');

  const activeScenario = SCENARIOS.find((s) => s.mode === mode) ?? SCENARIOS[0];
  const previewScenario = SCENARIOS.find((s) => s.mode === previewMode) ?? activeScenario;
  const fieldDefs = defs.filter((d) => d.key !== 'backend.showDiagrams');
  const previewPending = backendModeIsPending(previewScenario.mode);
  const liveBackend = useBackendLive(activeScenario.mode, host);
  const previewingNonActive = previewMode !== mode;

  return (
    // No bottom padding on the pane: the sticky ApplyBar is the last flow
    // child, so any padding under it would make the bar jump up by that
    // amount at scroll end. The bar's own band padding spaces the bottom.
    <div style={{ padding: '0 24px' }}>
      {/* The identity row — title, intro, mode tiles — stays pinned to
          the pane top while the config rows below scroll, so the user
          never loses sight of which back-end they're configuring. The
          opaque pane-layout background covers content scrolling under. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: token.colorBgLayout,
          // Full-bleed band: cancel the pane's side padding so the grey
          // spans the whole row instead of stopping at the gutters.
          margin: '0 -24px',
          padding: '8px 24px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
            {category.label}
          </h2>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {HOST_INTRO[host]} <DocsLink />
          </div>
        </header>

        <RePairBanner mode={activeScenario.mode} host={host} />

        <ModePicker
          scenarios={SCENARIOS}
          previewMode={previewScenario.mode}
          activeMode={mode}
          liveMode={liveBackend ? mode : null}
          host={host}
          onPreview={setPreviewMode}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: showDiagrams ? 6 : 14 }}>
        <Checkbox checked={showDiagrams} onChange={(e) => setShowDiagrams(e.target.checked)}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Show diagrams</span>
        </Checkbox>
      </div>

      {showDiagrams && (
        <DetailFrame previewingNonActive={previewingNonActive}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px', minWidth: 320 }}>
              <BackendTierCard mode={previewScenario.mode} />
            </div>
            <div style={{ flex: '1 1 360px', minWidth: 320 }}>
              <BackendDetailDiagram mode={previewScenario.mode} />
            </div>
          </div>
        </DetailFrame>
      )}

      {/*
        Config inputs follow the PREVIEW mode, not the active mode.
        Users edit (URL, autoConnect, etc.) freely while exploring;
        nothing commits until they click "Switch to ...". This is the
        JetBrains DB-tools pattern — configuration is decoupled from
        activation, so the user can configure a backend they're not
        yet connected to without tripping the destructive-action
        orchestrator.
      */}
      <BackendPreviewModeProvider value={previewScenario.mode}>
        <ConfigPanel
          pending={previewPending}
          mode={previewScenario.mode}
          host={host}
          defs={fieldDefs}
          category={category}
        />
      </BackendPreviewModeProvider>

      <ApplyBar
        previewMode={previewScenario.mode}
        activeMode={mode}
        previewLabel={previewScenario.title}
        host={host}
        disabled={disabled}
        onApply={() => {
          void attemptChange(previewScenario.mode);
        }}
      />

      {overlayElement}
    </div>
  );
};

/**
 * Public entry. Wraps the pane in the connection-draft provider so the
 * connection-identity fields (`backend.url`, `backend.bindPort`) stage
 * their edits and the ApplyBar can commit them atomically.
 */
const BackendPane: React.FC<CategoryPaneProps> = (props) => (
  <ConnectionDraftProvider>
    <BackendPaneInner {...props} />
  </ConnectionDraftProvider>
);

const DetailFrame: React.FC<{ children: React.ReactNode; previewingNonActive: boolean }> = ({
  children,
  previewingNonActive,
}) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        position: 'relative',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        padding: '28px 12px 10px',
        marginBottom: 14,
      }}
    >
      {previewingNonActive && (
        <span
          style={{
            position: 'absolute',
            top: 5,
            left: 6,
            padding: '0 5px',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            borderRadius: 999,
            background: token.colorFillTertiary,
            color: token.colorTextTertiary,
            border: `1px solid ${token.colorBorder}`,
            pointerEvents: 'none',
            lineHeight: '14px',
          }}
        >
          Preview · Not Active
        </span>
      )}
      {children}
    </div>
  );
};

// ── Re-pair banner (WS-A6) ─────────────────────────────────────────

/**
 * Surfaced when the active back-end rejects the saved token. The token
 * is KEPT (a daemon restart re-reads its ledger and the token may still
 * be valid) — pairing with a fresh code overwrites it via `onPaired`.
 * The configured back-end address (A3) is never touched. Manual,
 * prominent: a primary "Pair with a code" CTA, not an auto-popup.
 *
 * Hidden when the running host can't pair by code — that host recovers
 * by another gesture, so a code popover would dead-end.
 */
const RePairBanner: React.FC<{ mode: BackendMode; host: Host }> = ({ mode, host }) => {
  const authRequired = useBackendAuthRequired(mode, host);
  const url = usePrimaryBackendUrl();
  const setToken = (token: string): void => {
    void updatePrimaryBackend({ authToken: token });
  };
  if (!authRequired || !hasCapability('pairWithCode')) return null;
  return (
    <Alert
      type="warning"
      showIcon
      message={<span style={{ fontSize: 13 }}>Re-pair needed</span>}
      description={
        <span style={{ fontSize: 12 }}>
          The back-end rejected this device's saved token. Pair again with a fresh code — your configured back-end
          address stays as is.
        </span>
      }
      action={<PairPopover url={url} onPaired={setToken} buttonType="primary" />}
      style={{ marginBottom: 14 }}
    />
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
