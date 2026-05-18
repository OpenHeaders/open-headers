/**
 * Scoping seam for where `InfoPopover` portals its overlay.
 *
 * By default AntD's `<Popover>` portals to `document.body`. That works
 * for full-window surfaces (workbench, popup) but breaks inside the
 * browser DevTools panel: the panel page is a short iframe (~300-500px
 * tall) and an absolutely-positioned overlay on body grows the body's
 * scroll height, painting a vertical scrollbar on the panel itself.
 *
 * Hosts that want to bound their popovers to their own root install
 * an `InfoPopoverContainerProvider` near the surface root, pointing
 * at the element the overlay should portal into. `<InfoPopover>` reads
 * from the context and threads the value to AntD's `getPopupContainer`
 * prop — popovers then portal inside the surface, can't escape its
 * bounds, and the surface's own scroll never extends because of them.
 *
 * No provider → falls back to body, preserving the historical
 * behaviour for any host that hasn't been migrated yet.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type InfoPopoverContainerResolver = (triggerNode: HTMLElement) => HTMLElement | null;

const InfoPopoverContainerContext = createContext<InfoPopoverContainerResolver | null>(null);

interface ProviderProps {
  /**
   * Imperatively resolves a container DOM element for a given trigger.
   * Receives the trigger element so callers can walk up via `closest`
   * (e.g. find the nearest tab body so a popover in tab A can't bleed
   * into tab B).
   */
  resolver: InfoPopoverContainerResolver;
  children: ReactNode;
}

export function InfoPopoverContainerProvider({ resolver, children }: ProviderProps) {
  // Identity-stable wrapper so consumers don't re-render when callers
  // pass an inline function. Hosts can still pass a fresh function each
  // render — the context value updates, but it's a small graph.
  const value = useMemo<InfoPopoverContainerResolver>(() => resolver, [resolver]);
  return <InfoPopoverContainerContext.Provider value={value}>{children}</InfoPopoverContainerContext.Provider>;
}

/**
 * Read the installed container resolver. `null` when no host provider
 * is mounted — `InfoPopover` then lets AntD use its default (body).
 */
export function useInfoPopoverContainer(): InfoPopoverContainerResolver | null {
  return useContext(InfoPopoverContainerContext);
}
