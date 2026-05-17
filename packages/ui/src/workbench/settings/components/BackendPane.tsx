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
import { Alert, App as AntApp, Select, theme, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { ModeSwitchVerdict } from '@openheaders/core/sync';
import {
  applyModeSwitchVerdict,
  executeCoexist,
  queryPeerDataPresenceFromBridge,
  requestModeSwitchVerdict,
  summarizeCoexistFailure,
  summarizeCoexistSuccess,
} from '../../../shared/mode-switch';
import { getCurrentHost, type Host } from '../../../shared/host-vocabulary';
import { getStatusSnapshot, subscribe as subscribeStatus } from '../../../shared/status';
import ModeSwitchDialog, {
  type ModeSwitchChoice,
} from '../../components/dialogs/ModeSwitchDialog';
import { useOptionalInspectorNav } from '../../hooks/useInspectorNav';
import { useSetting } from '../hooks';
import type { BackendMode } from '../schema/backend';
import { backendModeIsPending } from '../schema/backend';
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

/** State held while the mode-switch dialog is mounted. */
interface DialogState {
  verdict: Extract<ModeSwitchVerdict, { kind: 'show-dialog' }>;
  from: BackendMode;
  to: BackendMode;
}

function labelForMode(mode: BackendMode): string {
  return SCENARIOS.find((s) => s.mode === mode)?.title ?? mode;
}

const BackendPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useSetting('backend.mode');
  const host = getCurrentHost();
  const { message } = AntApp.useApp();

  // The system setting is `mode`. The 4-tile picker is a PREVIEW
  // explorer — clicking a tile updates a local `previewMode` so the
  // detail diagram + scenario copy switch, but the active back-end
  // doesn't change until the user picks one from the dropdown below
  // the tiles. This lets users compare scenarios visually without
  // committing.
  const [previewMode, setPreviewMode] = useState<BackendMode>(mode);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  // If the stored value isn't valid for the current host (e.g. user
  // imported a config from a different host), correct it. The store's
  // host-aware default keeps `isModified` honest, so this write only
  // happens for genuinely-invalid stored values.
  useEffect(() => {
    const stored = SCENARIOS.find((s) => s.mode === mode);
    if (!stored || !stored.validHosts.includes(host)) {
      const fallback = firstValidMode(host);
      setMode(fallback);
      setPreviewMode(fallback);
    }
  }, [host, mode, setMode]);

  const activeScenario = SCENARIOS.find((s) => s.mode === mode) ?? SCENARIOS[0];
  const previewScenario = SCENARIOS.find((s) => s.mode === previewMode) ?? activeScenario;
  const fieldDefs = defs.filter((d) => d.key !== 'backend.mode');
  const pending = backendModeIsPending(activeScenario.mode);
  const liveBackend = useBackendLive(activeScenario.mode, host);
  const previewingNonActive = previewMode !== mode;

  const commitMode = (next: BackendMode): void => {
    setMode(next);
    setPreviewMode(next);
  };

  // §11.2: route every mode change through the orchestrator. Silent
  // verdicts commit immediately; `peer-unreachable` blocks the switch
  // and surfaces a toast (the user must connect the target host first);
  // `show-dialog` mounts the Coexist/Import/Discard resolution modal.
  // Local query failures degrade to "empty" in the orchestrator so a
  // transient bridge hiccup never permanently traps the user.
  const handleDropdownChange = async (next: BackendMode): Promise<void> => {
    const verdict = await requestModeSwitchVerdict(mode, next, {
      queryPeerPresence: queryPeerDataPresenceFromBridge,
    });
    applyModeSwitchVerdict(verdict, {
      commitMode: () => commitMode(next),
      warnPeerUnreachable: () => {
        message.warning(
          `Connect ${labelForMode(next)} first — the mode-switch needs to inspect both sides before committing.`,
        );
      },
      openDialog: (showDialog) => {
        setDialogState({ verdict: showDialog, from: mode, to: next });
      },
    });
  };

  // Coexist (M3) runs the executor end-to-end; Import (M4) and Discard
  // (M5) still stub. The mode is only committed AFTER a successful
  // executor run — partial failures must not strand the user on a
  // back-end that has half the imported data. The dialog itself
  // prevents the silent-commit-on-data-loss anti-pattern §11.2 calls
  // out; Cancel from the dialog never commits.
  const handleDialogChoose = async (choice: ModeSwitchChoice): Promise<void> => {
    const state = dialogState;
    if (!state) return;
    setDialogState(null);

    if (choice === 'coexist') {
      const result = await executeCoexist();
      if (result.ok) {
        commitMode(state.to);
        message.success(summarizeCoexistSuccess(result, state.from, state.to));
      } else {
        message.warning(summarizeCoexistFailure(result, state.to));
      }
      return;
    }

    // M4/M5 stubs: commit the mode + advise the user that the deeper
    // handler isn't shipped yet. Source data stays where it was; no
    // destructive side effects.
    commitMode(state.to);
    message.info(
      choice === 'import'
        ? 'Import-merge handler not yet shipped; mode switched, your existing target data is untouched.'
        : 'Discard-with-backup handler not yet shipped; mode switched, source data is still on the original host.',
    );
  };

  const handleDialogCancel = (): void => {
    setDialogState(null);
  };

  return (
    <div style={{ padding: '20px 24px 28px' }}>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {category.label}
        </h2>
      </header>

      <ActiveBackendSelect
        host={host}
        intro={HOST_INTRO[host]}
        value={mode}
        onChange={(next) => {
          void handleDropdownChange(next);
        }}
      />

      <ModePicker
        scenarios={SCENARIOS}
        previewMode={previewScenario.mode}
        activeMode={mode}
        liveMode={liveBackend ? mode : null}
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

      <ConfigPanel
        pending={pending}
        mode={activeScenario.mode}
        host={host}
        defs={fieldDefs}
        category={category}
      />

      {dialogState && (
        <ModeSwitchDialog
          open
          fromLabel={labelForMode(dialogState.from)}
          toLabel={labelForMode(dialogState.to)}
          source={dialogState.verdict.source}
          target={dialogState.verdict.target}
          onChoose={(c) => {
            void handleDialogChoose(c);
          }}
          onCancel={handleDialogCancel}
        />
      )}
    </div>
  );
};

