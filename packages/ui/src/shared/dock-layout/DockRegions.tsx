/**
 * Dock region containers — the side columns (SideRegion) and the bottom
 * bar (BottomRegion) that host the dock bodies inside their Allotment
 * splits. Both restore the user's last sash drag on visibility flips,
 * which Allotment forgets on its own. Generic over the tool-window ID
 * type; extracted from ShellLayout.
 */

import { Allotment, type AllotmentHandle } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { regionDocks } from './constants';
import { DockBodyStack } from './DockBodyStack';
import type { FocusStore } from './focus-store';
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

interface SideRegionProps<T extends string> {
  region: 'left' | 'right';
  tl: DockLayoutApi<T>;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
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

  // Allotment forgets the user-dragged split when one pane goes
  // invisible — on re-show it falls back to minimumSize. We snapshot
  // sizes only on the user's sash-drag end (so visibility-flip-induced
  // onChange events don't overwrite the user's intent) and replay them
  // via the imperative `resize` handle when both panes come back visible.
  const allotmentRef = useRef<AllotmentHandle>(null);
  const lastBothVisibleSizesRef = useRef<number[] | null>(null);
  const handleDragEnd = (sizes: number[]) => {
    if (topActive !== null && bottomActive !== null) {
      lastBothVisibleSizesRef.current = sizes;
    }
  };
  useEffect(() => {
    if (topActive !== null && bottomActive !== null && lastBothVisibleSizesRef.current) {
      allotmentRef.current?.resize(lastBothVisibleSizesRef.current);
    }
  }, [topActive, bottomActive]);

  // Initial 60/40 (right region) / 50/50 (left region) via `defaultSizes`.
  // We deliberately do NOT pass per-pane `preferredSize` here: Allotment's
  // native sashreset would resize the left-adjacent pane to its
  // preferredSize first, snapping back to the seed split. Omitting it
  // makes sashreset fall through to `distributeViewSizes()` — equalize
  // to 50/50 — which is the reset behavior the user asked for.
  const sideDefaultSizes = useMemo(
    () => [topSize.preferred, bottomSize.preferred],
    [topSize.preferred, bottomSize.preferred],
  );

  return (
    <div
      className={`rules-region rules-region-${region}`}
      data-region={region}
      tabIndex={-1}
      style={{ height: '100%', background: token.colorBgLayout }}
    >
      <Allotment
        ref={allotmentRef}
        vertical
        proportionalLayout
        onDragEnd={handleDragEnd}
        defaultSizes={sideDefaultSizes}
      >
        {/* Bodies render unconditionally (the pane's `visible` hides the
            whole dock): DockBodyStack keeps activated windows mounted so
            their state survives tab switches and dock close/reopen. */}
        <Allotment.Pane minSize={topSize.min} visible={topActive !== null}>
          <FocusAwareDockBody slot={topSlot} focusStore={focusStore} baseClass="rules-dock-body">
            <DockBodyStack windows={topDock.windows} active={topActive} slot={topSlot} renderToolWindow={renderToolWindow} />
          </FocusAwareDockBody>
        </Allotment.Pane>
        <Allotment.Pane minSize={bottomSize.min} visible={bottomActive !== null}>
          <FocusAwareDockBody slot={bottomSlot} focusStore={focusStore} baseClass="rules-dock-body">
            <DockBodyStack
              windows={bottomDock.windows}
              active={bottomActive}
              slot={bottomSlot}
              renderToolWindow={renderToolWindow}
            />
          </FocusAwareDockBody>
        </Allotment.Pane>
      </Allotment>
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

  const allotmentRef = useRef<AllotmentHandle>(null);
  const lastBothVisibleSizesRef = useRef<number[] | null>(null);
  const handleDragEnd = (sizes: number[]) => {
    if (leftActive !== null && rightActive !== null) {
      lastBothVisibleSizesRef.current = sizes;
    }
  };
  // A remembered sash drag is meaningless across an axis flip (widths
  // vs heights) — drop it so the re-keyed Allotment seeds 50/50.
  useEffect(() => {
    lastBothVisibleSizesRef.current = null;
  }, [split]);
  useEffect(() => {
    if (leftActive === null || rightActive === null) return;
    // Restore the user's last drag if we have one, otherwise fall back
    // to an equal split. Allotment doesn't apply preferredSize on
    // visibility transitions — it uses minimumSize — so the first time
    // both panes become visible we have to nudge the split ourselves.
    if (lastBothVisibleSizesRef.current) {
      allotmentRef.current?.resize(lastBothVisibleSizesRef.current);
    } else {
      allotmentRef.current?.reset();
    }
  }, [leftActive, rightActive]);

  // Bodies render unconditionally (the pane's `visible` hides the whole
  // dock): DockBodyStack keeps activated windows mounted so their state
  // survives tab switches and dock close/reopen.
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

  // Keyed by split so an axis flip cleanly remounts the Allotment —
  // its internal pane sizes are per-axis and don't survive a `vertical`
  // prop change in place. Stacked rows take a smaller minimum than the
  // side-by-side columns: 200px of height would forbid two rows inside
  // typical bottom-panel heights, while 84px still fits a panel header
  // plus a usable content strip.
  const stacked = split === 'rows';
  const paneMin = stacked ? 84 : 200;

  return (
    <div className="rules-region rules-region-bottom" data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
      <Allotment key={split} ref={allotmentRef} vertical={stacked} proportionalLayout onDragEnd={handleDragEnd}>
        <Allotment.Pane preferredSize="50%" visible={leftActive !== null} minSize={paneMin}>
          {renderBottomSub('bottom-left')}
        </Allotment.Pane>
        <Allotment.Pane preferredSize="50%" visible={rightActive !== null} minSize={paneMin}>
          {renderBottomSub('bottom-right')}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
