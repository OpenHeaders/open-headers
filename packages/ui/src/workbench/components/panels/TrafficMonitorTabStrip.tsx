/**
 * TrafficMonitorTabStrip — the Traffic Monitor's per-source tab row,
 * riding the panel header's 32 px line right of the full-height rail
 * divider (the editor-area posture: title left of the divider, tabs
 * right of it). Each tab IS a source — one per observed browser tab,
 * one for the wire partition — opened-or-activated by rail clicks; the
 * active tab drives the panel's plane views.
 *
 * The bar anatomy is the editor tab strip's (`rules-tabs-bar` /
 * `rules-tabs-scroll`, pills via `tab-format`, auto-scroll active into
 * view, wheel→horizontal, overflow fade, {@link OverlayScrollThumb}) —
 * deliberately WITHOUT the editor's drag/split/context-menu machinery
 * and without a `+`: tabs only ever come from the rail.
 *
 * Pure presentation: the panel owns the tab list, the selection, and
 * the retirement of vanished sources.
 */

import { CloseOutlined, FileOutlined, GlobalOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import OverlayScrollThumb from '../tabbar/OverlayScrollThumb';
import { activePillRing } from '../tabbar/tab-format';
import { WIRE_SOURCE_KEY } from './TrafficMonitorSourceRail';

/**
 * One open source tab. `label`/`favIconUrl` mirror the rail inventory
 * (refreshed live by the panel; empty label falls back to the untitled
 * copy at render). Browser-tab entries carry their lifeline binding so
 * activation never has to re-derive it from the key.
 */
export interface TrafficStripTab {
  key: string;
  label: string;
  favIconUrl?: string;
  nodeId?: string;
  tabId?: number;
}

export interface TrafficMonitorTabStripProps {
  tabs: readonly TrafficStripTab[];
  activeKey: string | null;
  /** True while the panel's dock owns focus — the active pill renders
   *  with the primary tint (editor tab strip posture), neutral grey
   *  otherwise. */
  focused: boolean;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

function SourceTabPill({
  tab,
  active,
  focused,
  onActivate,
  onClose,
}: {
  tab: TrafficStripTab;
  active: boolean;
  focused: boolean;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const [hovered, setHovered] = useState(false);
  const isWire = tab.key === WIRE_SOURCE_KEY;
  const label = isWire
    ? t('workbench.trafficMonitor.trafficInterception')
    : tab.label || t('workbench.trafficMonitor.untitledTab');
  return (
    <span
      role="tab"
      tabIndex={0}
      aria-selected={active}
      data-testid="traffic-monitor-tab"
      data-tab-key={tab.key}
      data-tab-active={active || undefined}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onActivate(tab.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate(tab.key);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        // 2px vertical (editor pill metric): breathing room above the
        // pill and below it, where the 3px scrollbar gutter rides.
        padding: '2px 8px 2px 10px',
        borderRadius: token.borderRadiusSM,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background: active
          ? focused
            ? token.colorPrimaryBg
            : token.colorFillSecondary
          : hovered
            ? token.colorFillTertiary
            : 'transparent',
        boxShadow: active ? activePillRing(token, isDarkMode, focused) : undefined,
        color: active ? token.colorText : token.colorTextSecondary,
      }}
    >
      {isWire ? (
        <GlobalOutlined style={{ fontSize: 12, flexShrink: 0 }} />
      ) : tab.favIconUrl?.startsWith('data:') ? (
        <img src={tab.favIconUrl} alt="" width={14} height={14} style={{ flexShrink: 0, borderRadius: 2 }} />
      ) : (
        <FileOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flexShrink: 0 }} />
      )}
      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span
        role="button"
        tabIndex={-1}
        aria-label={t('workbench.trafficMonitor.closeSourceTab')}
        data-testid="traffic-monitor-tab-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.key);
        }}
        style={{ display: 'inline-flex', alignItems: 'center', fontSize: 9, color: token.colorTextTertiary }}
      >
        <CloseOutlined />
      </span>
    </span>
  );
}

const TrafficMonitorTabStrip: React.FC<TrafficMonitorTabStripProps> = ({
  tabs,
  activeKey,
  focused,
  onActivate,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll the active tab into view (editor strip posture:
  // instant, and snap to the end when the last tab is active). ──────
  useEffect(() => {
    if (activeKey === null || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].key === activeKey;
    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' });
    } else {
      const el = container.querySelector(`[data-tab-key="${CSS.escape(activeKey)}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }
  }, [activeKey, tabs]);

  // ── Vertical wheel → horizontal scroll (normalized deltas). ───────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const el = scrollRef.current;
    if (!el) return;
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
    el.scrollLeft += e.deltaY * unit;
  }, []);

  // ── Edge-fade mask only while actually overflowing. ───────────────
  const [hasOverflow, setHasOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollWidth > el.clientWidth + 1;
    if (next !== hasOverflow) setHasOverflow(next);
  });

  return (
    <div className="rules-tabs-bar" style={{ flex: 1, minWidth: 0 }}>
      <div
        className={`rules-tabs-scroll${hasOverflow ? ' is-overflow' : ''}`}
        data-testid="traffic-monitor-tab-strip"
        ref={scrollRef}
        onWheel={handleWheel}
      >
        {tabs.map((tab) => (
          <SourceTabPill
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            focused={focused}
            onActivate={onActivate}
            onClose={onClose}
          />
        ))}
      </div>

      {/* Gecko stand-in for the 3px webkit hover scrollbar. */}
      <OverlayScrollThumb scrollRef={scrollRef} />
    </div>
  );
};

export default TrafficMonitorTabStrip;