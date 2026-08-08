/**
 * TrafficMonitorPanel — the unified Traffic Monitor tool window (Observability epic):
 * ONE observability surface with a source dimension, replacing the
 * former Proxy and Live Network windows.
 *
 * Layout: the {@link TrafficMonitorSourceRail} on the left, plane views on
 * the right, split by ONE full-height divider (the workbench's
 * inter-panel gutter) that runs from the card's top — through the
 * shared 32 px header row — to its bottom. The header row carries the
 * panel title left of the divider and the {@link TrafficMonitorTabStrip}
 * right of it: every open source is a tab (one per observed browser
 * tab, one for the wire partition), rail clicks open-or-activate, and
 * the active tab binds the plane views:
 *
 *   - a browser tab renders the shared {@link NetworkCaptureView} on
 *     that tab's QUALIFIED lifeline (`oh-lifecycle:<tabId>@<nodeId>`,
 *     relayed to the owning extension peer, subscription-gated end to
 *     end) — the storage (Phase 3) and console (Phase 4) planes stack
 *     below it (browser-truth only: the wire has neither domain);
 *   - the wire renders the same view bound to the reserved proxy
 *     partition — chrome-identical to a tab's column; the capture
 *     infrastructure (start/stop, port, decrypt scope, routing) lives
 *     on the rail row's {@link WireCaptureControl};
 *   - an archived session (opened from the rail's SESSIONS section)
 *     renders the same view bound to the archive's replay lifeline —
 *     network-only like the wire, durable, never inventory-retired.
 *
 * Row inspection routes outward to main editor tabs on both sources.
 * The window is gated on `liveNetwork`; the wire source additionally
 * requires `proxyCapture` — today every host that registers one
 * registers both (the desktop renderer, which runs the daemon spine
 * in-process), the rail just keeps the coupling honest.
 */

import { MinusOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { hostBridge } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import type { JsContext } from '@openheaders/core/js-contexts';
import {
  qualifiedConsolePortName,
  TELEMETRY_TABS_PORT_NAME,
  type TelemetryDebugCommand,
  type TelemetryDebugState,
  type TelemetryTabsWatchMessage,
} from '@openheaders/core/protocol';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import { qualifiedLifecyclePortName, replayLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type { TrafficArchivedSessionProjection } from '@openheaders/core/traffic';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, type DockSlot, LayoutMenuIcon, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { ConsoleView, type RemoteConsoleCapture } from '../../../panel/components/ConsoleView';
import { NetworkCaptureView, type WireJoinSeam } from '../../../panel/components/NetworkCaptureView';
import { useLifelineClient } from '../../../panel/data/use-lifeline-client';
import { getWireSeen } from '../../../panel/data/wire-seen-store';
import {
  StoragePanel,
  type OpenCacheEntryRequest,
  type OpenCookieRequest,
  type OpenDomStorageEntryRequest,
  type StorageRevealRequest,
} from '../../../panel/components/storage/StoragePanel';
import type { OpenIdbRecordRequest } from '../../../panel/components/storage/IndexedDbSection';
import { extractName } from '../../../panel/components/traffic/formatters';
import { cacheEntryLabel } from '../../../panel/data/inspector-tab';
import { jarCookieToKey } from '../../../panel/data/cookies/cookie-edit';
import { InspectedTabContext } from '../../../panel/data/inspected-tab-context';
import type { InspectorRowWithFires } from '../../../panel/data/inspector-row-projection';
import type { XhrLogConsoleEntry } from '../../../panel/data/console-xhr-log';
import { useConsoleClient } from '../../../panel/data/stores/use-console-client';
import { storageDocInnerId } from '../../data/storage-doc-ref';
import {
  installTrafficStorageHost,
  setTrafficStorageCookieTarget,
  trafficStorageHandle,
} from '../../data/traffic-storage-host';
import { subscribeTrafficStorageReveal, takeTrafficStorageReveal } from '../../data/traffic-storage-reveal';
import { useSetting } from '../../settings/hooks';
import { useIsDockFocused } from '../../stores/focus-region-store';
import type { LiveStorageDocRef, WorkbenchTab } from '../../types';
import { isSessionSourceKey, sessionSourceKey } from './TrafficMonitorSessionsSection';
import {
  type ObserveAction,
  RAIL_DEFAULT_WIDTH,
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  TrafficMonitorSourceRail,
  type RailPeer,
  type RailPeerTab,
  tabSourceKey,
  WIRE_SOURCE_KEY,
} from './TrafficMonitorSourceRail';
import { useProxyCaptureStatus, WireCaptureControl } from './WireCaptureControl';
import TrafficMonitorTabStrip, { type TrafficStripTab } from './TrafficMonitorTabStrip';

export interface TrafficMonitorPanelProps {
  info: InfoPopoverContent;
  /** Dock slot this panel rides — drives blue-vs-grey active-pill
   *  highlighting on the source tab strip (editor focus posture). */
  dockSlot: DockSlot;
  onHide: () => void;
  /** Open a wire-capture row's inspector as a main editor tab. */
  onOpenProxyRequest: (requestId: string, label: string) => void;
  /** Open a browser-tab row's inspector as a main editor tab. */
  onOpenLiveRequest: (nodeId: string, tabId: number, requestId: string, label: string) => void;
  /** Open a watched tab's storage document as a main editor tab. */
  onOpenStorageDoc: (nodeId: string, tabId: number, doc: LiveStorageDocRef, label: string) => void;
  /** Open Settings › Proxy (CA install + trust). */
  onOpenProxySettings: () => void;
  /** Open one recorded request from an archived-session tab as a main
   *  editor tab — the replay twin of `onOpenLiveRequest`, fed from the
   *  sealed log instead of a live wire. */
  onOpenSessionRequest: (sessionId: string, partitionTabId: number, requestId: string, label: string) => void;
  /** The focused editor tab — an inspect tab highlights its row in the
   *  list (association only, never navigation). */
  activeTab: WorkbenchTab | null;
}

interface TabSelection {
  nodeId: string;
  tabId: number;
}

/**
 * Panel UI state that survives dock-tab switches. The tool-window
 * dispatcher unmounts inactive bodies, so the last source selection and
 * rail width re-seed the next mount (the terminal panel's
 * survive-unmount posture, scoped to plain values — the peer inventory
 * and lifelines re-fetch on their own).
 */
/** Storage pane geometry — height of the stacked pane, clamped. */
const STORAGE_PANE_DEFAULT_HEIGHT = 260;
const STORAGE_PANE_MIN_HEIGHT = 120;
const STORAGE_PANE_MAX_HEIGHT = 560;

/** Console pane geometry — same clamps as the storage twin. Collapsed
 *  by default: three stacked planes contend for height, and the strip
 *  keeps the plane one click away. */
const CONSOLE_PANE_DEFAULT_HEIGHT = 220;
const CONSOLE_PANE_MIN_HEIGHT = 120;
const CONSOLE_PANE_MAX_HEIGHT = 560;

/** Dragging a pane's sash this far below its min height collapses the
 *  pane to its strip row instead of pinning it at the clamp. */
const SASH_COLLAPSE_SLACK = 48;

/** A pane that grows to fill the column keeps at least a few rows.
 *  A grower's flex basis must be 0, never auto: with basis auto its
 *  CONTENT sets the basis, so streaming rows overflow the column and
 *  flex-shrink eats the fixed panes below 1px at a time — and eats
 *  sash-drag deltas mid-drag. */
const GROW_PANE_MIN_HEIGHT = 88;

/** A fixed-height pane crushed by a short window degrades to its own
 *  toolbar row (clipped below) instead of painting over its siblings. */
const FIXED_PANE_MIN_HEIGHT = 28;

const lastPanelState: {
  selectedKey: string | null;
  tabSelection: TabSelection | null;
  openTabs: TrafficStripTab[];
  railWidth: number;
  networkCollapsed: boolean;
  storageHeight: number;
  storageCollapsed: boolean;
  consoleHeight: number;
  consoleCollapsed: boolean;
} = {
  selectedKey: null,
  tabSelection: null,
  openTabs: [],
  railWidth: RAIL_DEFAULT_WIDTH,
  networkCollapsed: false,
  storageHeight: STORAGE_PANE_DEFAULT_HEIGHT,
  storageCollapsed: false,
  consoleHeight: CONSOLE_PANE_DEFAULT_HEIGHT,
  consoleCollapsed: true,
};

/** The panel header's own paddings — the header's title cell is sized
 *  to `railWidth` minus the inset on the rail's side, so the divider
 *  segment on the header row lands exactly over the body divider. */
const PANEL_HEADER_LEFT_PAD = 12;
const PANEL_HEADER_RIGHT_PAD = 6;

/** Reported for a peer that vanished from the inventory mid-selection. */
const DEBUG_NONE: TelemetryDebugState = { available: false, enabled: false, attachedTabs: [], pinnedTabs: [] };

/** The inventory watch has no tab partition — a fixed synthetic id
 *  binds the shared lifeline hook (the proxy-source posture). */
const TABS_WATCH_TAB_ID = 0;

/** How long a `peer-gone` removal lingers before applying, so an
 *  SW-eviction flap's reconnect push cancels it instead of the rail
 *  flashing empty. */
const PEER_GONE_LINGER_MS = 1500;

/**
 * Debug-mode state a start-observing gesture changed, per source key —
 * the stop gesture restores exactly what the bundle touched (a pin or
 * master switch the user set beforehand survives untouched). Module
 * scope like {@link lastPanelState}: the bookkeeping outlives
 * dock-tab switches; an app restart forgets it, and the debug state
 * then simply stays where the browser left it.
 */
const observeDebugPrior = new Map<string, { enabled: boolean; pinned: boolean }>();

// Identity-stable statics for the console pane's unwired seams: the
// workbench streams no JS-contexts plane (selector hides on empty), has
// no network-plane join source for derived XHR rows, and row→request
// cross-navigation stays panel-only for now.
const NO_CONSOLE_CONTEXTS: readonly JsContext[] = [];
const NO_XHR_LOG: readonly XhrLogConsoleEntry[] = [];
const resolveNoRequest = (): null => null;
const noopRequestClick = (): void => {};
const noopRevealConsumed = (): void => {};

interface TrafficConsolePaneProps {
  nodeId: string;
  tabId: number;
  debug: TelemetryDebugState;
  onHide: () => void;
  /** The plane toolbar's leading caret — collapses to the strip row. */
  collapseToggle: () => void;
}

/**
 * The console plane of one watched browser tab — the shared ConsoleView
 * over the qualified `oh-console:<tabId>@<nodeId>` lifeline, view-only
 * (OBSERVABILITY_PLAN.md Phase 4): capture is the peer's CDP console
 * stream, arming belongs to the source rail's Debug affordance, and the
 * REPL prompt never mounts (remoteCapture suppresses it).
 */
function TrafficConsolePane({ nodeId, tabId, debug, onHide, collapseToggle }: TrafficConsolePaneProps) {
  const portName = useCallback((tid: number) => qualifiedConsolePortName(tid, nodeId), [nodeId]);
  const { snapshot, store } = useConsoleClient({ tabId, portName });
  const remoteCapture = useMemo<RemoteConsoleCapture>(
    () => ({
      available: debug.available,
      enabled: debug.enabled,
      capturing: debug.attachedTabs.includes(tabId),
    }),
    [debug, tabId],
  );
  const onClear = useCallback(() => store.clear(), [store]);
  return (
    <ConsoleView
      entries={snapshot.entries}
      xhrLogEntries={NO_XHR_LOG}
      contexts={NO_CONSOLE_CONTEXTS}
      resolveRequest={resolveNoRequest}
      onRequestClick={noopRequestClick}
      onClear={onClear}
      onHide={onHide}
      collapseToggle={collapseToggle}
      reveal={null}
      onRevealConsumed={noopRevealConsumed}
      remoteCapture={remoteCapture}
    />
  );
}

// The relay-backed storage + cookie seams are process-wide; install
// them when the Traffic Monitor's module loads (idempotent — the
// storage-document editor tab does the same).
installTrafficStorageHost();

// The Wire source view's join seam — annotation from the historical
// seen record only, no extra lifeline. Static on purpose.
const WIRE_VIEW_JOIN: WireJoinSeam = { mode: 'wire' };

const TrafficMonitorPanel: React.FC<TrafficMonitorPanelProps> = ({
  info,
  dockSlot,
  onHide,
  onOpenProxyRequest,
  onOpenLiveRequest,
  onOpenStorageDoc,
  onOpenProxySettings,
  onOpenSessionRequest,
  activeTab,
}) => {
  const t = useT();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const dockFocused = useIsDockFocused(dockSlot);
  // One blue INSIDE the panel too: the strip pill and the rail's
  // selected row mark the same source, so the row is a permanent grey
  // echo (traffic-monitor.less) and the pill yields its vivid tint
  // while the rail owns DOM focus — the rail's keyboard cursor is the
  // one blue then, exactly like a sidebar tree greying the editor tab.
  const [railFocused, setRailFocused] = useState(false);
  const showWire = hasCapability('proxyCapture');
  const proxy = useProxyCaptureStatus();
  // Which side the sources rail sits on — a persisted preference the
  // header's layout button flips (its icon shows the TARGET layout).
  const [railSide, setRailSide] = useSetting('trafficMonitor.railSide');

  const [peers, setPeers] = useState<RailPeer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(() => lastPanelState.selectedKey);
  const [tabSelection, setTabSelection] = useState<TabSelection | null>(() => lastPanelState.tabSelection);
  const [openTabs, setOpenTabs] = useState<TrafficStripTab[]>(() => lastPanelState.openTabs);
  // Vanished-source retirement waits for the first definitive inventory
  // answer — without the gate, a remount's empty pre-fetch `peers`
  // would wipe the persisted tab list before the baseline pull lands.
  const inventoryReady = useRef(false);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const resp = await hostBridge.call('oh.daemon.telemetry.tabs.list');
      setPeers(
        resp.peers.map((peer) => ({
          nodeId: peer.nodeId,
          agent: peer.agent,
          browser: peer.browser,
          debug: peer.debug,
          tabs: [...peer.tabs],
          watchConsent: peer.watchConsent !== false,
        })),
      );
      inventoryReady.current = true;
    } catch {
      setPeers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live inventory watch: while the panel is mounted the daemon relay
  // holds a tabs subscription on every extension peer, and each tab /
  // Debug-posture / consent change lands here as a pushed per-peer
  // snapshot — the rail updates the instant a tab opens or closes. The
  // mount-time pull above stays the baseline (it answers definitively,
  // zero-peer case included); pushes are idempotent upserts on top.
  //
  // `peer-gone` removals linger briefly: a service-worker eviction
  // drops the wire and reconnects within a breath, and the reconnect's
  // snapshot push cancels the pending removal instead of the rail
  // flashing empty.
  const peerGoneTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = peerGoneTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);
  const onTabsWatchMessage = useCallback((message: TelemetryTabsWatchMessage) => {
    if (message.kind === 'peer-tabs') {
      const pendingGone = peerGoneTimers.current.get(message.peer.nodeId);
      if (pendingGone !== undefined) {
        clearTimeout(pendingGone);
        peerGoneTimers.current.delete(message.peer.nodeId);
      }
      const next: RailPeer = {
        nodeId: message.peer.nodeId,
        agent: message.peer.agent,
        browser: message.peer.browser,
        debug: message.peer.debug,
        tabs: [...message.peer.tabs],
        watchConsent: message.peer.watchConsent,
      };
      setPeers((prev) => {
        const index = prev.findIndex((peer) => peer.nodeId === next.nodeId);
        if (index < 0) return [...prev, next];
        const updated = [...prev];
        updated[index] = next;
        return updated;
      });
      return;
    }
    const existing = peerGoneTimers.current.get(message.nodeId);
    if (existing !== undefined) clearTimeout(existing);
    peerGoneTimers.current.set(
      message.nodeId,
      setTimeout(() => {
        peerGoneTimers.current.delete(message.nodeId);
        setPeers((prev) => prev.filter((peer) => peer.nodeId !== message.nodeId));
      }, PEER_GONE_LINGER_MS),
    );
  }, []);
  useLifelineClient<TelemetryTabsWatchMessage>({
    portName: () => TELEMETRY_TABS_PORT_NAME,
    tabId: TABS_WATCH_TAB_ID,
    handler: onTabsWatchMessage,
  });

  // Debug-mode control (per-tab pin / master switch) relayed to the
  // owning extension peer. The reply's snapshot patches the rail
  // immediately; the attach a pin just triggered commits only after the
  // browser's banner handshake, so a delayed inventory read converges
  // the indicator. Sources whose attach/detach that leaves in flight are
  // held in a pending set — the rail shows a spinner instead of the
  // misleading intermediate snapshot (pin-then-bug flash, dead unpin).
  const [debugPending, setDebugPending] = useState<ReadonlySet<string>>(() => new Set());
  const [debugEnablePending, setDebugEnablePending] = useState<ReadonlySet<string>>(() => new Set());
  const debugConvergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debugConvergeTimer.current !== null) clearTimeout(debugConvergeTimer.current);
    },
    [],
  );
  const debugControl = useCallback(
    async (nodeId: string, command: TelemetryDebugCommand): Promise<void> => {
      try {
        const resp = await hostBridge.call('oh.daemon.telemetry.debug.control', { nodeId, command });
        const debug = resp.debug;
        if (resp.ok && debug !== null) {
          setPeers((prev) => prev.map((peer) => (peer.nodeId === nodeId ? { ...peer, debug } : peer)));
        }
      } catch {
        // Peer gone mid-command — the delayed reload drops it from the rail.
      }
      if (debugConvergeTimer.current !== null) clearTimeout(debugConvergeTimer.current);
      debugConvergeTimer.current = setTimeout(() => {
        debugConvergeTimer.current = null;
        void reload().finally(() => {
          setDebugPending(new Set());
          setDebugEnablePending(new Set());
        });
      }, 800);
    },
    [reload],
  );

  const onDebugPin = useCallback(
    (nodeId: string, tabId: number, pinned: boolean) => {
      // With the master switch off the pin is terminal in the reply
      // snapshot — only an enabled peer has an attach/detach in flight.
      const peer = peers.find((p) => p.nodeId === nodeId);
      if (peer?.debug.enabled === true) {
        setDebugPending((prev) => new Set(prev).add(tabSourceKey(nodeId, tabId)));
      }
      void debugControl(nodeId, { kind: 'pin', tabId, pinned });
    },
    [peers, debugControl],
  );

  const onDebugEnable = useCallback(
    (nodeId: string, enabled: boolean) => {
      // The switch flip re-reconciles every pinned/attached tab.
      const peer = peers.find((p) => p.nodeId === nodeId);
      setDebugEnablePending((prev) => new Set(prev).add(nodeId));
      if (peer) {
        const affected = new Set([...peer.debug.pinnedTabs, ...peer.debug.attachedTabs]);
        if (affected.size > 0) {
          setDebugPending((prev) => {
            const next = new Set(prev);
            for (const tabId of affected) next.add(tabSourceKey(nodeId, tabId));
            return next;
          });
        }
      }
      void debugControl(nodeId, { kind: 'enable', enabled });
    },
    [peers, debugControl],
  );

  // Agent-observation arming (AGENT_TRAFFIC_PLAN.md §4 S2): the rail's
  // per-source affordance drives the daemon tap's operator plane. The
  // armed set re-reads on the tap's `trafficStatusChanged` nudges —
  // idle arms expire host-side (`expiresAtMs`), the sweep's disarm
  // nudges too, and reading status deliberately does NOT extend an arm,
  // so the eye icon converges after a lapse instead of keeping the
  // source warm.
  const [observeArmed, setObserveArmed] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [observePending, setObservePending] = useState<ReadonlySet<string>>(() => new Set());
  // Sources an ACTIVE disk capture session is recording (S7) — the
  // retention indicator must stay visible the whole time one runs.
  const [captureActive, setCaptureActive] = useState<ReadonlySet<string>>(() => new Set());
  const reloadArmed = useCallback(async (): Promise<void> => {
    try {
      const { sources } = await hostBridge.call('oh.daemon.traffic.status');
      const next = new Map<string, string>();
      const capturing = new Set<string>();
      for (const source of sources) {
        let key: string | null = null;
        if (source.kind === 'browser-tab' && source.nodeId !== undefined && source.tabId !== undefined) {
          key = tabSourceKey(source.nodeId, source.tabId);
        } else if (source.kind === 'proxy') {
          key = WIRE_SOURCE_KEY;
        }
        if (key === null) continue;
        next.set(key, source.uid);
        if (source.capture !== undefined) capturing.add(key);
      }
      setObserveArmed(next);
      setCaptureActive(capturing);
    } catch {
      setObserveArmed(new Map());
      setCaptureActive(new Set());
    }
  }, []);
  // Armed/capture state is event-driven: the tap's invalidation feed
  // (`trafficStatusChanged` — arm, disarm, idle expiry, capture
  // start/stop/seal) nudges a re-read of the same status RPCs the
  // mount reads, debounced because one observe gesture commits several
  // transitions back-to-back. No poll: every transition the tap can
  // undergo emits a nudge, expiry via its sweep included.
  useEffect(() => {
    void reloadArmed();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = hostBridge.subscribe('trafficStatusChanged', () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void reloadArmed();
      }, 150);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [reloadArmed]);

  // One handler for the observe popover's two verbs (PLAN §11.1 — one
  // gesture, one bundle). Start arms, then applies the gesture's
  // bundled toggles: debug fidelity through the peer's Debug control
  // plane (remembering exactly what it changed) and the recording
  // session named after the source (bounds stay host defaults). The
  // gesture itself is the durable-capture consent — redaction is
  // applied at read time by every consumer-facing projection, never at
  // write. Stop unwinds the bundle: session BEFORE disarm so the end
  // reason stays the honest 'stopped' (never 'source-disarmed'), then
  // the debug state restores to what the start gesture found. Failures
  // converge silently — the reload leaves the icon in its true state.
  const findTab = useCallback(
    (key: string): { peer: RailPeer; tab: RailPeerTab } | null => {
      for (const peer of peers) {
        for (const tab of peer.tabs) {
          if (tabSourceKey(peer.nodeId, tab.tabId) === key) return { peer, tab };
        }
      }
      return null;
    },
    [peers],
  );
  // The session's start name: a browser tab's title (its URL when the
  // title is blank). The wire passes NO name — a proxy capture spans
  // many sites, and the seal stamps its dominant site honestly.
  const sourceName = useCallback(
    (key: string): string => {
      if (key === WIRE_SOURCE_KEY) return '';
      const found = findTab(key);
      return found ? found.tab.title || found.tab.url : '';
    },
    [findTab],
  );
  const onObserveAction = useCallback(
    (key: string, action: ObserveAction) => {
      setObservePending((prev) => new Set(prev).add(key));
      void (async () => {
        try {
          if (action.kind === 'start') {
            let uid: string | null = null;
            const found = key === WIRE_SOURCE_KEY ? null : findTab(key);
            if (key === WIRE_SOURCE_KEY) {
              const armed = await hostBridge.call('oh.daemon.traffic.arm', { kind: 'proxy' });
              uid = armed.ok ? armed.uid : null;
            } else if (found !== null) {
              const armed = await hostBridge.call('oh.daemon.traffic.arm', {
                kind: 'browser-tab',
                nodeId: found.peer.nodeId,
                tabId: found.tab.tabId,
              });
              uid = armed.ok ? armed.uid : null;
            }
            if (uid !== null && action.debug && found !== null && found.peer.debug.available) {
              const prior = {
                enabled: found.peer.debug.enabled,
                pinned: found.peer.debug.pinnedTabs.includes(found.tab.tabId),
              };
              if (!prior.enabled || !prior.pinned) observeDebugPrior.set(key, prior);
              if (!prior.enabled) await debugControl(found.peer.nodeId, { kind: 'enable', enabled: true });
              if (!prior.pinned) {
                await debugControl(found.peer.nodeId, { kind: 'pin', tabId: found.tab.tabId, pinned: true });
              }
            }
            if (uid !== null && action.save) {
              await hostBridge.call('oh.daemon.traffic.capture.start', { uid, name: sourceName(key) });
            }
          } else {
            const uid = observeArmed.get(key);
            if (uid !== undefined) {
              if (captureActive.has(key)) {
                await hostBridge.call('oh.daemon.traffic.capture.stop', { uid });
              }
              await hostBridge.call('oh.daemon.traffic.disarm', { uid });
            }
            const prior = observeDebugPrior.get(key);
            if (prior !== undefined) {
              observeDebugPrior.delete(key);
              const found = findTab(key);
              if (found !== null && found.peer.debug.available) {
                if (!prior.pinned) {
                  await debugControl(found.peer.nodeId, { kind: 'pin', tabId: found.tab.tabId, pinned: false });
                }
                if (!prior.enabled) await debugControl(found.peer.nodeId, { kind: 'enable', enabled: false });
              }
            }
          }
        } catch {
          // Tap unavailable — the reload below converges the icon.
        }
        await reloadArmed();
        setObservePending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })();
    },
    [observeArmed, captureActive, findTab, sourceName, debugControl, reloadArmed],
  );

  const observeArmedKeys = useMemo(() => new Set(observeArmed.keys()), [observeArmed]);

  // Wire-join (Phase 6): a wire row's "seen on tab" annotation jumps to
  // the browser-tab source that also witnessed it — switch the source
  // and highlight the twin row once the tab view mounts.
  const [pendingTabHighlight, setPendingTabHighlight] = useState<string | null>(null);

  // ── The source tab row (S25): every open source is a tab on the
  // header line. Rail clicks (and jump/reveal intents) open-or-activate
  // — editor sidebar semantics; the active tab drives the plane views.
  const openSource = useCallback(
    (key: string, selection: TabSelection | null) => {
      setOpenTabs((prev) => {
        if (prev.some((entry) => entry.key === key)) return prev;
        const found = key === WIRE_SOURCE_KEY ? null : findTab(key);
        const entry: TrafficStripTab = {
          key,
          label: found ? found.tab.title || found.tab.url : '',
          ...(found?.tab.favIconUrl !== undefined ? { favIconUrl: found.tab.favIconUrl } : {}),
          ...(selection !== null ? { nodeId: selection.nodeId, tabId: selection.tabId } : {}),
        };
        return [...prev, entry];
      });
      setSelectedKey(key);
      setTabSelection(selection);
    },
    [findTab],
  );

  /** Activate one open tab (null = none left → the no-source hero). */
  const activateEntry = useCallback((entry: TrafficStripTab | null) => {
    setPendingTabHighlight(null);
    if (entry === null) {
      setSelectedKey(null);
      setTabSelection(null);
      return;
    }
    setSelectedKey(entry.key);
    setTabSelection(
      entry.key !== WIRE_SOURCE_KEY && entry.nodeId !== undefined && entry.tabId !== undefined
        ? { nodeId: entry.nodeId, tabId: entry.tabId }
        : null,
    );
  }, []);

  const onSelect = useCallback(
    (key: string) => {
      setPendingTabHighlight(null);
      const found = key === WIRE_SOURCE_KEY ? null : findTab(key);
      openSource(key, found !== null ? { nodeId: found.peer.nodeId, tabId: found.tab.tabId } : null);
    },
    [findTab, openSource],
  );

  const onActivateStripTab = useCallback(
    (key: string) => {
      const entry = openTabs.find((candidate) => candidate.key === key);
      if (entry !== undefined) activateEntry(entry);
    },
    [openTabs, activateEntry],
  );

  // Close retires the tab; closing the active one activates the
  // neighbor that slid into its slot (previous when it was last).
  const onCloseStripTab = useCallback(
    (key: string) => {
      const index = openTabs.findIndex((entry) => entry.key === key);
      if (index < 0) return;
      const next = openTabs.filter((entry) => entry.key !== key);
      setOpenTabs(next);
      if (selectedKey === key) activateEntry(next[Math.min(index, next.length - 1)] ?? null);
    },
    [openTabs, selectedKey, activateEntry],
  );

  // ── Archived sessions as source tabs (S26): a sealed session opens
  // through the same open-or-activate grammar, keyed `session:<id>`
  // and bound to the archive's replay lifeline instead of a live wire.
  const openArchivedSession = useCallback((session: TrafficArchivedSessionProjection) => {
    const key = sessionSourceKey(session.id);
    setPendingTabHighlight(null);
    setOpenTabs((prev) => {
      const existing = prev.find((entry) => entry.key === key);
      if (existing !== undefined) {
        // Re-open refreshes the pill label after a rename.
        return existing.label === session.name
          ? prev
          : prev.map((entry) => (entry.key === key ? { ...entry, label: session.name } : entry));
      }
      return [...prev, { key, label: session.name, sessionId: session.id, partitionTabId: session.partitionTabId }];
    });
    setSelectedKey(key);
    setTabSelection(null);
  }, []);

  // Deleting a session from the rail retires its open tab — the only
  // retirement path a durable archive source has.
  const onSessionDeleted = useCallback(
    (id: string) => onCloseStripTab(sessionSourceKey(id)),
    [onCloseStripTab],
  );

  // A source vanishing from the inventory (browser tab closed, peer
  // gone — after the peer-gone linger) retires its tab honestly; the
  // wire tab exists only while the host runs the capability; session
  // tabs are archive-backed and never retire on peer churn (deletion
  // retires them via `onSessionDeleted`). The same pass refreshes
  // labels/favicons so pills track live tab titles.
  useEffect(() => {
    if (!inventoryReady.current) return;
    const live = new Map<string, RailPeerTab>();
    for (const peer of peers) {
      for (const tab of peer.tabs) live.set(tabSourceKey(peer.nodeId, tab.tabId), tab);
    }
    const next: TrafficStripTab[] = [];
    let changed = false;
    for (const entry of openTabs) {
      if (entry.key === WIRE_SOURCE_KEY) {
        if (!showWire) {
          changed = true;
          continue;
        }
        next.push(entry);
        continue;
      }
      if (isSessionSourceKey(entry.key)) {
        next.push(entry);
        continue;
      }
      const tab = live.get(entry.key);
      if (tab === undefined) {
        changed = true;
        continue;
      }
      const label = tab.title || tab.url;
      if (label !== entry.label || tab.favIconUrl !== entry.favIconUrl) {
        changed = true;
        next.push({
          key: entry.key,
          label,
          ...(tab.favIconUrl !== undefined ? { favIconUrl: tab.favIconUrl } : {}),
          ...(entry.nodeId !== undefined && entry.tabId !== undefined
            ? { nodeId: entry.nodeId, tabId: entry.tabId }
            : {}),
        });
      } else {
        next.push(entry);
      }
    }
    if (!changed) return;
    setOpenTabs(next);
    if (selectedKey !== null && !next.some((entry) => entry.key === selectedKey)) {
      const index = openTabs.findIndex((entry) => entry.key === selectedKey);
      activateEntry(next[Math.min(Math.max(index, 0), next.length - 1)] ?? null);
    }
  }, [peers, showWire, openTabs, selectedKey, activateEntry]);

  const onWireSeenJump = useCallback(
    (wireRequestId: string) => {
      const record = getWireSeen(wireRequestId);
      if (!record) return;
      openSource(tabSourceKey(record.nodeId, record.tabId), { nodeId: record.nodeId, tabId: record.tabId });
      setPendingTabHighlight(record.browserRequestId);
      setNetworkCollapsed(false);
    },
    [openSource],
  );

  const inspectWireRequest = useCallback(
    (row: InspectorRowWithFires) => {
      const { name } = extractName(row.lifecycle.url);
      onOpenProxyRequest(row.lifecycle.requestId, `${row.lifecycle.method} ${name}`);
    },
    [onOpenProxyRequest],
  );

  const inspectTabRequest = useCallback(
    (row: InspectorRowWithFires) => {
      if (!tabSelection) return;
      const { name } = extractName(row.lifecycle.url);
      onOpenLiveRequest(
        tabSelection.nodeId,
        tabSelection.tabId,
        row.lifecycle.requestId,
        `${row.lifecycle.method} ${name}`,
      );
    },
    [tabSelection, onOpenLiveRequest],
  );

  const tabPortName = useMemo(
    () => (tabSelection ? (tabId: number) => qualifiedLifecyclePortName(tabId, tabSelection.nodeId) : undefined),
    [tabSelection],
  );

  // Wire-join seam for the selected browser tab — join with the local
  // wire partition when this host runs one; the tab's title labels the
  // historical seen record the Wire view annotates from.
  const tabWireJoin = useMemo<WireJoinSeam | undefined>(() => {
    if (!showWire || tabSelection === null) return undefined;
    const peer = peers.find((p) => p.nodeId === tabSelection.nodeId);
    const title = peer?.tabs.find((tab) => tab.tabId === tabSelection.tabId)?.title ?? null;
    return { mode: 'browser', nodeId: tabSelection.nodeId, sourceLabel: title };
  }, [showWire, tabSelection, peers]);

  const wireSelected = selectedKey === WIRE_SOURCE_KEY;

  // The active archived-session tab (if any) — its plane column is the
  // same network view bound to the archive's replay lifeline
  // (`oh-replay:<archiveId>`): parity by construction, the sealed
  // event log IS the reducer input the live pass folded. Network-only,
  // like the wire — sessions record no storage/console planes.
  const activeSession =
    selectedKey !== null && isSessionSourceKey(selectedKey)
      ? (openTabs.find((entry) => entry.key === selectedKey) ?? null)
      : null;
  const activeSessionId = activeSession?.sessionId;
  const sessionPortName = useMemo(
    () => (activeSessionId !== undefined ? () => replayLifecyclePortName(activeSessionId) : undefined),
    [activeSessionId],
  );
  const activeSessionPartition = activeSession?.partitionTabId;
  const inspectSessionRequest = useCallback(
    (row: InspectorRowWithFires) => {
      if (activeSessionId === undefined || activeSessionPartition === undefined) return;
      const { name } = extractName(row.lifecycle.url);
      onOpenSessionRequest(
        activeSessionId,
        activeSessionPartition,
        row.lifecycle.requestId,
        `${row.lifecycle.method} ${name}`,
      );
    },
    [activeSessionId, activeSessionPartition, onOpenSessionRequest],
  );
  const sessionUnavailableCopy = useMemo(
    () => ({ title: t('workbench.sessionReplay.unavailableTitle'), body: t('workbench.sessionReplay.unavailableBody') }),
    [t],
  );

  // Focused inspect tab → its row highlighted in the matching view
  // (association only — the source binding never changes on tab focus,
  // the DevTools posture).
  const wireHighlight =
    activeTab?.mode === 'proxy-request-inspect' ? (activeTab.proxyRequestId ?? null) : null;
  const tabHighlight =
    activeTab?.mode === 'live-network-request-inspect' &&
    tabSelection !== null &&
    activeTab.liveNetworkNodeId === tabSelection.nodeId &&
    activeTab.liveNetworkTabId === tabSelection.tabId
      ? (activeTab.liveNetworkRequestId ?? null)
      : (pendingTabHighlight ?? null);
  const sessionHighlight =
    activeTab?.mode === 'session-replay-request-inspect' &&
    activeSessionId !== undefined &&
    activeTab.sessionReplayId === activeSessionId
      ? (activeTab.sessionReplayRequestId ?? null)
      : null;

  // ── Storage pane (Phase 3) — stacked below the network view for
  // browser-tab sources only (the wire has no storage domain). ────────
  const storageHandle = tabSelection !== null ? trafficStorageHandle(tabSelection.nodeId, tabSelection.tabId) : null;
  const cookieNodeId = tabSelection?.nodeId ?? null;
  // Cookie-jar seams are URL-keyed (no tab identity) — bind them to the
  // selected peer; the setter drops the jar cache on a change.
  useEffect(() => {
    setTrafficStorageCookieTarget(cookieNodeId);
  }, [cookieNodeId]);
  const [networkCollapsed, setNetworkCollapsed] = useState(() => lastPanelState.networkCollapsed);
  const [storageHeight, setStorageHeight] = useState(() => lastPanelState.storageHeight);
  const [storageCollapsed, setStorageCollapsed] = useState(() => lastPanelState.storageCollapsed);
  const [storageReveal, setStorageReveal] = useState<StorageRevealRequest | null>(null);

  // ── Console pane (Phase 4) — third stacked pane, browser-tab sources
  // only (the wire has no console domain). View-only; capture posture
  // comes from the selected peer's Debug state in the rail inventory.
  const [consoleHeight, setConsoleHeight] = useState(() => lastPanelState.consoleHeight);
  const [consoleCollapsed, setConsoleCollapsed] = useState(() => lastPanelState.consoleCollapsed);
  const selectedPeerDebug = useMemo(
    () => (tabSelection !== null ? (peers.find((p) => p.nodeId === tabSelection.nodeId)?.debug ?? DEBUG_NONE) : DEBUG_NONE),
    [peers, tabSelection],
  );
  // The selected peer's telemetry consent gate — `false` renders the
  // honest refusal hero instead of three planes the peer will refuse. A
  // peer missing from the inventory keeps its planes (the lifeline
  // still replays; the live stream's own refusal envelope covers a
  // consent flip the inventory hasn't observed yet).
  const selectedPeerConsent = useMemo(
    () => (tabSelection !== null ? (peers.find((p) => p.nodeId === tabSelection.nodeId)?.watchConsent ?? true) : true),
    [peers, tabSelection],
  );

  // Reveal intents posted by storage-document editor tabs: adopt the
  // intent's source, expand the pane, hand the reveal down (the pane
  // consumes it exactly once).
  const consumeRevealIntent = useCallback(() => {
    const intent = takeTrafficStorageReveal();
    if (!intent) return;
    openSource(tabSourceKey(intent.nodeId, intent.tabId), { nodeId: intent.nodeId, tabId: intent.tabId });
    setStorageCollapsed(false);
    setStorageReveal(intent.reveal);
  }, [openSource]);
  useEffect(() => {
    consumeRevealIntent();
    return subscribeTrafficStorageReveal(consumeRevealIntent);
  }, [consumeRevealIntent]);

  const openStorageDoc = useCallback(
    (doc: LiveStorageDocRef, label: string) => {
      if (!tabSelection) return;
      onOpenStorageDoc(tabSelection.nodeId, tabSelection.tabId, doc, label);
    },
    [tabSelection, onOpenStorageDoc],
  );
  const openIdbRecord = useCallback(
    (r: OpenIdbRecordRequest & { frameId: number }) =>
      openStorageDoc(
        {
          kind: 'idb',
          frameId: r.frameId,
          database: r.database,
          store: r.store,
          primaryKeyWire: r.primaryKeyWire,
          keyPreview: r.keyPreview,
        },
        r.keyPreview,
      ),
    [openStorageDoc],
  );
  const openDomEntry = useCallback(
    (r: OpenDomStorageEntryRequest & { frameId: number }) =>
      openStorageDoc({ kind: 'dom', frameId: r.frameId, area: r.area, entryKey: r.entryKey }, r.entryKey),
    [openStorageDoc],
  );
  const openCookie = useCallback(
    (r: OpenCookieRequest) =>
      openStorageDoc({ kind: 'cookie', cookieKey: jarCookieToKey(r.cookie), scopeUrl: r.scopeUrl }, r.cookie.name),
    [openStorageDoc],
  );
  const openCacheEntry = useCallback(
    (r: OpenCacheEntryRequest & { frameId: number }) =>
      openStorageDoc(
        { kind: 'cache', frameId: r.frameId, cache: r.cache, url: r.url, method: r.method },
        cacheEntryLabel(r.url),
      ),
    [openStorageDoc],
  );

  // The focused storage-document editor tab → its grid row highlighted
  // in the MATCHING pane (association only, like the network view).
  const activeStorageTabId =
    activeTab?.mode === 'live-storage-doc-inspect' &&
    tabSelection !== null &&
    activeTab.liveStorageNodeId === tabSelection.nodeId &&
    activeTab.liveStorageTabId === tabSelection.tabId &&
    activeTab.liveStorageDoc
      ? storageDocInnerId(activeTab.liveStorageDoc)
      : null;

  // Sash drags — shared mechanics for the storage/console twins. The
  // sash resizes the pane BELOW it; the growing pane above absorbs the
  // difference. Both edges auto-collapse live, DevTools-style: dragging
  // down past the pane's floor collapses the dragged pane to its strip;
  // dragging up past the point that crushes the grower collapses the
  // grower instead (its space hands to the pane below). The grower's
  // rendered height is measured at drag start — every other pane is
  // fixed during the drag, so the implied grower height is exact.
  const growerPaneRef = useRef<HTMLDivElement | null>(null);
  const beginSashDrag = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      spec: {
        start: number;
        min: number;
        max: number;
        setHeight: (h: number) => void;
        collapseSelf: () => void;
        collapseGrower: () => void;
      },
    ) => {
      e.preventDefault();
      const startY = e.clientY;
      const { start, min, max } = spec;
      const growerHeight = growerPaneRef.current?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY;
      // Largest height the dragged pane can reach before the grower
      // above hits its own floor.
      const maxRaw = start + Math.max(0, growerHeight - GROW_PANE_MIN_HEIGHT);
      const cap = Math.max(min, Math.min(max, maxRaw));
      let done = false;
      const finish = (): void => {
        done = true;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      const move = (ev: PointerEvent): void => {
        if (done) return;
        // Pane is at the bottom, so dragging up (smaller clientY) grows it.
        const raw = start + (startY - ev.clientY);
        if (raw < min - SASH_COLLAPSE_SLACK) {
          spec.setHeight(start);
          spec.collapseSelf();
          finish();
          return;
        }
        if (raw > maxRaw + SASH_COLLAPSE_SLACK) {
          spec.setHeight(cap);
          spec.collapseGrower();
          finish();
          return;
        }
        spec.setHeight(Math.min(Math.max(raw, min), cap));
      };
      const up = (): void => finish();
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  // Storage sash — rendered only while the network plane above is
  // expanded, so the grower it can collapse is always the network pane.
  const storageHeightRef = useRef(storageHeight);
  storageHeightRef.current = storageHeight;
  const onStorageSashDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) =>
      beginSashDrag(e, {
        start: storageHeightRef.current,
        min: STORAGE_PANE_MIN_HEIGHT,
        max: STORAGE_PANE_MAX_HEIGHT,
        setHeight: setStorageHeight,
        collapseSelf: () => setStorageCollapsed(true),
        collapseGrower: () => setNetworkCollapsed(true),
      }),
    [beginSashDrag],
  );

  // Console sash — the grower above is the network pane, or the storage
  // pane once the network plane is collapsed.
  const consoleHeightRef = useRef(consoleHeight);
  consoleHeightRef.current = consoleHeight;
  const onConsoleSashDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) =>
      beginSashDrag(e, {
        start: consoleHeightRef.current,
        min: CONSOLE_PANE_MIN_HEIGHT,
        max: CONSOLE_PANE_MAX_HEIGHT,
        setHeight: setConsoleHeight,
        collapseSelf: () => setConsoleCollapsed(true),
        collapseGrower: () => (networkCollapsed ? setStorageCollapsed(true) : setNetworkCollapsed(true)),
      }),
    [beginSashDrag, networkCollapsed],
  );

  // Draggable rail width — the vertical sash resizes it, clamped.
  const [railWidth, setRailWidth] = useState(() => lastPanelState.railWidth);

  useEffect(() => {
    lastPanelState.selectedKey = selectedKey;
    lastPanelState.tabSelection = tabSelection;
    lastPanelState.openTabs = openTabs;
    lastPanelState.railWidth = railWidth;
    lastPanelState.networkCollapsed = networkCollapsed;
    lastPanelState.storageHeight = storageHeight;
    lastPanelState.storageCollapsed = storageCollapsed;
    lastPanelState.consoleHeight = consoleHeight;
    lastPanelState.consoleCollapsed = consoleCollapsed;
  }, [
    selectedKey,
    tabSelection,
    openTabs,
    railWidth,
    networkCollapsed,
    storageHeight,
    storageCollapsed,
    consoleHeight,
    consoleCollapsed,
  ]);
  const onRailSashDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = railWidthRef.current;
    const move = (ev: PointerEvent): void => {
      // Dragging AWAY from the rail's side widens it — the factor
      // mirrors with the rail side.
      const delta = ev.clientX - startX;
      const next = Math.min(
        Math.max(startWidth + (railSideRef.current === 'left' ? delta : -delta), RAIL_MIN_WIDTH),
        RAIL_MAX_WIDTH,
      );
      setRailWidth(next);
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);
  // Live width/side for the drag closure without re-binding the handler.
  const railWidthRef = useRef(railWidth);
  railWidthRef.current = railWidth;
  const railSideRef = useRef(railSide);
  railSideRef.current = railSide;

  // Exactly one expanded pane fills the column: the first in stack
  // order grows, later expanded panes keep their drag-set heights. A
  // grower needs no sash — there is nothing above it to trade with.
  const storageGrows = networkCollapsed && !storageCollapsed;
  const consoleGrows = networkCollapsed && storageCollapsed && !consoleCollapsed;

  // Title cell — title + (i) at its left, the panel's action cluster
  // (the rail-side layout toggle and the hide −) right-aligned at the
  // rail column's edge: the HTTP Rules posture, actions belong to the
  // card the title names. PanelHeader's own far-right cluster is
  // hidden for this panel (scoped CSS) and the cell renders its own
  // with the header action classes, so the dock-hover reveal law
  // still applies — the terminal panel's split-mode precedent.
  const railSideOther = railSide === 'left' ? 'right' : 'left';
  const railSideToggleLabel = t(
    railSide === 'left' ? 'workbench.trafficMonitor.railSideToRight' : 'workbench.trafficMonitor.railSideToLeft',
  );
  const headerTitleCell = (
    <div
      style={{
        flex: `0 0 ${railWidth - (railSide === 'left' ? PANEL_HEADER_LEFT_PAD : PANEL_HEADER_RIGHT_PAD)}px`,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflow: 'hidden',
        boxSizing: 'border-box',
        // Divider-facing inner padding, mirroring the card-edge insets:
        // rail LEFT — the action cluster stops short of the bar the way
        // it stops short of a card's right edge; rail RIGHT — the title
        // gets the same leading room it has at a card's left edge.
        ...(railSide === 'left'
          ? { paddingRight: PANEL_HEADER_RIGHT_PAD }
          : { paddingLeft: PANEL_HEADER_LEFT_PAD }),
      }}
    >
      <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {t('workbench.toolWindows.trafficMonitor')}
      </strong>
      <InfoTrigger content={info} className="rules-panel-header-info" />
      <div className="rules-panel-header-actions" data-focus-skip style={{ marginLeft: 'auto' }}>
        {/* The layout toggle's icon shows the TARGET layout — the side
            the sources rail SWITCHES TO, not where it is. */}
        <Tooltip placement="bottom" title={railSideToggleLabel}>
          <span
            role="button"
            tabIndex={0}
            aria-label={railSideToggleLabel}
            data-testid="traffic-monitor-rail-side-toggle"
            className="rules-panel-header-action"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRailSide(railSideOther)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setRailSide(railSideOther);
            }}
          >
            <LayoutMenuIcon kind={railSide === 'left' ? 'split-right' : 'split-left'} size={14} />
          </span>
        </Tooltip>
        <span
          role="button"
          tabIndex={0}
          aria-label={t('shared.dock.hidePanel')}
          className="rules-panel-header-action"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onHide}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onHide();
          }}
        >
          <MinusOutlined />
        </span>
      </div>
    </div>
  );
  const headerSash = (
    <div
      className="traffic-monitor-rail-sash traffic-monitor-rail-sash--top"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onRailSashDown}
    />
  );
  const headerStrip = (
    <TrafficMonitorTabStrip
      tabs={openTabs}
      activeKey={selectedKey}
      focused={dockFocused && !railFocused}
      onActivate={onActivateStripTab}
      onClose={onCloseStripTab}
    />
  );
  const railNode = (
    // display:contents so the focus-tracking wrapper stays out of the
    // rail | sash | planes flex row — focusin/focusout still bubble
    // through it, which is all the railFocused gate needs.
    <div
      style={{ display: 'contents' }}
      onFocus={() => setRailFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRailFocused(false);
      }}
    >
      <TrafficMonitorSourceRail
        peers={peers}
        loading={loading}
        showWire={showWire}
        wireRunning={proxy.status?.running === true}
        wirePort={proxy.status?.boundPort ?? null}
        selected={selectedKey}
        onSelect={onSelect}
        onDebugPin={onDebugPin}
        onDebugEnable={onDebugEnable}
        debugPending={debugPending}
        debugEnablePending={debugEnablePending}
        observeArmed={observeArmedKeys}
        observePending={observePending}
        onObserveAction={onObserveAction}
        captureActive={captureActive}
        onOpenSession={openArchivedSession}
        onSessionDeleted={onSessionDeleted}
        width={railWidth}
        side={railSide}
        wireControl={
          <WireCaptureControl
            controls={proxy}
            placement={railSide === 'left' ? 'rightBottom' : 'leftBottom'}
            onOpenProxySettings={onOpenProxySettings}
          />
        }
      />
    </div>
  );
  const bodySash = (
    <div
      className="traffic-monitor-rail-sash traffic-monitor-rail-sash--bottom"
      data-testid="traffic-monitor-rail-sash"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onRailSashDown}
    />
  );

  return (
    <div className="rules-bottom-panel traffic-monitor-panel">
      {/* Single-row header (terminal posture): the title cell — sized to
          the rail width — the divider's header segment, and the source
          tab strip share the ONE 36px PanelHeader row, so the divider
          reads as one continuous bar from the card's top edge down
          through the body row; the whole row mirrors with the rail
          side. The (i) rides inline after the title — PanelHeader's
          own info slot would land after the flex-grown strip. */}
      <PanelHeader
        wiring={headerWiring}
        title={
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, alignSelf: 'stretch' }}>
            {railSide === 'left' ? (
              <>
                {headerTitleCell}
                {headerSash}
                {headerStrip}
              </>
            ) : (
              <>
                {headerStrip}
                {headerSash}
                {headerTitleCell}
              </>
            )}
          </div>
        }
      />
      <div style={{ display: 'flex', minHeight: 0, flex: '1 1 auto' }}>
        {railSide === 'left' && (
          <>
            {railNode}
            {bodySash}
          </>
        )}
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            {wireSelected ? (
              <NetworkCaptureView
                key={WIRE_SOURCE_KEY}
                tabId={PROXY_LIFECYCLE_TAB_ID}
                onInspectRequest={inspectWireRequest}
                highlightRequestId={wireHighlight}
                wireJoin={WIRE_VIEW_JOIN}
                onWireSeenJump={onWireSeenJump}
                emptyHero={
                  <div className="dt-empty-hero">
                    <strong>
                      {proxy.status?.running === true
                        ? t('workbench.proxyCapture.emptyRunning')
                        : t('workbench.proxyCapture.emptyStopped')}
                    </strong>
                    <span className="dt-empty-hero-sub">
                      {proxy.status?.running === true
                        ? t('workbench.proxyCapture.emptyRunningHint', {
                            port: proxy.status.boundPort ?? proxy.status.port,
                          })
                        : t('workbench.proxyCapture.emptyStoppedHint')}
                    </span>
                  </div>
                }
              />
            ) : activeSessionId !== undefined && activeSessionPartition !== undefined ? (
              <div style={{ height: '100%', minHeight: 0 }} data-testid="traffic-monitor-session-plane">
                <NetworkCaptureView
                  key={activeSession?.key}
                  tabId={activeSessionPartition}
                  portName={sessionPortName}
                  onInspectRequest={inspectSessionRequest}
                  highlightRequestId={sessionHighlight}
                  watchRefusedCopy={sessionUnavailableCopy}
                  emptyHero={
                    <div className="dt-empty-hero">
                      <strong>{t('workbench.sessionReplay.empty')}</strong>
                      <span className="dt-empty-hero-sub">{t('workbench.sessionReplay.emptyHint')}</span>
                    </div>
                  }
                />
              </div>
            ) : tabSelection && !selectedPeerConsent ? (
              <div className="dt-empty-hero" style={{ height: '100%' }} data-testid="traffic-monitor-consent-hero">
                <strong>{t('workbench.trafficMonitor.watchConsentOffEmpty')}</strong>
                <span className="dt-empty-hero-sub">{t('workbench.trafficMonitor.watchConsentOffEmptyHint')}</span>
              </div>
            ) : tabSelection && tabPortName ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                {networkCollapsed ? (
                  <button
                    type="button"
                    className="traffic-monitor-plane-strip"
                    data-testid="traffic-monitor-network-strip"
                    onClick={() => setNetworkCollapsed(false)}
                  >
                    {t('panel.toolWindows.network')}
                  </button>
                ) : (
                  <div ref={growerPaneRef} style={{ flex: '1 1 0', minHeight: GROW_PANE_MIN_HEIGHT, overflow: 'hidden' }}>
                    <NetworkCaptureView
                      key={tabSourceKey(tabSelection.nodeId, tabSelection.tabId)}
                      tabId={tabSelection.tabId}
                      portName={tabPortName}
                      onInspectRequest={inspectTabRequest}
                      highlightRequestId={tabHighlight}
                      wireJoin={tabWireJoin}
                      collapseToggle={() => setNetworkCollapsed(true)}
                      emptyHero={
                        <div className="dt-empty-hero">
                          <strong>{t('workbench.trafficMonitor.emptyWatching')}</strong>
                          <span className="dt-empty-hero-sub">{t('workbench.trafficMonitor.emptyWatchingHint')}</span>
                        </div>
                      }
                    />
                  </div>
                )}
                {storageCollapsed ? (
                  <button
                    type="button"
                    className="traffic-monitor-plane-strip"
                    data-testid="traffic-monitor-storage-strip"
                    onClick={() => setStorageCollapsed(false)}
                  >
                    {t('panel.toolWindows.storage')}
                  </button>
                ) : (
                  <>
                    {!storageGrows && (
                      <div
                        className="traffic-monitor-storage-sash"
                        data-testid="traffic-monitor-storage-sash"
                        role="separator"
                        aria-orientation="horizontal"
                        onPointerDown={onStorageSashDown}
                      />
                    )}
                    <div
                      key={`storage-${tabSourceKey(tabSelection.nodeId, tabSelection.tabId)}`}
                      ref={storageGrows ? growerPaneRef : undefined}
                      className="traffic-monitor-plane-pane"
                      data-testid="traffic-monitor-storage-pane"
                      style={
                        storageGrows
                          ? { flex: '1 1 0', minHeight: GROW_PANE_MIN_HEIGHT, overflow: 'hidden' }
                          : { height: storageHeight, flex: '0 1 auto', minHeight: FIXED_PANE_MIN_HEIGHT, overflow: 'hidden' }
                      }
                    >
                      <InspectedTabContext.Provider value={storageHandle}>
                        <div className="dt-capture-surface">
                          <StoragePanel
                            onHide={() => setStorageCollapsed(true)}
                            collapseToggle={() => setStorageCollapsed(true)}
                            onOpenIdbRecord={openIdbRecord}
                            onOpenDomEntry={openDomEntry}
                            onOpenCookie={openCookie}
                            onOpenCacheEntry={openCacheEntry}
                            reveal={storageReveal}
                            onRevealConsumed={() => setStorageReveal(null)}
                            activeStorageTabId={activeStorageTabId}
                          />
                        </div>
                      </InspectedTabContext.Provider>
                    </div>
                  </>
                )}
                {consoleCollapsed ? (
                  <button
                    type="button"
                    className="traffic-monitor-plane-strip"
                    data-testid="traffic-monitor-console-strip"
                    onClick={() => setConsoleCollapsed(false)}
                  >
                    {t('panel.toolWindows.console')}
                  </button>
                ) : (
                  <>
                    {!consoleGrows && (
                      <div
                        className="traffic-monitor-console-sash"
                        data-testid="traffic-monitor-console-sash"
                        role="separator"
                        aria-orientation="horizontal"
                        onPointerDown={onConsoleSashDown}
                      />
                    )}
                    <div
                      key={`console-${tabSourceKey(tabSelection.nodeId, tabSelection.tabId)}`}
                      className="traffic-monitor-plane-pane"
                      data-testid="traffic-monitor-console-pane"
                      style={
                        consoleGrows
                          ? { flex: '1 1 0', minHeight: GROW_PANE_MIN_HEIGHT, overflow: 'hidden' }
                          : { height: consoleHeight, flex: '0 1 auto', minHeight: FIXED_PANE_MIN_HEIGHT, overflow: 'hidden' }
                      }
                    >
                      <div className="dt-capture-surface">
                        <TrafficConsolePane
                          nodeId={tabSelection.nodeId}
                          tabId={tabSelection.tabId}
                          debug={selectedPeerDebug}
                          onHide={() => setConsoleCollapsed(true)}
                          collapseToggle={() => setConsoleCollapsed(true)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="dt-empty-hero" style={{ height: '100%' }} data-testid="traffic-monitor-empty-hero">
                <strong>{t('workbench.trafficMonitor.emptyNoSource')}</strong>
                <span className="dt-empty-hero-sub">{t('workbench.trafficMonitor.emptyNoSourceHint')}</span>
              </div>
            )}
          </div>
        </div>
        {railSide === 'right' && (
          <>
            {bodySash}
            {railNode}
          </>
        )}
      </div>
    </div>
  );
};

export default TrafficMonitorPanel;
