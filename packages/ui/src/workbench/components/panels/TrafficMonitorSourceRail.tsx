/**
 * TrafficMonitorSourceRail — the right-hand source list of the Traffic Monitor
 * tool window. Three collapsible sections in the sidebar's own idiom
 * (shared {@link SectionHeader} + `rules-sidebar-item` rows inside one
 * `rules-sidebar-content` column — collapsed sections shrink to their
 * headers, expanded bodies share the space, exactly like the workspace
 * sidebar's sections): BROWSER TABS — every connected peer under a
 * colored brand roundel with its extension version, each tab as
 * favicon + title like the browser's own tab strip — WIRE, the L7
 * capture partition (any app routed through the capture port) — and
 * SESSIONS, live recording state only
 * ({@link TrafficMonitorSessionsSection}). Selecting a row binds the
 * panel's plane views on the left to that source.
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
  EyeFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileOutlined,
  GlobalOutlined,
  LoadingOutlined,
  PushpinFilled,
} from '@ant-design/icons';
import { getCapability, type InstallTargetBrowser } from '@openheaders/core/capabilities';
import type { TelemetryDebugState } from '@openheaders/core/protocol';
import type { TrafficCaptureSessionProjection } from '@openheaders/core/traffic';
import { Button, Popover, Switch, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
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
  /** LIVE sessions only (recording/sealing) — the SESSIONS section's
   *  rows; sealed sessions belong to the C5 sessions window. */
  sessions: ReadonlyArray<TrafficCaptureSessionProjection>;
  /** Sessions whose stop command is in flight — spinner state. */
  sessionPending: ReadonlySet<string>;
  /** Stop an ACTIVE session from its row. */
  onSessionStop: (session: TrafficCaptureSessionProjection) => void;
  /** Open the Traffic Sessions tool window — the section's go-to into
   *  the archive (§11.1, C5). */
  onOpenSessions: () => void;
  /** Current rail width — the panel owns it (vertical sash resizes it). */
  width: number;
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
  onToggle,
}: {
  attached: boolean;
  pinned: boolean;
  /** An attach/detach the last click triggered is still in flight. */
  pending: boolean;
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
    <Tooltip title={title} placement="left">
      <span
        role="button"
        tabIndex={0}
        data-testid="traffic-monitor-tab-debug"
        aria-label={t('workbench.trafficMonitor.debugPinAria')}
        aria-pressed={attached || pinned}
        aria-busy={pending}
        className={pending || attached || pinned ? undefined : 'rules-sidebar-item-hover-action'}
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

/** One popover option row: icon + title, optional honesty hint below. */
function ObserveMenuOption({
  testid,
  icon,
  title,
  hint,
  onClick,
}: {
  testid: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  return (
    <button type="button" data-testid={testid} className="traffic-monitor-observe-option" onClick={onClick}>
      <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', paddingTop: 1 }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
        {hint !== undefined && (
          <span style={{ fontSize: 11, color: token.colorTextTertiary, textAlign: 'left' }}>{hint}</span>
        )}
      </span>
    </button>
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
 * one gesture, one bundle): the eye opens a popover with ONE primary
 * verb. Idle it offers "Start observing", with an Advanced
 * expand/collapse over the two bundled toggles — Debug mode (full
 * fidelity; shown only where the peer has the debugger) and Save
 * session — seeded from their Settings defaults per open. Armed or
 * recording it offers the single stop, which unwinds the whole
 * bundle. Colors state the stakes — blue (the Debug affordance's
 * color) = streaming to the desktop app, red = also recording to the
 * session archive — and the red eye IS the per-row retention
 * indicator, always visible, never hover-revealed, the whole time a
 * session records (PLAN §3).
 */
function SourceObserveAffordance({
  armed,
  capturing,
  pending,
  debugAvailable,
  onAction,
}: {
  armed: boolean;
  /** An ACTIVE recording session is capturing this source. */
  capturing: boolean;
  /** An action the last click triggered is still in flight. */
  pending: boolean;
  /** The peer offers CDP debug fidelity for this source. */
  debugAvailable: boolean;
  onAction: (action: ObserveAction) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const debugDefault = useSettingValue('trafficMonitor.observeDebugDefault');
  const saveDefault = useSettingValue('trafficMonitor.observeSaveDefault');
  const [menuOpen, setMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugOn, setDebugOn] = useState(true);
  const [saveOn, setSaveOn] = useState(true);
  const title = capturing
    ? t('workbench.trafficMonitor.observeCapturing')
    : armed
      ? t('workbench.trafficMonitor.observeArmed')
      : t('workbench.trafficMonitor.observeArm');
  const icon = pending ? (
    <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary }} />
  ) : capturing ? (
    <EyeFilled style={{ fontSize: 12, color: token.colorError }} />
  ) : armed ? (
    <EyeFilled style={{ fontSize: 12, color: token.colorPrimary }} />
  ) : (
    <EyeOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
  );
  const fire = (action: ObserveAction): void => {
    setMenuOpen(false);
    onAction(action);
  };
  const options =
    armed || capturing ? (
      <ObserveMenuOption
        testid="traffic-monitor-observe-stop"
        icon={<EyeInvisibleOutlined style={{ fontSize: 12, color: capturing ? token.colorError : token.colorPrimary }} />}
        title={t('workbench.trafficMonitor.observeMenuStop')}
        {...(capturing ? { hint: t('workbench.trafficMonitor.observeMenuStopRecordingHint') } : {})}
        onClick={() => fire({ kind: 'stop' })}
      />
    ) : (
      <>
        <ObserveMenuOption
          testid="traffic-monitor-observe-start"
          icon={<EyeOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
          title={t('workbench.trafficMonitor.observeMenuStart')}
          hint={t('workbench.trafficMonitor.observeMenuStartHint')}
          onClick={() => fire({ kind: 'start', debug: debugAvailable && debugOn, save: saveOn })}
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
      trigger="click"
      placement="left"
      overlayInnerStyle={{ padding: 4 }}
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 260 }}>{options}</div>
      }
    >
      <Tooltip title={title} placement="left" {...(menuOpen ? { open: false } : {})}>
        <span
          role="button"
          tabIndex={0}
          data-testid={capturing ? 'traffic-monitor-source-capturing' : 'traffic-monitor-source-observe'}
          aria-label={t('workbench.trafficMonitor.observeAria')}
          aria-pressed={armed || capturing}
          aria-busy={pending}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={pending || armed || capturing || menuOpen ? undefined : 'rules-sidebar-item-hover-action'}
          style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}
          onClick={(e) => {
            e.stopPropagation();
            if (pending) e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (!pending) setMenuOpen((v) => !v);
            }
          }}
        >
          {icon}
        </span>
      </Tooltip>
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
  sessions,
  sessionPending,
  onSessionStop,
  onOpenSessions,
  width,
}) => {
  const t = useT();
  const { token } = theme.useToken();
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
                    <Tooltip title={t('workbench.trafficMonitor.watchConsentOffHint')} placement="left">
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
                    <Tooltip title={t('workbench.trafficMonitor.debugModeHint')} placement="left">
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
                          <Tooltip key={key} title={tab.url} placement="left">
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
                                  onAction={(action) => onObserveAction(key, action)}
                                />
                              )}
                              {peer.debug.available && peer.watchConsent && (
                                <TabDebugAffordance
                                  attached={peer.debug.attachedTabs.includes(tab.tabId)}
                                  pinned={peer.debug.pinnedTabs.includes(tab.tabId)}
                                  pending={debugPending.has(key)}
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
      />
      {wireOpen && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
          <Tooltip title={t('workbench.trafficMonitor.trafficInterceptionHint')} placement="left">
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
                onAction={(action) => onObserveAction(WIRE_SOURCE_KEY, action)}
              />
              <Tag color={wireRunning ? 'green' : undefined} style={{ margin: 0, flex: '0 0 auto' }}>
                {wireRunning && wirePort !== null
                  ? t('workbench.proxyCapture.running', { port: wirePort })
                  : t('workbench.proxyCapture.stopped')}
              </Tag>
            </SourceRow>
          </Tooltip>
        </div>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('workbench.trafficMonitor.sources')}</span>
      </div>
      <div className="rules-sidebar-content">
        {browsersSection}
        {wireSection}
        <TrafficMonitorSessionsSection
          sessions={sessions}
          pending={sessionPending}
          onStop={onSessionStop}
          onOpenArchive={onOpenSessions}
        />
      </div>
    </div>
  );
};
