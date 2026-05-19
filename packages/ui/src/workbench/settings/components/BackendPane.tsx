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

import { ArrowRightOutlined, ExperimentOutlined, SwapOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Button, theme, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { generateUid } from '@openheaders/core/utils';
import { probeBackendConnection } from '../../../shared/backend/probe-connection';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { getStatusSnapshot, subscribe as subscribeStatus } from '../../../shared/status';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending, backendModeNeedsConnection } from '../schema/backend';
import { useSettingValue } from '../hooks';
import { useBackendModeSwitch } from './backend-mode-switch';
import type { CategoryDef, CategoryPaneProps, SettingDef, SubcategoryDef } from '../types';
import SettingRow from '../fields/SettingRow';
import { BackendDetailDiagram } from './backend-details';
import { type BackendIconKey, BackendIcon } from './backend-icons';
import { BackendTierCard } from './backend-tier-card';

interface ScenarioDescriptor {
  mode: BackendMode;
  /** Matches the back-end-tier glyph key. */
  icon: BackendIconKey;
  title: string;
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
    title: 'Browser Extension',
    validHosts: ['extension'],
  },
  {
    mode: 'desktop-app',
    icon: 'desktop',
    title: 'Desktop Application',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'local-self-hosted',
    icon: 'daemon',
    title: 'Local / LAN',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'remote-self-hosted',
    icon: 'vm',
    title: 'Remote / WAN',
    validHosts: ['extension', 'desktop', 'web'],
  },
];

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

function firstValidMode(host: Host): BackendMode {
  return (SCENARIOS.find((s) => s.validHosts.includes(host))?.mode ?? SCENARIOS[0].mode) as BackendMode;
}

function isModeValidForHost(mode: BackendMode, host: Host): boolean {
  return SCENARIOS.find((s) => s.mode === mode)?.validHosts.includes(host) ?? false;
}

/**
 * True when the host IS the back-end for this mode. There's nothing to
 * configure, no wire to test, no peer to reach — the local process is
 * the source of truth. Used to suppress connection-tier UI (URL field,
 * Test connection button) on those (host, mode) pairs.
 */
function hostIsTheBackend(mode: BackendMode, host: Host): boolean {
  if (host === 'extension' && mode === 'in-browser') return true;
  if (host === 'desktop' && mode === 'desktop-app') return true;
  if (host === 'web' && mode === 'desktop-app') return false; // web is always a client
  return false;
}

const BackendPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const host = getCurrentHost();
  const { mode, attemptChange, disabled, dialogElement } = useBackendModeSwitch();

  // The system setting is `mode`. The 4-tile picker is a PREVIEW
  // explorer — clicking a tile updates a local `previewMode` so the
  // detail diagram + scenario copy switch, but the active back-end
  // doesn't change until the user picks one from the dropdown below
  // the tiles. This lets users compare scenarios visually without
  // committing.
  const [previewMode, setPreviewMode] = useState<BackendMode>(mode);

  // Keep the preview in sync when the active mode changes (e.g. after
  // a successful executor run committed via the dialog).
  useEffect(() => {
    setPreviewMode(mode);
  }, [mode]);

  // If the stored value isn't valid for the current host (e.g. user
  // imported a config from a different host), correct it via the
  // orchestrator — same destructive-action protections as a manual
  // switch. attemptChange is a no-op when the target equals the
  // current value.
  useEffect(() => {
    const stored = SCENARIOS.find((s) => s.mode === mode);
    if (!stored || !stored.validHosts.includes(host)) {
      void attemptChange(firstValidMode(host));
    }
  }, [host, mode, attemptChange]);

  const activeScenario = SCENARIOS.find((s) => s.mode === mode) ?? SCENARIOS[0];
  const previewScenario = SCENARIOS.find((s) => s.mode === previewMode) ?? activeScenario;
  const fieldDefs = defs.filter((d) => d.key !== 'backend.mode');
  const previewPending = backendModeIsPending(previewScenario.mode);
  const liveBackend = useBackendLive(activeScenario.mode, host);
  const previewingNonActive = previewMode !== mode;

  return (
    <div style={{ padding: '20px 24px 28px' }}>
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

      <ModePicker
        scenarios={SCENARIOS}
        previewMode={previewScenario.mode}
        activeMode={mode}
        liveMode={liveBackend ? mode : null}
        host={host}
        onPreview={setPreviewMode}
      />

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

      {/*
        Config inputs follow the PREVIEW mode, not the active mode.
        Users edit (URL, autoConnect, etc.) freely while exploring;
        nothing commits until they click "Switch to ...". This is the
        JetBrains DB-tools pattern — configuration is decoupled from
        activation, so the user can configure a backend they're not
        yet connected to without tripping the destructive-action
        orchestrator.
      */}
      <ConfigPanel
        pending={previewPending}
        mode={previewScenario.mode}
        host={host}
        defs={fieldDefs}
        category={category}
      />

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

      {dialogElement}
    </div>
  );
};

