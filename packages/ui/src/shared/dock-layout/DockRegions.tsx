/**
 * Dock region containers — the side columns (SideRegion) and the bottom
 * bar (BottomRegion), each hosting a pair of dock bodies.
 *
 * A pair is a flex container whose two panes carry grow WEIGHTS in
 * custom properties (see track-model.ts). The split is proportional by
 * construction, so it follows any container resize with no JavaScript,
 * and a hidden pane leaves its weight in place so the split comes back
 * intact when the dock reopens. Dragging the seam rewrites the two
 * weights; double-click equalizes them. Generic over the tool-window
 * ID type.
 */

import { theme } from 'antd';
import type React from 'react';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { regionDocks } from './constants';
import { DockBodyStack } from './DockBodyStack';
import type { FocusStore } from './focus-store';
import Sash, { type SashSession } from './Sash';
import { PANE_WEIGHT_VARS } from './track-model';
import type { BottomPanelSplit, DockSlot } from './types';
import type { DockLayoutApi } from './use-dock-layout';

/**
 * Dock body wrapper that subscribes to the focus store and adds
 * `.rules-dock-body--focused` when this slot is the focused dock. The
 * CSS rule layers on the persistent "actions visible" state — clicking
 * into a panel (blue activity-bar chip) keeps its action row shown
 * even after the mouse leaves.
 */
interface FocusAwareDockBodyProps {
  slot: DockSlot;
  focusStore: FocusStore;
  baseClass: string;
  children?: React.ReactNode;
}

function FocusAwareDockBody({ slot, focusStore, baseClass, children }: FocusAwareDockBodyProps) {
  const focused = focusStore.useIsDockFocused(slot);
  return (
    <div className={`${baseClass}${focused ? ' rules-dock-body--focused' : ''}`} data-dock-slot={slot} tabIndex={-1}>
      {children}
    </div>
  );
}

/**
 * Drag + reset wiring for a two-pane pair. The sash sits on the START
 * edge of the second pane, so the session resizes the second pane and
 * the first takes the complement — both written as px weights, which
 * keeps the pair proportional from then on.
 */
function usePaneSash(
  rootRef: RefObject<HTMLDivElement | null>,
  firstRef: RefObject<HTMLDivElement | null>,
  secondRef: RefObject<HTMLDivElement | null>,
  axis: 'x' | 'y',
  firstMin: number,
  secondMin: number,
) {
  const begin = useCallback((): SashSession | null => {
    const root = rootRef.current;
    const first = firstRef.current;
    const second = secondRef.current;
    if (!root || !first || !second) return null;
    const a = axis === 'x' ? first.offsetWidth : first.offsetHeight;
    const b = axis === 'x' ? second.offsetWidth : second.offsetHeight;
    if (a <= 0 || b <= 0) return null;
    const total = a + b;
    return {
      start: b,
      min: secondMin,
      max: Math.max(secondMin, total - firstMin),
      apply: (px) => {
        root.style.setProperty(PANE_WEIGHT_VARS.second, String(px));
        root.style.setProperty(PANE_WEIGHT_VARS.first, String(total - px));
      },
      commit: () => {},
    };
  }, [rootRef, firstRef, secondRef, axis, firstMin, secondMin]);

  const reset = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty(PANE_WEIGHT_VARS.first, '1');
    root.style.setProperty(PANE_WEIGHT_VARS.second, '1');
  }, [rootRef]);

  return { begin, reset };
}

const paneStyle = (visible: boolean, min: number): React.CSSProperties =>
  ({
    display: visible ? undefined : 'none',
    [PANE_WEIGHT_VARS.min]: `${min}px`,
  }) as React.CSSProperties;

interface SideRegionProps<T extends string> {
  region: 'left' | 'right';
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  /** Seed split as weights (the region's first-open px halves) plus
      per-pane minimum heights. */
  topSize: { preferred: number; min: number };
  bottomSize: { preferred: number; min: number };
  focusStore: FocusStore;
}

