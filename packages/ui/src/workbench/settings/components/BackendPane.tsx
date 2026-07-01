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
import { hasCapability } from '@openheaders/core/capabilities';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending, hostIsTheBackend } from '../schema/backend';
import { useSetting, useSettingValue } from '../hooks';
import { ConnectionDraftProvider } from './connection-draft';
import { ApplyBar } from './backend-apply-bar';
import { BackendPreviewModeProvider } from './backend-preview-context';
import { useBackendModeSwitch } from './backend-mode-switch';
import type { CategoryDef, CategoryPaneProps, SettingDef, SubcategoryDef } from '../types';
import SettingRow from '../fields/SettingRow';
import { ModePicker } from './backend-mode-picker';
import { firstValidMode, isModeValidForHost, SCENARIOS } from './backend-scenarios';
import { useBackendAuthRequired, useBackendLive } from './use-backend-status';
import { BackendDetailDiagram } from './backend-details';
import { BackendTierCard } from './backend-tier-card';
import DaemonTokensSection from './daemon-tokens-section';
import OfflineFallbackOrderSection from './offline-fallback-order-section';
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
  const fieldDefs = defs.filter((d) => d.key !== 'backend.mode' && d.key !== 'backend.showDiagrams');
  const previewPending = backendModeIsPending(previewScenario.mode);
  const liveBackend = useBackendLive(activeScenario.mode, host);
  const previewingNonActive = previewMode !== mode;

  return (
    <div style={{ padding: '0 24px 28px' }}>
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
          padding: '20px 0 10px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
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
  const url = useSettingValue('backend.url');
  const [, setToken] = useSetting('backend.authToken');
  if (!authRequired || !hasCapability('pairWithCode')) return null;
  return (
    <Alert
      type="warning"
      showIcon
      message="Re-pair needed"
      description="The back-end rejected this device's saved token. Pair again with a fresh code — your configured back-end address stays as is."
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

/**
 * Subsection headings are derived from the category's `subcategories`
 * registration so the schema is the single source of truth for both
 * ordering and labels. Falls back to the bare subcategory id if a
 * setting references an unregistered subcategory.
 */
const SUBSECTION_BLURB: Record<string, string> = {
  connection: 'How this client reaches the back-end.',
  reliability: 'Auto-connect and reconnection behavior over an unstable wire.',
  notifications: 'Visual cues when the link is down.',
  'lan-peers': 'Who outside this machine can reach the daemon.',
};

const ConfigPanel: React.FC<{
  pending: boolean;
  mode: BackendMode;
  host: Host;
  defs: readonly SettingDef[];
  category: CategoryDef;
}> = ({ pending, mode, host, defs, category }) => {
  const { token } = theme.useToken();

  // Host can't host this back-end mode — e.g. the desktop app or a
  // web bundle previewing `in-browser`, which only makes sense in a
  // browser extension. Render a hard-stop alert; no config inputs, no
  // Apply path. The picker already grays the tile, this alert is the
  // second backstop for users who reached the mode via search.
  if (!isModeValidForHost(mode, host)) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Not available on this host"
        description={
          mode === 'in-browser'
            ? 'Only the browser extension can host an in-browser back-end (its service worker is the back-end). To use this mode, open the Open Headers extension popup on this machine.'
            : `${SCENARIOS.find((s) => s.mode === mode)?.title ?? mode} isn't selectable from this surface.`
        }
      />
    );
  }

  // Two "host IS the back-end" cases: there's no outbound wire to tune,
  // but the desktop daemon still has inbound-side surfaces (the bind
  // address and the Paired-devices token management) for peers reaching
  // IN. Render just those — every other config field is outbound.
  if (hostIsTheBackend(mode, host)) {
    // LAN-peers config is meaningful only on the desktop daemon. Gate
    // the whole section at the branch level; strip each row's `when`
    // since the schema's `when` reads the *active* mode (not the
    // previewed mode this pane renders) and would hide rows we want
    // visible while the user is configuring a desktop-app preview.
    const isDaemonContext = host === 'desktop' && mode === 'desktop-app';
    const daemonDefs = isDaemonContext
      ? defs.filter((d) => d.subcategory === 'lan-peers').map((d) => (d.when ? { ...d, when: undefined } : d))
      : [];
    return (
      <>
        <Alert
          type="success"
          showIcon
          message="Nothing outbound to configure"
          description={
            mode === 'in-browser'
              ? 'The browser service worker is the back-end. Workspaces, rules, and vault live in this browser only — no external host to point at.'
              : 'The desktop app process is the back-end. Other localhost clients connect into it; there is no outbound wire to tune.'
          }
          style={{ marginBottom: 12 }}
        />
        {daemonDefs.length > 0 && (
          <section style={{ marginBottom: 12 }}>
            <header style={{ marginBottom: 6, padding: '0 2px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: token.colorTextSecondary,
                }}
              >
                LAN peers
              </h3>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                {SUBSECTION_BLURB['lan-peers']}
              </div>
            </header>
            <div
              className="settings-card"
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {daemonDefs.map((def) => (
                <SettingRow key={def.key} def={def} />
              ))}
            </div>
          </section>
        )}
        {isDaemonContext && <DaemonTokensSection />}
      </>
    );
  }

  // Host-conditioned filtering. `backend.showBadgeWhenDisconnected`
  // toggles a `chrome.action` toolbar badge — meaningless outside the
  // browser extension, so drop it from the desktop / web surface.
  // Also strip each def's `when` predicate: the schema's `when` reads
  // the GLOBAL `backend.mode` setting (= the active mode), but we
  // render the PREVIEWED mode's config so the user can configure a
  // back-end they haven't switched into yet. The previewed-mode guards
  // above (host-validity + host-is-backend + pending) already gate the
  // section as a whole.
  const visibleDefs = defs
    .filter((d) => {
      if (d.key === 'backend.showBadgeWhenDisconnected' && host !== 'extension') return false;
      return true;
    })
    .map((d) => (d.when ? { ...d, when: undefined } : d));

  const grouped = groupBySubcategory(visibleDefs, category.subcategories);

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
      {grouped.map(({ id, label, defs: groupDefs }) =>
        groupDefs.length === 0 ? null : (
          <section key={id} style={{ marginBottom: 12 }}>
            <header style={{ marginBottom: 6, padding: '0 2px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: token.colorTextSecondary,
                }}
              >
                {label}
              </h3>
              {SUBSECTION_BLURB[id] && (
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                  {SUBSECTION_BLURB[id]}
                </div>
              )}
            </header>
            <div
              className="settings-card"
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {groupDefs.map((def) => (
                <SettingRow key={def.key} def={def} />
              ))}
            </div>
          </section>
        ),
      )}
      {/* Offline-fallback runner order — an extension-peer concern: when
          the configured backend drops, one browser self-refreshes an
          exclusive workflow's credential, chosen by this ranking. The
          desktop daemon is the authoritative runner, so it has nothing to
          elect. */}
      {host === 'extension' && <OfflineFallbackOrderSection />}
    </>
  );
};

interface GroupedSection {
  id: string;
  label: string;
  defs: SettingDef[];
}

/**
 * Group settings by their `subcategory` field, ordered by the
 * category's registered `subcategories` list. Anything missing a
 * subcategory falls into a synthetic "Other" group at the end — this
 * keeps the grouping resilient if a new setting forgets to declare
 * its subcategory.
 */
function groupBySubcategory(
  defs: readonly SettingDef[],
  subcategories: readonly SubcategoryDef[] | undefined,
): GroupedSection[] {
  const byId = new Map<string, SettingDef[]>();
  const orderedIds = (subcategories ?? []).slice().sort((a, b) => a.order - b.order).map((s) => s.id);
  const labels = new Map((subcategories ?? []).map((s) => [s.id, s.label]));

  for (const id of orderedIds) byId.set(id, []);
  for (const def of defs) {
    const id = def.subcategory ?? '__uncategorized';
    if (!byId.has(id)) byId.set(id, []);
    const bucket = byId.get(id);
    if (bucket) bucket.push(def);
  }

  return Array.from(byId.entries()).map(([id, list]) => ({
    id,
    label: labels.get(id) ?? 'Other',
    defs: list,
  }));
}

export default BackendPane;