/**
 * Bottom action bar — the explicit commit point. The dropdown that
 * lived here in earlier sessions silently committed on every change,
 * which conflated configuration with activation; clicking a tile to
 * "preview" a mode would block on the destructive-action orchestrator
 * the moment the dropdown ticked over. Splitting tile-preview from
 * tile-commit (this button) lets the user explore + configure freely.
 */
const ApplyBar: React.FC<{
  previewMode: BackendMode;
  activeMode: BackendMode;
  previewLabel: string;
  host: Host;
  disabled?: boolean;
  onApply: () => void;
}> = ({ previewMode, activeMode, previewLabel, host, disabled, onApply }) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const url = useSettingValue('backend.url');
  const [testing, setTesting] = useState(false);
  const isActive = previewMode === activeMode;
  const validForHost = isModeValidForHost(previewMode, host);
  const localHostIsBackend = hostIsTheBackend(previewMode, host);
  const pending = backendModeIsPending(previewMode);
  // Test connection only when the host would be a CLIENT of this
  // back-end. Suppressed for in-browser on the extension (the SW IS
  // the back-end) and for desktop-app on the desktop host (the main
  // process IS the back-end). Suppressed entirely for host-invalid
  // previews (e.g. desktop previewing in-browser) and for pending
  // modes that don't have a shipped daemon to probe yet.
  const showTest =
    validForHost && !localHostIsBackend && !pending && backendModeNeedsConnection(previewMode);
  // `previewMode` matches the previewed Connection-target, so the
  // probe sends a HELLO that role-claims this host. The peer's
  // workspaceId field is unused for the probe's reachability check —
  // it's still required by the schema, so we mint a per-probe synthetic
  // id rather than leaking the local active workspace. A peer that
  // doesn't know that id replies with `workspace-unknown` which we
  // surface as "Reachable, but doesn't share a workspace yet."
  const probe = useMemo(() => {
    const role = host === 'desktop' ? 'desktop' : host === 'web' ? 'web' : 'extension';
    return async (): Promise<void> => {
      setTesting(true);
      const key = 'backend-probe';
      message.loading({ key, content: `Probing ${url}…`, duration: 0 });
      // Race the probe against a minimum dwell so a successful localhost
      // round-trip (often <10ms) doesn't flash through the loading state
      // too fast to read. Users perceive instant-toast as "did anything
      // happen?"; the 500ms floor turns it into a deliberate "I tried,
      // here's the result" beat.
      const MIN_LOADING_MS = 500;
      const [result] = await Promise.all([
        probeBackendConnection(url, {
          agent: `${role}-probe`,
          nodeId: `probe-${generateUid()}`,
          workspaceId: `probe-${generateUid()}`,
          role,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
      ]);
      setTesting(false);
      if (result.ok) {
        message.success({
          key,
          content: `${previewLabel} is reachable.`,
        });
        return;
      }
      message.error({ key, content: humanizeProbeFailure(result) });
    };
  }, [host, url, message, previewLabel]);
  let statusCopy: React.ReactNode;
  if (isActive) {
    statusCopy = (
      <>
        <strong style={{ color: token.colorText }}>{previewLabel}</strong> is the active back-end.
      </>
    );
  } else if (!validForHost) {
    statusCopy = (
      <>
        <strong style={{ color: token.colorText }}>{previewLabel}</strong> isn't available on this host.
      </>
    );
  } else if (pending) {
    statusCopy = (
      <>
        <strong style={{ color: token.colorText }}>{previewLabel}</strong> is coming soon.
      </>
    );
  } else {
    statusCopy = (
      <>
        Previewing <strong style={{ color: token.colorText }}>{previewLabel}</strong>. Apply to switch.
      </>
    );
  }
  return (
    <div
      style={{
        // Sticky to the bottom of the scrollable settings pane so the
        // main actions stay reachable no matter how far the user has
        // scrolled into the config panel. `bottom: 0` anchors to the
        // pane viewport; the parent has its own padding which we
        // counter-act with a small negative bottom margin so the bar
        // hugs the edge without a gap.
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 14,
        padding: '10px 12px',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        boxShadow: `0 -4px 12px -8px ${token.colorBgLayout}`,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: token.colorTextSecondary }}>{statusCopy}</span>
      {showTest && (
        <Button
          icon={<ExperimentOutlined />}
          onClick={() => {
            void probe();
          }}
          loading={testing}
        >
          Test connection
        </Button>
      )}
      <Button
        type="primary"
        icon={<SwapOutlined />}
        onClick={onApply}
        disabled={isActive || disabled || !validForHost || pending}
      >
        Switch to {previewLabel}
      </Button>
    </div>
  );
};

function humanizeProbeFailure(
  result: Extract<Awaited<ReturnType<typeof probeBackendConnection>>, { ok: false }>,
): string {
  switch (result.reason) {
    case 'invalid-url':
      return `Invalid URL. ${result.detail ?? ''}`.trim();
    case 'timeout':
      return 'Timed out waiting for a response — is the back-end running?';
    case 'closed-before-welcome':
      return 'Connection closed before the handshake — back-end likely not running on that port.';
    case 'open-failed':
      return `Could not open WebSocket${result.detail ? `: ${result.detail}` : ''}.`;
    case 'protocol-mismatch':
      return 'Reachable, but protocol versions are incompatible — update both apps.';
    case 'handshake-rejected':
      if (result.rejectReason === 'workspace-unknown') {
        return 'Reachable — the back-end is up but doesn\'t share this workspace yet. Switching will pair the two.';
      }
      if (result.rejectReason === 'protocol-too-old') {
        return 'Reachable — but this app is older than the back-end. Update this side.';
      }
      if (result.rejectReason === 'protocol-too-new') {
        return 'Reachable — but the back-end is older than this app. Update the back-end.';
      }
      if (result.rejectReason === 'auth-required') {
        return 'Reachable — but requires authentication (Phase D).';
      }
      return `Rejected: ${result.rejectReason ?? 'unknown reason'}`;
    case 'malformed-welcome':
      return 'Reached a server, but it didn\'t speak the Open Headers protocol.';
    default:
      return 'Probe failed.';
  }
}

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
            right: 6,
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

// ── Picker ─────────────────────────────────────────────────────────

interface ModePickerProps {
  scenarios: readonly ScenarioDescriptor[];
  /** The mode the tile row is previewing right now (purely visual). */
  previewMode: BackendMode;
  /** The mode that's actually persisted to `backend.mode` (the system setting). */
  activeMode: BackendMode;
  /**
   * The mode whose back-end is currently confirmed live (SW running
   * for `in-browser`, WS green for others). `null` while connecting
   * or when sync is disabled.
   */
  liveMode: BackendMode | null;
  /** Current host — drives per-tile validity (extension can pick any;
   *  desktop / web can't host an in-browser back-end). */
  host: Host;
  /** Tile click — updates the local preview only, not the setting. */
  onPreview: (next: BackendMode) => void;
}

const ModePicker: React.FC<ModePickerProps> = ({
  scenarios,
  previewMode,
  activeMode,
  liveMode,
  host,
  onPreview,
}) => (
  <div
    role="radiogroup"
    aria-label="Backend mode preview"
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(scenarios.length, 4)}, minmax(0, 1fr))`,
      gap: 8,
      marginBottom: 14,
    }}
  >
    {scenarios.map((s) => (
      <PickerButton
        key={s.mode}
        descriptor={s}
        /** "Previewing this tile" — primary border + tint. */
        preview={previewMode === s.mode}
        /** This is the active back-end (independent of preview). */
        active={activeMode === s.mode}
        /** Active AND its connection is live. */
        live={liveMode === s.mode}
        /** Selectable on this host — controls visual dim, NOT click.
         *  The tile is always previewable so users can read about
         *  modes their host can't run; downstream UI (Apply, Test,
         *  config inputs) handles the actual gating. */
        validForHost={s.validHosts.includes(host)}
        onSelect={() => onPreview(s.mode)}
      />
    ))}
  </div>
);

const PickerButton: React.FC<{
  descriptor: ScenarioDescriptor;
  /** Currently being previewed by the user (purely visual). */
  preview: boolean;
  /** Currently the active system back-end. Drives the ACTIVE chip together with `live`. */
  active: boolean;
  /** Back-end for this mode is actually connected. */
  live: boolean;
  /** Whether this tile can be SWITCHED INTO on this host. Click still
   *  previews (so users can read about modes their host can't run);
   *  visual dim + tooltip communicate that switching is gated downstream. */
  validForHost: boolean;
  onSelect: () => void;
}> = ({ descriptor, preview, active, live, validForHost, onSelect }) => {
  const { token } = theme.useToken();
  const pending = backendModeIsPending(descriptor.mode);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={preview}
      title={
        validForHost
          ? undefined
          : "Can't switch to this back-end from this host. Click to preview the docs anyway."
      }
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 10px',
        borderRadius: 8,
        background: preview ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${preview ? token.colorPrimary : token.colorBorderSecondary}`,
        cursor: 'pointer',
        opacity: validForHost ? 1 : 0.55,
        transition: 'border-color 120ms, background 120ms, opacity 120ms',
        fontFamily: 'inherit',
        color: token.colorText,
        textAlign: 'left',
        // Anchor for the absolute-positioned status chip; keeps the
        // chip out of the title's flex track so "Desktop App" /
        // "Remote / WAN" stay on one line.
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: preview ? 'none' : 'grayscale(0.7) opacity(0.7)',
          transition: 'filter 120ms',
        }}
      >
        <BackendIcon kind={descriptor.icon} size={28} />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {descriptor.title}
      </div>
      <CornerTag active={active} live={live} pending={pending} />
    </button>
  );
};

