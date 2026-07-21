/**
 * TrafficMonitorPanel — the unified Traffic Monitor tool window (Observability epic):
 * ONE observability surface with a source dimension, replacing the
 * former Proxy and Live Network windows.
 *
 * Layout: plane views on the left, the {@link TrafficMonitorSourceRail} on the
 * right. The rail lists every observable source — connected browser
 * peers' tabs (the daemon's telemetry inventory) and the wire-capture
 * partition (the L7 proxy). Selecting a source binds the left side to
 * it:
 *
 *   - a browser tab renders the shared {@link NetworkCaptureView} on
 *     that tab's QUALIFIED lifeline (`oh-lifecycle:<tabId>@<nodeId>`,
 *     relayed to the owning extension peer, subscription-gated end to
 *     end) — the storage plane stacks below it when Phase 3 lands
 *     (browser-truth only: the wire has no storage domain);
 *   - the wire renders the {@link ProxyCaptureStrip} (capture
 *     infrastructure, contextual to the source that owns it) over the
 *     same view bound to the reserved proxy partition.
 *
 * Row inspection routes outward to main editor tabs on both sources.
 * The window is gated on `liveNetwork`; the wire source additionally
 * requires `proxyCapture` — today every host that registers one
 * registers both (the desktop renderer, which runs the daemon spine
 * in-process), the rail just keeps the coupling honest.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import type { TelemetryDebugCommand } from '@openheaders/core/protocol';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import { qualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { NetworkCaptureView } from '../../../panel/components/NetworkCaptureView';
import { extractName } from '../../../panel/components/traffic/formatters';
import type { InspectorRowWithFires } from '../../../panel/data/inspector-row-projection';
import {
  RAIL_DEFAULT_WIDTH,
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  TrafficMonitorSourceRail,
  type RailPeer,
  tabSourceKey,
  WIRE_SOURCE_KEY,
} from './TrafficMonitorSourceRail';
import { ProxyCaptureStrip, useProxyCaptureStatus } from './ProxyCaptureStrip';

export interface TrafficMonitorPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
  /** Open a wire-capture row's inspector as a main editor tab. */
  onOpenProxyRequest: (requestId: string, label: string) => void;
  /** Open a browser-tab row's inspector as a main editor tab. */
  onOpenLiveRequest: (nodeId: string, tabId: number, requestId: string, label: string) => void;
  /** Open Settings › Proxy (CA install + trust). */
  onOpenProxySettings: () => void;
}

interface TabSelection {
  nodeId: string;
  tabId: number;
}

const TrafficMonitorPanel: React.FC<TrafficMonitorPanelProps> = ({
  info,
  onHide,
  onOpenProxyRequest,
  onOpenLiveRequest,
  onOpenProxySettings,
}) => {
  const t = useT();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const showWire = hasCapability('proxyCapture');
  const proxy = useProxyCaptureStatus();

  const [peers, setPeers] = useState<RailPeer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tabSelection, setTabSelection] = useState<TabSelection | null>(null);

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
        })),
      );
      // A picked tab that disappeared from the inventory (closed,
      // browser gone) stays selected — the lifeline keeps replaying the
      // engine's view until upstream clears it; the user re-picks.
    } catch {
      setPeers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const onSelect = useCallback(
    (key: string) => {
      setSelectedKey(key);
      if (key === WIRE_SOURCE_KEY) {
        setTabSelection(null);
        return;
      }
      for (const peer of peers) {
        for (const tab of peer.tabs) {
          if (tabSourceKey(peer.nodeId, tab.tabId) === key) {
            setTabSelection({ nodeId: peer.nodeId, tabId: tab.tabId });
            return;
          }
        }
      }
    },
    [peers],
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

  const wireSelected = selectedKey === WIRE_SOURCE_KEY;

  // Draggable rail width — the vertical sash resizes it, clamped.
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT_WIDTH);
  const onRailSashDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = railWidthRef.current;
    const move = (ev: PointerEvent): void => {
      // Rail is on the right, so dragging left (smaller clientX) widens it.
      const next = Math.min(Math.max(startWidth + (startX - ev.clientX), RAIL_MIN_WIDTH), RAIL_MAX_WIDTH);
      setRailWidth(next);
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);
  // Live width for the drag closure without re-binding the handler.
  const railWidthRef = useRef(railWidth);
  railWidthRef.current = railWidth;

  return (
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.trafficMonitor')}</strong>} info={info} />
      <div style={{ display: 'flex', minHeight: 0, height: '100%' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {wireSelected && <ProxyCaptureStrip controls={proxy} onOpenProxySettings={onOpenProxySettings} />}
          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            {wireSelected ? (
              <NetworkCaptureView
                key={WIRE_SOURCE_KEY}
                tabId={PROXY_LIFECYCLE_TAB_ID}
                onInspectRequest={inspectWireRequest}
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
            ) : tabSelection && tabPortName ? (
              <NetworkCaptureView
                key={tabSourceKey(tabSelection.nodeId, tabSelection.tabId)}
                tabId={tabSelection.tabId}
                portName={tabPortName}
                onInspectRequest={inspectTabRequest}
                emptyHero={
                  <div className="dt-empty-hero">
                    <strong>{t('workbench.trafficMonitor.emptyWatching')}</strong>
                    <span className="dt-empty-hero-sub">{t('workbench.trafficMonitor.emptyWatchingHint')}</span>
                  </div>
                }
              />
            ) : (
              <div className="dt-empty-hero" style={{ height: '100%' }}>
                <strong>{t('workbench.trafficMonitor.emptyNoSource')}</strong>
                <span className="dt-empty-hero-sub">{t('workbench.trafficMonitor.emptyNoSourceHint')}</span>
              </div>
            )}
          </div>
        </div>
        <div
          className="traffic-monitor-rail-sash"
          data-testid="traffic-monitor-rail-sash"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onRailSashDown}
        />
        <TrafficMonitorSourceRail
          peers={peers}
          loading={loading}
          onRefresh={() => void reload()}
          showWire={showWire}
          wireRunning={proxy.status?.running === true}
          wirePort={proxy.status?.boundPort ?? null}
          selected={selectedKey}
          onSelect={onSelect}
          onDebugPin={onDebugPin}
          onDebugEnable={onDebugEnable}
          debugPending={debugPending}
          debugEnablePending={debugEnablePending}
          width={railWidth}
        />
      </div>
    </div>
  );
};

export default TrafficMonitorPanel;
