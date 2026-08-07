/**
 * TrafficMonitorSourceRail — the source list of the Traffic Monitor
 * tool window (on the panel's left by default; the `side` prop mirrors
 * every overlay when the user flips the rail to the right), in the
 * sidebar's own idiom (shared {@link SectionHeader}
 * + `rules-sidebar-item` rows inside one `rules-sidebar-content`
 * column). BROWSER TABS — every connected peer under a colored brand
 * roundel with its extension version, each tab as favicon + title like
 * the browser's own tab strip — absorbs the column's slack, so WIRE
 * (the L7 capture partition — any app routed through the capture port)
 * and the SESSIONS opener row ({@link TrafficMonitorSessionsSection})
 * sit anchored at the bottom with no dead space under them. Selecting
 * a row binds the panel's plane views on the right to that source.
 *
 * Favicons arrive as `data:` URIs the EXTENSION resolved from the
 * browser's own favicon cache — the workbench renderer's CSP forbids
 * remote images and the desktop never fetches from sites itself.
 *
 * Presentational: the panel owns the inventory, the proxy status, and
 * the selection; the rail renders and reports clicks.
 */

import {
  BugFilled,
  BugOutlined,
  CaretRightOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileOutlined,
  GlobalOutlined,
  LoadingOutlined,
  PushpinFilled,
} from '@ant-design/icons';
import { getCapability, type InstallTargetBrowser } from '@openheaders/core/capabilities';
import type { TelemetryDebugState } from '@openheaders/core/protocol';
import { Button, Popover, Switch, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { RecordStartIcon, RecordStopIcon } from '@openheaders/ui/shared/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSettingValue } from '../../settings/hooks';
import {
  EXTENSION_STORE_URLS,
  INSTALL_BROWSER_LABELS,
  INSTALLABLE_BROWSERS,
} from '../../data/extension-stores';
import { SectionHeader } from '../sidebar/SectionHeader';
import { BrowserBrandIcon } from './browser-brand-icons';
import { TrafficMonitorSessionsSection } from './TrafficMonitorSessionsSection';

/** Default rail width; the vertical sash can resize it within bounds. */
export const RAIL_DEFAULT_WIDTH = 350;
export const RAIL_MIN_WIDTH = 180;
export const RAIL_MAX_WIDTH = 520;

export interface RailPeerTab {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  /** Small `data:` URI resolved by the extension; absent while cold. */
  favIconUrl?: string;
}

/**
 * Tabs grouped by browser window, in order of appearance. One browser
 * instance is ONE peer — multiple windows show as labeled groups inside
 * it (the label renders only when there is more than one window).
 */
function groupByWindow(tabs: readonly RailPeerTab[]): Array<{ windowId: number; tabs: RailPeerTab[] }> {
  const groups: Array<{ windowId: number; tabs: RailPeerTab[] }> = [];
  const byWindow = new Map<number, RailPeerTab[]>();
  for (const tab of tabs) {
    let group = byWindow.get(tab.windowId);
    if (!group) {
      group = [];
      byWindow.set(tab.windowId, group);
      groups.push({ windowId: tab.windowId, tabs: group });
    }
    group.push(tab);
  }
  return groups;
}

export interface RailPeer {
  nodeId: string;
  agent: string;
  browser: { name: string; platform: string | null };
  /** The peer's Debug-mode (CDP) posture — drives the tab-row affordance. */
  debug: TelemetryDebugState;
  tabs: RailPeerTab[];
  /** The peer's telemetry consent gate — `false` greys the tab rows and
   *  drops the Debug affordances (the browser refuses watches). */
  watchConsent: boolean;
}

export type TrafficSourceKey = string;

export function tabSourceKey(nodeId: string, tabId: number): TrafficSourceKey {
  return `tab:${tabId}@${nodeId}`;
}

export const WIRE_SOURCE_KEY: TrafficSourceKey = 'wire';

export interface TrafficMonitorSourceRailProps {
  /** The pushed live inventory — the panel's tabs watch keeps it
   *  current, so the rail needs no refresh affordance. */
  peers: readonly RailPeer[];
  /** The mount-time baseline pull is in flight. */
  loading: boolean;
  /** Wire row is present only on hosts with the proxyCapture capability. */
  showWire: boolean;
  wireRunning: boolean;
  wirePort: number | null;
  selected: TrafficSourceKey | null;
  onSelect: (key: TrafficSourceKey) => void;
  /** Pin/unpin a tab into the peer's Debug-mode attach scope. */
  onDebugPin: (nodeId: string, tabId: number, pinned: boolean) => void;
  /** Flip the peer's Debug-mode master switch. */
  onDebugEnable: (nodeId: string, enabled: boolean) => void;
  /** Tab sources whose attach/detach is in flight — spinner state. */
  debugPending: ReadonlySet<TrafficSourceKey>;
  /** Peers whose master-switch command is in flight — switch loading. */
  debugEnablePending: ReadonlySet<string>;
  /** Sources armed for AI-agent observation (AGENT_TRAFFIC_PLAN.md §4)
   *  — tab keys plus {@link WIRE_SOURCE_KEY} when the proxy partition
   *  is armed. Armed = the source streams to the desktop app. */
  observeArmed: ReadonlySet<TrafficSourceKey>;
  /** Sources whose observe action is in flight — spinner state. */
  observePending: ReadonlySet<TrafficSourceKey>;
  /** Fire one observe-popover verb on a source. Start bundles arm +
   *  debug fidelity + recording session per its toggles — human
   *  gesture only, the channel has no MCP mirror by design (§11.5). */
  onObserveAction: (key: TrafficSourceKey, action: ObserveAction) => void;
  /** Sources an ACTIVE recording session is capturing. The per-row red
   *  eye is the retention indicator and must be visible the whole time
   *  a session records — PLAN §3. */
  captureActive: ReadonlySet<TrafficSourceKey>;
  /** Open the Traffic Sessions tool window — the SESSIONS row's verb
   *  (§11.1, C5). */
  onOpenSessions: () => void;
  /** Current rail width — the panel owns it (vertical sash resizes it). */
  width: number;
  /** Which side of the panel the rail sits on — overlays (tooltips,
   *  the observe popover) always open AWAY from the rail so they
   *  never clip at the window edge. */
  side: 'left' | 'right';
  /** The wire row's always-visible capture control (Start/Stop split
   *  button + settings chevron) — composed by the panel, which owns
   *  the proxy admin plane; the rail stays presentational. */
  wireControl?: React.ReactNode;
}

/** `@openheaders/extension@2026.7.11` → `2026.7.11` (null when unparsable). */
export function agentVersion(agent: string): string | null {
  const match = agent.match(/@(\d[\w.-]*)$/);
  return match ? match[1] : null;
}

function SourceRow({
  testid,
  active,
  indent = false,
  onClick,
  children,
}: {
  testid: string;
  active: boolean;
  /** Nested under a caret row (peer) — indents like tree children. */
  indent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={active}
      className={`rules-sidebar-item traffic-monitor-source-row${active ? ' selected' : ''}`}
      style={indent ? { paddingLeft: 30 } : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Per-tab Debug-mode toggle: a hover-revealed "debug this tab" action
 * that stays visible once the tab is pinned or attached. Renders inside
 * the row button as a `span` (a nested `<button>` would be invalid), so
 * the click stops propagation instead of selecting the row.
 */
function TabDebugAffordance({
  attached,
  pinned,
  pending,
  placement,
  onToggle,
}: {
  attached: boolean;
  pinned: boolean;
  /** An attach/detach the last click triggered is still in flight. */
  pending: boolean;
  /** Away from the rail's side (see the rail's `side` prop). */
  placement: 'left' | 'right';
  onToggle: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const title = attached
    ? t('workbench.trafficMonitor.debugAttached')
    : pinned
      ? t('workbench.trafficMonitor.debugPinned')
      : t('workbench.trafficMonitor.debugTab');
  const icon = pending ? (
    <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary }} />
  ) : attached ? (
    <BugFilled style={{ fontSize: 12, color: token.colorPrimary }} />
  ) : pinned ? (
    <PushpinFilled style={{ fontSize: 12, color: token.colorWarning }} />
  ) : (
    <BugOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
  );
  return (
    <Tooltip title={title} placement={placement}>
      <span
        role="button"
        tabIndex={0}
        data-testid="traffic-monitor-tab-debug"
        aria-label={t('workbench.trafficMonitor.debugPinAria')}
        aria-pressed={attached || pinned}
        aria-busy={pending}
        className={`rules-sidebar-item-hover-action${
          pending || attached || pinned ? ' rules-sidebar-item-hover-action--pinned' : ''
        }`}
        style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}
        onClick={(e) => {
          e.stopPropagation();
          if (!pending) onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!pending) onToggle();
          }
        }}
      >
        {icon}
      </span>
    </Tooltip>
  );
}