/**
 * Card combining the "Active back-end" dropdown (left) with the intro
 * copy (right). Single row to save vertical space.
 */
const ActiveBackendSelect: React.FC<{
  host: Host;
  intro: React.ReactNode;
  value: BackendMode;
  onChange: (next: BackendMode) => void;
}> = ({ host, intro, value, onChange }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 14px',
        marginBottom: 14,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
      }}
    >
      <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: token.colorText }}>
        Active back-end:
      </span>
      <Select<BackendMode>
        size="small"
        value={value}
        onChange={onChange}
        style={{ minWidth: 200, flex: 'none' }}
        options={SCENARIOS.map((s) => {
          const available = s.validHosts.includes(host);
          const pending = backendModeIsPending(s.mode);
          // Pending modes stay selectable (the user pre-selects ahead
          // of the daemon/VM shipping), only host-incompatible modes
          // are hard-disabled.
          return {
            value: s.mode,
            label: `${s.title}${pending ? ' · coming soon' : ''}`,
            disabled: !available,
          };
        })}
      />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: token.colorTextSecondary, textAlign: 'right' }}>
        {intro} <DocsLink />
      </div>
    </div>
  );
};

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
  /** Tile click — updates the local preview only, not the setting. */
  onPreview: (next: BackendMode) => void;
}

const ModePicker: React.FC<ModePickerProps> = ({
  scenarios,
  previewMode,
  activeMode,
  liveMode,
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
  onSelect: () => void;
}> = ({ descriptor, preview, active, live, onSelect }) => {
  const { token } = theme.useToken();
  const pending = backendModeIsPending(descriptor.mode);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={preview}
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
        transition: 'border-color 120ms, background 120ms',
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

  // Two "host IS the back-end" cases: nothing to configure because the
  // wire doesn't exist. The picker already disables in-browser on
  // non-extension hosts, but auto-correction takes a tick — guard both
  // shapes so we never render reconnect rows when the back-end is us.
  const hostIsTheBackend =
    (host === 'extension' && mode === 'in-browser') ||
    (host === 'desktop' && mode === 'desktop-app');

  if (hostIsTheBackend) {
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
  const visibleDefs = defs.filter((d) => {
    if (d.key === 'backend.showBadgeWhenDisconnected' && host !== 'extension') return false;
    return true;
  });

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