export function SideRegion<T extends string>({
  region,
  tl,
  renderToolWindow,
  topSize,
  bottomSize,
  focusStore,
}: SideRegionProps<T>) {
  const { token } = theme.useToken();
  const [topSlot, bottomSlot] = regionDocks(region);
  const topDock = tl.state.docks[topSlot];
  const bottomDock = tl.state.docks[bottomSlot];
  const topActive = topDock.active;
  const bottomActive = bottomDock.active;

  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { begin, reset } = usePaneSash(rootRef, topRef, bottomRef, 'y', topSize.min, bottomSize.min);

  const rootStyle = {
    background: token.colorBgLayout,
    [PANE_WEIGHT_VARS.first]: topSize.preferred,
    [PANE_WEIGHT_VARS.second]: bottomSize.preferred,
  } as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`rules-region rules-region-${region} rules-dock-pair rules-dock-pair--rows`}
      data-region={region}
      tabIndex={-1}
      style={rootStyle}
    >
      {/* Bodies render unconditionally (the pane hides the whole dock):
          DockBodyStack keeps activated windows mounted so their state
          survives tab switches and dock close/reopen. */}
      <div ref={topRef} className="rules-dock-pane rules-dock-pane--first" style={paneStyle(topActive !== null, topSize.min)}>
        <FocusAwareDockBody slot={topSlot} focusStore={focusStore} baseClass="rules-dock-body">
          <DockBodyStack windows={topDock.windows} active={topActive} slot={topSlot} renderToolWindow={renderToolWindow} />
        </FocusAwareDockBody>
      </div>
      <div
        ref={bottomRef}
        className="rules-dock-pane rules-dock-pane--second"
        style={paneStyle(bottomActive !== null, bottomSize.min)}
      >
        {topActive !== null && bottomActive !== null && <Sash axis="y" edge="start" begin={begin} onReset={reset} />}
        <FocusAwareDockBody slot={bottomSlot} focusStore={focusStore} baseClass="rules-dock-body">
          <DockBodyStack
            windows={bottomDock.windows}
            active={bottomActive}
            slot={bottomSlot}
            renderToolWindow={renderToolWindow}
          />
        </FocusAwareDockBody>
      </div>
    </div>
  );
}

interface BottomRegionProps<T extends string> {
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
  focusStore: FocusStore;
  /** columns → bottom-left | bottom-right side by side; rows → stacked. */
  split: BottomPanelSplit;
}

export function BottomRegion<T extends string>({ tl, renderToolWindow, focusStore, split }: BottomRegionProps<T>) {
  const leftDock = tl.state.docks['bottom-left'];
  const rightDock = tl.state.docks['bottom-right'];
  const leftActive = leftDock.active;
  const rightActive = rightDock.active;

  // Stacked rows take a smaller minimum than the side-by-side columns:
  // 200px of height would forbid two rows inside typical bottom-panel
  // heights, while 84px still fits a panel header plus a usable
  // content strip.
  const stacked = split === 'rows';
  const paneMin = stacked ? 84 : 200;

  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const { begin, reset } = usePaneSash(rootRef, firstRef, secondRef, stacked ? 'y' : 'x', paneMin, paneMin);

  // A remembered seam drag is meaningless across an axis flip (widths
  // vs heights) — equalize on a split change.
  useEffect(() => {
    reset();
  }, [split, reset]);

  const renderBottomSub = (slot: DockSlot) => {
    const dock = tl.state.docks[slot];
    return (
      <FocusAwareDockBody slot={slot} focusStore={focusStore} baseClass="rules-dock-body rules-dock-body--bottom">
        <div className="rules-dock-content">
          <DockBodyStack windows={dock.windows} active={dock.active} slot={slot} renderToolWindow={renderToolWindow} />
        </div>
      </FocusAwareDockBody>
    );
  };

  const rootStyle = {
    [PANE_WEIGHT_VARS.first]: 1,
    [PANE_WEIGHT_VARS.second]: 1,
  } as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`rules-region rules-region-bottom rules-dock-pair rules-dock-pair--${stacked ? 'rows' : 'columns'}`}
      data-region="bottom"
      tabIndex={-1}
      style={rootStyle}
    >
      <div ref={firstRef} className="rules-dock-pane rules-dock-pane--first" style={paneStyle(leftActive !== null, paneMin)}>
        {renderBottomSub('bottom-left')}
      </div>
      <div ref={secondRef} className="rules-dock-pane rules-dock-pane--second" style={paneStyle(rightActive !== null, paneMin)}>
        {leftActive !== null && rightActive !== null && (
          <Sash axis={stacked ? 'y' : 'x'} edge="start" begin={begin} onReset={reset} />
        )}
        {renderBottomSub('bottom-right')}
      </div>
    </div>
  );
}