/**
 * The two verbs the observe popover can fire (PLAN §11.1 — one
 * gesture, one bundle). `start` carries the gesture's effective
 * Advanced toggles: debug fidelity and the recording session ride the
 * arm as ONE bundle, and both stay human clicks, so the no-MCP-mirror
 * law (§11.5) holds. `stop` unwinds the whole bundle.
 */
export type ObserveAction = { kind: 'start'; debug: boolean; save: boolean } | { kind: 'stop' };

/** The popover's lead row: icon + the verb CLICKING THE GLYPH fires,
 *  with an honesty hint below. Informational, never a button — the
 *  record glyph itself is the start/stop control. */
function ObserveMenuHeader({
  testid,
  icon,
  title,
  hint,
}: {
  testid: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  const { token } = theme.useToken();
  return (
    <div data-testid={testid} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px' }}>
      <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', paddingTop: 1 }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
        {hint !== undefined && (
          <span style={{ fontSize: 11, color: token.colorTextTertiary, textAlign: 'left' }}>{hint}</span>
        )}
      </span>
    </div>
  );
}

/** One popover toggle row: label + hint on the left, a small switch on
 *  the right. Clicks stay inside the popover — toggling never fires a
 *  verb, only the primary option does. */
function ObserveMenuToggle({
  testid,
  title,
  hint,
  checked,
  onChange,
}: {
  testid: string;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 8px 4px 24px' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto' }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>{hint}</span>
      </span>
      <Switch size="small" data-testid={testid} checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

/**
 * Per-source observation affordance (AGENT_TRAFFIC_PLAN.md §11.1 —
 * one gesture, one bundle): the record glyph (the browser devtools'
 * own record-start/record-stop pair) IS the verb — clicking it starts
 * observing idle, stops armed/recording. The hover popover never
 * carries a clickable verb: it states what the click will do, and
 * idle it adds an Advanced expand/collapse over the two bundled
 * toggles — Debug mode (full fidelity; shown only where the peer has
 * the debugger) and Save session — seeded from their Settings
 * defaults per open; the start click bundles whatever they say.
 * Colors state the stakes — blue (the Debug affordance's color) =
 * streaming to the desktop app, red = also recording to the session
 * archive — and the red record-stop glyph IS the per-row retention
 * indicator, always visible, never hover-revealed, the whole time a
 * session records (PLAN §3).
 */
function SourceObserveAffordance({
  armed,
  capturing,
  pending,
  debugAvailable,
  placement,
  onAction,
}: {
  armed: boolean;
  /** An ACTIVE recording session is capturing this source. */
  capturing: boolean;
  /** An action the last click triggered is still in flight. */
  pending: boolean;
  /** The peer offers CDP debug fidelity for this source. */
  debugAvailable: boolean;
  /** Away from the rail's side; bottom-anchored either way (see below). */
  placement: 'leftBottom' | 'rightBottom';
  onAction: (action: ObserveAction) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const debugDefault = useSettingValue('trafficMonitor.observeDebugDefault');
  const saveDefault = useSettingValue('trafficMonitor.observeSaveDefault');
  const [menuOpen, setMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Seeded from the Settings defaults so a glyph click that never
  // opened the popover still bundles the configured posture.
  const [debugOn, setDebugOn] = useState<boolean>(() => debugDefault);
  const [saveOn, setSaveOn] = useState<boolean>(() => saveDefault);
  // The record glyphs draw on the browser's padded 20x20 grid, so they
  // render a size up to hold the same optical weight as the 16-grid
  // neighbours (the bug/pin affordances).
  const icon = pending ? (
    <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary }} />
  ) : capturing ? (
    <RecordStopIcon style={{ fontSize: 14, color: token.colorError }} />
  ) : armed ? (
    <RecordStopIcon style={{ fontSize: 14, color: token.colorPrimary }} />
  ) : (
    <RecordStartIcon style={{ fontSize: 14, color: token.colorTextTertiary }} />
  );
  const fire = (action: ObserveAction): void => {
    setMenuOpen(false);
    onAction(action);
  };
  const options =
    armed || capturing ? (
      <ObserveMenuHeader
        testid="traffic-monitor-observe-stop"
        icon={<EyeInvisibleOutlined style={{ fontSize: 12, color: capturing ? token.colorError : token.colorPrimary }} />}
        title={t('workbench.trafficMonitor.observeMenuStop')}
        {...(capturing ? { hint: t('workbench.trafficMonitor.observeMenuStopRecordingHint') } : {})}
      />
    ) : (
      <>
        <ObserveMenuHeader
          testid="traffic-monitor-observe-start"
          icon={<EyeOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
          title={t('workbench.trafficMonitor.observeMenuStart')}
          hint={t('workbench.trafficMonitor.observeMenuStartHint')}
        />
        <button
          type="button"
          data-testid="traffic-monitor-observe-advanced"
          aria-expanded={advancedOpen}
          className="traffic-monitor-observe-option"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', paddingTop: 1 }}>
            <CaretRightOutlined
              style={{
                fontSize: 10,
                color: token.colorTextTertiary,
                transition: 'transform 0.2s',
                transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {t('workbench.trafficMonitor.observeAdvanced')}
          </span>
        </button>
        {advancedOpen && (
          <>
            {debugAvailable && (
              <ObserveMenuToggle
                testid="traffic-monitor-observe-debug"
                title={t('shared.chrome.debug.title')}
                hint={t('workbench.trafficMonitor.observeDebugOptionHint')}
                checked={debugOn}
                onChange={setDebugOn}
              />
            )}
            <ObserveMenuToggle
              testid="traffic-monitor-observe-save"
              title={t('workbench.trafficMonitor.observeSaveOption')}
              hint={t('workbench.trafficMonitor.observeSaveOptionHint')}
              checked={saveOn}
              onChange={setSaveOn}
            />
          </>
        )}
      </>
    );
  return (
    <Popover
      open={menuOpen}
      onOpenChange={(open) => {
        if (open) {
          if (pending) return;
          // Each open re-seeds the Advanced toggles from their Settings
          // defaults — the gesture overrides per session, never durably.
          setDebugOn(debugDefault);
          setSaveOn(saveDefault);
          setAdvancedOpen(false);
        }
        setMenuOpen(open);
      }}
      trigger="hover"
      // Bottom-anchored so the overlay opens ABOVE the row: source rows
      // live near the panel's bottom edge, where a downward overlay
      // runs off the window. Toggling Advanced grows the overlay upward
      // AROUND a stationary cursor (never out from under it — the
      // hover-close hazard a centered placement's re-centering causes).
      placement={placement}
      overlayInnerStyle={{ padding: 4 }}
      content={
        // The overlay is portaled but React still bubbles its events
        // through the owner tree — without this stop, every click inside
        // the popover also fires the host row's select.
        // biome-ignore lint/a11y/noStaticElementInteractions: propagation fence, not an interactive control
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 260 }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {options}
        </div>
      }
    >
      <span
        role="button"
        tabIndex={0}
        data-testid={capturing ? 'traffic-monitor-source-capturing' : 'traffic-monitor-source-observe'}
        aria-label={t('workbench.trafficMonitor.observeAria')}
        aria-pressed={armed || capturing}
        aria-busy={pending}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`rules-sidebar-item-hover-action${
          pending || armed || capturing || menuOpen ? ' rules-sidebar-item-hover-action--pinned' : ''
        }`}
        style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}
        onClick={(e) => {
          // The glyph IS the verb: start idle, stop armed/recording.
          e.stopPropagation();
          if (pending) {
            e.preventDefault();
            return;
          }
          fire(
            armed || capturing ? { kind: 'stop' } : { kind: 'start', debug: debugAvailable && debugOn, save: saveOn },
          );
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (pending) return;
            fire(
              armed || capturing
                ? { kind: 'stop' }
                : { kind: 'start', debug: debugAvailable && debugOn, save: saveOn },
            );
          }
        }}
      >
        {icon}
      </span>
    </Popover>
  );
}

export const TrafficMonitorSourceRail: React.FC<TrafficMonitorSourceRailProps> = ({
  peers,
  loading,
  showWire,
  wireRunning,
  wirePort,
  selected,
  onSelect,
  onDebugPin,
  onDebugEnable,
  debugPending,
  debugEnablePending,
  observeArmed,
  observePending,
  onObserveAction,
  captureActive,
  onOpenSessions,
  width,
  side,
  wireControl,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  // Overlays open AWAY from the rail's side, toward the plane views;
  // popovers additionally anchor at the row's bottom and grow upward
  // (source rows sit near the panel's bottom edge).
  const tooltipPlacement = side === 'left' ? ('right' as const) : ('left' as const);
  const popoverPlacement = side === 'left' ? ('rightBottom' as const) : ('leftBottom' as const);
  const [browsersOpen, setBrowsersOpen] = useState(true);
  const [wireOpen, setWireOpen] = useState(true);
  // Per-peer expansion, expanded by default — the peer row is a
  // collection-style caret row over its window groups and tab rows.
  const [collapsedPeers, setCollapsedPeers] = useState<ReadonlySet<string>>(() => new Set());
  const togglePeer = (nodeId: string): void => {
    setCollapsedPeers((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Install CTA — a store listing must land in the browser that will
  // install the extension, so the named-browser capability leads and
  // the default-browser open is the degraded path.
  const openStore = useCallback((browser: InstallTargetBrowser) => {
    const url = EXTENSION_STORE_URLS[browser];
    const named = getCapability('openUrlInBrowser');
    if (named) {
      void named(url, browser);
      return;
    }
    void getCapability('openExternalUrl')?.(url);
  }, []);

  const browsersSection = (
    <>
      <SectionHeader
        title={t('workbench.trafficMonitor.browserTabs')}
        expanded={browsersOpen}
        onToggle={() => setBrowsersOpen((v) => !v)}
        actions={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Tag
              color={peers.length > 0 ? 'green' : undefined}
              style={{ margin: 0 }}
              data-testid="traffic-monitor-peers"
            >
              {peers.length > 0
                ? t('workbench.trafficMonitor.browserConnected', { count: peers.length })
                : t('workbench.trafficMonitor.noBrowser')}
            </Tag>
            {loading && <LoadingOutlined spin style={{ fontSize: 11, color: token.colorTextTertiary }} />}
          </span>
        }
      />
      {browsersOpen && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
          {peers.length === 0 && !loading && (
            <div
              data-testid="traffic-monitor-install-ctas"
              style={{
                padding: '8px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {t('workbench.trafficMonitor.noBrowsersHint')}
              </span>
              {INSTALLABLE_BROWSERS.map((browser) => (
                <Button
                  key={browser}
                  size="small"
                  data-testid={`traffic-monitor-install-${browser}`}
                  icon={<BrowserBrandIcon name={INSTALL_BROWSER_LABELS[browser]} size={14} />}
                  onClick={() => openStore(browser)}
                >
                  {t('workbench.trafficMonitor.installExtension', { browser: INSTALL_BROWSER_LABELS[browser] })}
                </Button>
              ))}
            </div>
          )}
          {peers.map((peer) => {
            const version = agentVersion(peer.agent);
            const expanded = !collapsedPeers.has(peer.nodeId);
            return (
              <div key={peer.nodeId}>
                <div className="traffic-monitor-peer-row">
                  <button
                    type="button"
                    data-testid="traffic-monitor-peer"
                    aria-expanded={expanded}
                    className="rules-sidebar-item traffic-monitor-source-row"
                    onClick={() => togglePeer(peer.nodeId)}
                  >
                    <CaretRightOutlined
                      style={{
                        color: token.colorTextTertiary,
                        fontSize: 10,
                        transition: 'transform 0.2s',
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                    <BrowserBrandIcon name={peer.browser.name} />
                    <span className="rules-sidebar-item-label">
                      {peer.browser.name}
                      <span style={{ color: token.colorTextTertiary }}>
                        {version !== null
                          ? ` · ${t('workbench.trafficMonitor.extensionVersion', { version })}`
                          : ` · ${peer.agent}`}
                      </span>
                    </span>
                  </button>
                  {!peer.watchConsent && (
                    <Tooltip title={t('workbench.trafficMonitor.watchConsentOffHint')} placement={tooltipPlacement}>
                      <Tag
                        data-testid="traffic-monitor-peer-consent-off"
                        icon={<EyeInvisibleOutlined />}
                        style={{ margin: 0, flex: '0 0 auto' }}
                      >
                        {t('workbench.trafficMonitor.watchConsentOff')}
                      </Tag>
                    </Tooltip>
                  )}
                  {peer.debug.available && peer.watchConsent && (
                    <Tooltip title={t('workbench.trafficMonitor.debugModeHint')} placement={tooltipPlacement}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
                          {t('shared.chrome.debug.title')}
                        </span>
                        <Switch
                          size="small"
                          data-testid="traffic-monitor-peer-debug"
                          checked={peer.debug.enabled}
                          loading={debugEnablePending.has(peer.nodeId)}
                          onChange={(checked) => onDebugEnable(peer.nodeId, checked)}
                          aria-label={t('shared.chrome.debug.toggleAria')}
                        />
                      </span>
                    </Tooltip>
                  )}
                </div>
                {expanded &&
                  groupByWindow(peer.tabs).map((group, index, groups) => (
                    <div key={group.windowId}>
                      {groups.length > 1 && (
                        <div style={{ padding: '4px 14px 0 30px', fontSize: 11, color: token.colorTextTertiary }}>
                          {t('workbench.trafficMonitor.windowLabel', { n: index + 1 })}
                        </div>
                      )}
                      {group.tabs.map((tab) => {
                        const key = tabSourceKey(peer.nodeId, tab.tabId);
                        const title = tab.title || tab.url || t('workbench.trafficMonitor.untitledTab');
                        return (
                          <Tooltip key={key} title={tab.url} placement={tooltipPlacement}>
                            <SourceRow
                              testid="traffic-monitor-source-tab"
                              active={selected === key}
                              indent
                              onClick={() => onSelect(key)}
                            >
                              {tab.favIconUrl?.startsWith('data:') ? (
                                <img
                                  src={tab.favIconUrl}
                                  alt=""
                                  width={14}
                                  height={14}
                                  style={{ flex: '0 0 auto', borderRadius: 2, opacity: peer.watchConsent ? 1 : 0.5 }}
                                />
                              ) : (
                                <FileOutlined
                                  style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }}
                                />
                              )}
                              <span
                                className="rules-sidebar-item-label"
                                style={peer.watchConsent ? undefined : { color: token.colorTextTertiary }}
                              >
                                {title}
                              </span>
                              {peer.watchConsent && (
                                <SourceObserveAffordance
                                  armed={observeArmed.has(key)}
                                  capturing={captureActive.has(key)}
                                  pending={observePending.has(key)}
                                  debugAvailable={peer.debug.available}
                                  placement={popoverPlacement}
                                  onAction={(action) => onObserveAction(key, action)}
                                />
                              )}
                              {peer.debug.available && peer.watchConsent && (
                                <TabDebugAffordance
                                  attached={peer.debug.attachedTabs.includes(tab.tabId)}
                                  pinned={peer.debug.pinnedTabs.includes(tab.tabId)}
                                  pending={debugPending.has(key)}
                                  placement={tooltipPlacement}
                                  onToggle={() =>
                                    onDebugPin(peer.nodeId, tab.tabId, !peer.debug.pinnedTabs.includes(tab.tabId))
                                  }
                                />
                              )}
                            </SourceRow>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const wireSection = showWire ? (
    <>
      <SectionHeader
        title={t('workbench.trafficMonitor.proxySystem')}
        expanded={wireOpen}
        onToggle={() => setWireOpen((v) => !v)}
        actions={
          // Running/Stopped rides the section header — the BROWSER TABS
          // posture (the connected-browsers tag), keeping the source row
          // itself to identity + affordances.
          <Tag color={wireRunning ? 'green' : undefined} style={{ margin: 0 }} data-testid="traffic-monitor-wire-status">
            {wireRunning && wirePort !== null
              ? t('workbench.proxyCapture.running', { port: wirePort })
              : t('workbench.proxyCapture.stopped')}
          </Tag>
        }
      />
      {wireOpen && (
        <Tooltip title={t('workbench.trafficMonitor.trafficInterceptionHint')} placement={tooltipPlacement}>
          <SourceRow
            testid="traffic-monitor-source-wire"
            active={selected === WIRE_SOURCE_KEY}
            onClick={() => onSelect(WIRE_SOURCE_KEY)}
          >
            <GlobalOutlined style={{ fontSize: 12, flex: '0 0 auto' }} />
            <span className="rules-sidebar-item-label">{t('workbench.trafficMonitor.trafficInterception')}</span>
            <SourceObserveAffordance
              armed={observeArmed.has(WIRE_SOURCE_KEY)}
              capturing={captureActive.has(WIRE_SOURCE_KEY)}
              pending={observePending.has(WIRE_SOURCE_KEY)}
              debugAvailable={false}
              placement={popoverPlacement}
              onAction={(action) => onObserveAction(WIRE_SOURCE_KEY, action)}
            />
            {wireControl}
          </SourceRow>
        </Tooltip>
      )}
    </>
  ) : null;

  return (
    <div
      data-testid="traffic-monitor-source-rail"
      style={{
        flex: `0 0 ${width}px`,
        width,
        maxWidth: width,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div className="rules-sidebar-content">
        {browsersSection}
        {/* The browsers body absorbs the column's slack while open; when
            collapsed this spacer takes over so WIRE and SESSIONS stay
            anchored at the bottom. */}
        {!browsersOpen && <div style={{ flex: 1 }} />}
        {wireSection}
        <TrafficMonitorSessionsSection onOpenArchive={onOpenSessions} tooltipPlacement={tooltipPlacement} />
      </div>
    </div>
  );
};
