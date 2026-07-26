/**
 * PanelResponsiveContext — the single owner of the panel's settled
 * width and derived width tier.
 *
 * The panel document IS the panel (a DevTools iframe), so
 * `window.innerWidth` is the panel's inline size. Width updates on the
 * TRAILING edge of resize only: a DevTools re-dock or sash drag fires
 * a resize storm, and structural consumers (Allotment size clamps, the
 * single-surface switch, the toolbar overflow fold) re-rendering per
 * tick would drag the whole shell — every keep-alive editor tab body —
 * through every frame. Chrome-only collapses that can afford to be
 * live use the `dt-panel` / `dt-pane` CSS containers instead; this
 * context is for decisions CSS cannot make (moving DOM, Allotment
 * inputs, dock-layout behavior).
 */

import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { type PanelWidthTier, SINGLE_SURFACE_MAX_PX, tierForWidth } from './tiers';

export interface PanelResponsiveState {
  /** Trailing-settled panel width in CSS px (`window.innerWidth`). */
  width: number;
  /** Width tier derived from `width` — see tiers.ts for semantics. */
  tier: PanelWidthTier;
  /** True when the shell should show one surface at a time. */
  singleSurface: boolean;
}

const PanelResponsiveContext = createContext<PanelResponsiveState | null>(null);

const SETTLE_MS = 150;

export function PanelResponsiveProvider({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        setWidth(window.innerWidth);
      }, SETTLE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  const value = useMemo<PanelResponsiveState>(
    () => ({ width, tier: tierForWidth(width), singleSurface: width < SINGLE_SURFACE_MAX_PX }),
    [width],
  );

  return <PanelResponsiveContext.Provider value={value}>{children}</PanelResponsiveContext.Provider>;
}

export function usePanelResponsive(): PanelResponsiveState {
  const ctx = useContext(PanelResponsiveContext);
  if (ctx === null) throw new Error('usePanelResponsive must be used within PanelResponsiveProvider');
  return ctx;
}
