/**
 * VerticalActivityBar — one side's activity rail for the dock shell.
 *
 * Renders the three tab strips on a side (two upper subslots + the lower
 * bottom-panel strip) and, in `dynamic` sidebar mode, mirrors the live
 * dock-body heights onto the subslot flex weights via ResizeObserver so
 * the bar's dividers track Allotment's own drag updates. Generic over the
 * tool-window ID type.
 */

import { Dropdown, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { regionDocks } from './constants';
import DockTabStrip, { type DockTabStripProps } from './DockTabStrip';
import type { FocusStore } from './focus-store';
import type { DockSlot, SidebarLayoutVariant, ToolWindowDef } from './types';
import type { DockLayoutApi } from './use-dock-layout';

interface VerticalBarProps<T extends string> {
  side: 'left' | 'right';
  tl: DockLayoutApi<T>;
  windowMap: Record<T, ToolWindowDef<T>>;
  getWindows: (slot: DockSlot) => T[];
  dragging: boolean;
  showLabels: boolean;
  sidebarLayout: SidebarLayoutVariant;
  onToggleLabels: () => void;
  focusStore: FocusStore;
  /** Passed into the Dynamic height-mirror hook so it re-runs — and
      re-binds its ResizeObserver — whenever the layout restructures and
      the dock-body DOM nodes remount under a new subtree. */
  layoutRevision: string;
}

/**
 * Per-slot wrapper that subscribes to the focus store independently,
 * so only the strip whose focus state changed re-renders — not the
 * entire ShellLayout tree.
 */
function FocusAwareStrip<T extends string>({
  focusStore: store,
  ...props
}: Omit<DockTabStripProps<T>, 'isFocused'> & { focusStore: FocusStore }) {
  const focused = store.useIsDockFocused(props.slot);
  return <DockTabStrip<T> {...props} isFocused={focused} />;
}

/**
 * Dynamic mode — mirror the heights of the two adjacent docks on this
 * side onto the upper subslots' flex-grow weights. Uses ResizeObserver on
 * the live `.rules-dock-body` elements (located via `data-dock-slot`) so
 * the mirror tracks Allotment's own drag updates without us having to tap
 * into Allotment's internals.
 *
 * - Only attaches when `enabled` (sidebarLayout === 'dynamic').
 * - If a dock is closed (`active === null`), there is no dock-body element
 *   in the DOM; the corresponding subslot carries `--empty` (which flips
 *   to `flex: 0 0 auto` in CSS) and no grow weight is written.
 * - Runs on a rAF to coalesce multiple RO callbacks during a drag.
 */
function useDynamicActivityMirror(
  enabled: boolean,
  side: 'left' | 'right',
  barRef: React.RefObject<HTMLDivElement | null>,
  activeSignal: string,
) {
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const firstSubslot = bar.querySelector<HTMLElement>('.rules-activity-subslot--first');
    const secondSubslot = bar.querySelector<HTMLElement>('.rules-activity-subslot--second');
    const topGroup = bar.querySelector<HTMLElement>('.rules-activity-group--top');
    const bottomGroup = bar.querySelector<HTMLElement>('.rules-activity-group--bottom');

    const clear = () => {
      for (const el of [firstSubslot, secondSubslot]) {
        if (!el) continue;
        el.style.removeProperty('--mirror-grow');
        el.style.removeProperty('height');
        el.style.removeProperty('flex');
      }
      if (topGroup) topGroup.style.flex = '';
      if (bottomGroup) {
        bottomGroup.style.top = '';
        bottomGroup.style.bottom = '';
      }
    };

    if (!enabled) {
      clear();
      return;
    }

    const shell = bar.closest('.rules-main') ?? document.body;
    const topDock = shell.querySelector<HTMLElement>(`.rules-dock-body[data-dock-slot="${side}-top"]`);
    const bottomDock = shell.querySelector<HTMLElement>(`.rules-dock-body[data-dock-slot="${side}-bottom"]`);
    // The side region — activity bar total height ≠ region height in
    // justify / left / right alignments (the bottom panel pushes the
    // region up). Measuring the region lets us clamp the bar's top group
    // to match, so subslot dividers align with pane dividers absolutely.
    const sideRegion = shell.querySelector<HTMLElement>(`.rules-region-${side}`);

    if (!topDock && !bottomDock && !sideRegion) {
      clear();
      return;
    }

    let raf = 0;
    const sync = () => {
      raf = 0;
      // Only pin exact subslot heights when BOTH side-panes are live.
      // If one side is empty (active === null), the CSS empty-migration
      // (flex: 0 0 auto on the live subslot via :has) keeps both
      // subslots content-sized and tabs stack at the top — pinning
      // here would force the live subslot to fill topGroup, pushing
      // the empty subslot's inactive icons off the bottom of the bar.
      const bothLive = !!topDock && !!bottomDock;
      if (firstSubslot) {
        if (bothLive && topDock) {
          const h = Math.max(1, topDock.getBoundingClientRect().height + 6);
          firstSubslot.style.height = `${h}px`;
          firstSubslot.style.flex = '0 0 auto';
        } else {
          firstSubslot.style.removeProperty('height');
          firstSubslot.style.removeProperty('flex');
        }
        firstSubslot.style.removeProperty('--mirror-grow');
      }
      if (secondSubslot) {
        if (bothLive && bottomDock) {
          const h = Math.max(1, bottomDock.getBoundingClientRect().height + 6);
          secondSubslot.style.height = `${h}px`;
          secondSubslot.style.flex = '0 0 auto';
        } else {
          secondSubslot.style.removeProperty('height');
          secondSubslot.style.removeProperty('flex');
        }
        secondSubslot.style.removeProperty('--mirror-grow');
      }

      // Clamp the top group to the side region's height so subslot
      // dividers align with pane dividers absolutely. Only applies when
      // the region is actually shorter than the bar (justify mode on
      // either side, and the side adjacent to the bottom panel in
      // left/right modes). When the region == bar height (center mode,
      // or the "non-aligned" side in left/right modes), we clear the
      // inline styles so the default CSS — top group fills bar, bottom
      // group absolute `bottom: 0` — keeps the lower chip cluster at
      // the bar's bottom edge instead of pushing it off-screen.
      if (sideRegion && topGroup && bottomGroup && bar) {
        const regionH = sideRegion.getBoundingClientRect().height;
        const barH = bar.getBoundingClientRect().height;
        // Subtract the bar's top padding so topGroup's bottom edge
        // still lands exactly at side-region bottom (and the bottom
        // group at top: regionH stays flush with the side region).
        // Float values throughout — rounding here pushed the bottom
        // group ~1px off from the bottom panel's header.
        const barPadTop = parseFloat(getComputedStyle(bar).paddingTop) || 0;
        if (regionH > 0 && regionH < barH - 4) {
          topGroup.style.flex = `0 0 ${Math.max(0, regionH - barPadTop)}px`;
          bottomGroup.style.top = `${regionH}px`;
          bottomGroup.style.bottom = 'auto';
        } else {
          topGroup.style.flex = '';
          bottomGroup.style.top = '';
          bottomGroup.style.bottom = '';
        }
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };

    sync();
    const ro = new ResizeObserver(schedule);
    if (topDock) ro.observe(topDock);
    if (bottomDock) ro.observe(bottomDock);
    if (sideRegion) ro.observe(sideRegion);
    // Observe the bar itself so the clamp-vs-default decision re-runs
    // when the shell resizes (e.g. window resize changes barH).
    ro.observe(bar);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, [enabled, side, barRef, activeSignal]);
}

function VerticalActivityBar<T extends string>({
  side,
  tl,
  windowMap,
  getWindows,
  dragging,
  showLabels,
  sidebarLayout,
  onToggleLabels,
  focusStore,
  layoutRevision,
}: VerticalBarProps<T>) {
  const { token } = theme.useToken();
  const [upperFirstSlot, upperSecondSlot] = regionDocks(side);
  const lowerSlot: DockSlot = side === 'left' ? 'bottom-left' : 'bottom-right';

  const upperFirstWindows = getWindows(upperFirstSlot);
  const upperSecondWindows = getWindows(upperSecondSlot);
  const lowerWindows = getWindows(lowerSlot);

  // `--empty` migration: when a dock's `active` is null its content panel
  // isn't rendered, so its chip cluster should collapse to content-size
  // and let the live neighbor absorb the space. This is the first half of
  // Dynamic; the height-mirror hook below adds the second half.
  const upperFirstEmpty = tl.state.docks[upperFirstSlot].active === null;
  const upperSecondEmpty = tl.state.docks[upperSecondSlot].active === null;
  const lowerEmpty = tl.state.docks[lowerSlot].active === null;

  // Encoded dock activity across this side — whenever any of the three
  // docks opens/closes the mirror hook re-runs and re-binds to the newly
  // mounted / unmounted `.rules-dock-body` nodes. `layoutRevision` covers
  // layout restructures (e.g. toggling bottomPanelAlignment) that remount
  // the dock bodies under a new subtree without changing active ids.
  const activeSignal = `${tl.state.docks[upperFirstSlot].active ?? ''}|${tl.state.docks[upperSecondSlot].active ?? ''}|${tl.state.docks[lowerSlot].active ?? ''}|${layoutRevision}`;

  const barRef = useRef<HTMLDivElement | null>(null);
  useDynamicActivityMirror(sidebarLayout === 'dynamic', side, barRef, activeSignal);

  const barMenu: ItemType[] = [
    {
      key: 'labels',
      label: showLabels ? 'Hide Tool Window Names' : 'Show Tool Window Names',
      onClick: onToggleLabels,
    },
  ];

  const renderStrip = (slot: DockSlot, windowsList: T[]) => (
    <FocusAwareStrip<T>
      slot={slot}
      windows={windowsList}
      activeId={tl.state.docks[slot].active}
      orientation="vertical"
      showLabels={showLabels}
      dragging={dragging}
      windowMap={windowMap}
      focusStore={focusStore}
      onActivate={tl.toggleWindow}
      onHide={tl.hideWindow}
      onMove={tl.moveWindow}
      onCloseDock={() => tl.closeDock(slot)}
      onToggleLabels={onToggleLabels}
    />
  );

  return (
    <Dropdown menu={{ items: barMenu }} trigger={['contextMenu']}>
      <div
        ref={barRef}
        className={`rules-activity-bar rules-activity-bar--${side} ${showLabels ? '' : 'rules-activity-bar--compact'} rules-activity-bar--layout-${sidebarLayout}${lowerEmpty ? ' rules-activity-bar--lower-empty' : ''}`}
        style={{ background: token.colorBgLayout }}
        data-side={side}
      >
        <div className="rules-activity-group rules-activity-group--top">
          <div
            className={`rules-activity-subslot rules-activity-subslot--first${upperFirstEmpty ? ' rules-activity-subslot--empty' : ''}`}
          >
            {renderStrip(upperFirstSlot, upperFirstWindows)}
          </div>
          <div
            className={`rules-activity-subslot rules-activity-subslot--second${upperSecondEmpty ? ' rules-activity-subslot--empty' : ''}`}
          >
            {renderStrip(upperSecondSlot, upperSecondWindows)}
          </div>
        </div>
        <div
          className={`rules-activity-group rules-activity-group--bottom${lowerEmpty ? ' rules-activity-group--bottom-empty' : ''}`}
        >
          {renderStrip(lowerSlot, lowerWindows)}
        </div>
      </div>
    </Dropdown>
  );
}

export default VerticalActivityBar;