/**
 * Status tag overlay on a picker tile. Absolute-positioned at the
 * top-right so it doesn't compete with the title text for flex space —
 * "Desktop App" / "Remote / WAN" stay on one line.
 *
 * "ACTIVE" (green) only when the back-end for THIS mode is the active
 * one AND its connection is live; "SELECTED" (primary) when active but
 * still connecting; "SOON" marks not-yet-shipped scenarios.
 */
const CornerTag: React.FC<{
  /** This mode is the persisted system back-end. */
  active: boolean;
  /** The active back-end is actually connected. Pairs with `active`. */
  live: boolean;
  pending: boolean;
}> = ({ active, live, pending }) => {
  const { token } = theme.useToken();
  const tags: Array<{ label: string; bg: string; color: string; border: string }> = [];
  if (active && live) {
    // Configured AND connected — the strong "this is serving you right now" signal.
    tags.push({
      label: 'Active',
      bg: token.colorSuccess,
      color: token.colorTextLightSolid,
      border: token.colorSuccess,
    });
  } else if (active) {
    // Configured but not yet live — useful while the WS is connecting.
    tags.push({
      label: 'Selected',
      bg: token.colorPrimary,
      color: token.colorTextLightSolid,
      border: token.colorPrimary,
    });
  }
  if (pending) {
    tags.push({
      label: 'Soon',
      bg: token.colorWarningBg,
      color: token.colorWarningText,
      border: token.colorWarningBorder,
    });
  }
  if (tags.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        display: 'inline-flex',
        gap: 4,
        pointerEvents: 'none',
      }}
    >
      {tags.map((t) => (
        <span
          key={t.label}
          style={{
            padding: '0 4px',
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            borderRadius: 999,
            background: t.bg,
            color: t.color,
            border: `1px solid ${t.border}`,
            lineHeight: '11px',
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
};

// ── Live-back-end check ────────────────────────────────────────────

/**
 * `true` when the back-end for the active mode is actually live right
 * now. Two flavors:
 *
 *   1. **Host-implicit live.** When the current host IS the back-end
 *      for the selected mode — extension on `in-browser`, desktop app
 *      on `desktop-app` — the back-end is alive by definition (the SW
 *      / desktop main is running this very code). No status check
 *      needed; we'd just be asking the host whether it's running.
 *   2. **Wire-driven live.** When the current host is a CLIENT of an
 *      external back-end (e.g. extension talking to desktop, or any
 *      host talking to a daemon / VM), liveness is whatever the `sync`
 *      Status subsystem reports — green + "Connected to back-end".
 *
 * `useSyncExternalStore` isn't used because `getStatusSnapshot()`
 * returns a fresh object every call (would trip the snapshot-stability
 * invariant and loop). A simple `useState` + manual subscription works
 * fine for a single boolean derivative.
 */
function useBackendLive(mode: BackendMode, host: Host): boolean {
  const [live, setLive] = useState(() => computeLive(mode, host, getStatusSnapshot().sync));
  useEffect(() => {
    setLive(computeLive(mode, host, getStatusSnapshot().sync));
    return subscribeStatus(() => {
      setLive(computeLive(mode, host, getStatusSnapshot().sync));
    });
  }, [mode, host]);
  return live;
}

function isHostImplicitlyLive(mode: BackendMode, host: Host): boolean {
  if (host === 'extension' && mode === 'in-browser') return true;
  if (host === 'desktop' && mode === 'desktop-app') return true;
  return false;
}

function computeLive(
  mode: BackendMode,
  host: Host,
  sync: import('../../../shared/status').StatusEntry | undefined,
): boolean {
  if (isHostImplicitlyLive(mode, host)) return true;
  if (!sync) return false;
  if (sync.state !== 'green') return false;
  if (mode === 'in-browser') return sync.message === 'Running in this browser';
  return sync.message === 'Connected to back-end';
}

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

  // Two "host IS the back-end" cases: nothing to configure because the
  // wire doesn't exist.
  if (hostIsTheBackend(mode, host)) {
    return (
      <Alert
        type="success"
        showIcon
        message="Nothing to configure"
        description={
          mode === 'in-browser'
            ? 'The browser service worker is the back-end. Workspaces, rules, and vault live in this browser only — no external host to point at.'
            : 'The desktop app process is the back-end. Other localhost clients connect into it; there is no outbound wire to tune.'
        }
      />
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
