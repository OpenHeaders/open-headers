/**
 * Firefox implementation of ViewModeAdapter.
 *
 * Firefox exposes both extension surfaces natively at all times:
 *
 *   - the toolbar `action` icon opens the popup (manifest `default_popup`);
 *   - Firefox automatically pins the extension's sidebar in its sidebar
 *     rail when the manifest declares `sidebar_action`, and the user
 *     toggles the sidebar from that rail icon.
 *
 * Both controls are always visible and always functional. There is no
 * cross-surface "view mode" to toggle on Firefox — the user picks the
 * surface they want by clicking the corresponding icon.
 *
 * Implications for this adapter:
 *
 *   - `bindToolbarForMode` is a no-op. The manifest's `default_popup`
 *     is the toolbar binding; runtime `setPopup({popup:''})` doesn't
 *     reliably override it AND Firefox suppresses `action.onClicked`
 *     while `sidebar_action` is declared, so the Chromium "toolbar
 *     toggles the sidebar" pattern is not available.
 *   - `openFromRenderer('sidepanel')` is the live path used by the
 *     in-app "open sidebar" affordance. It's the only API that requires
 *     a fresh user gesture in the renderer's own click handler.
 *   - Everything else is a no-op. SW-side ops can't carry gesture; the
 *     sidebar's `close()` requires gesture even from its own scripts
 *     (Firefox-specific restriction); Chrome-style toolbar rebinding
 *     does not apply.
 */

import type { ViewMode } from '@openheaders/core/types';
import type { OpenContext, OpenResult, Surface, ViewModeAdapter } from './adapter';

interface SidebarActionLike {
  open?: () => Promise<void>;
  close?: () => Promise<void>;
  isOpen?: (options: { windowId?: number }) => Promise<boolean>;
}

declare const browser: typeof chrome | undefined;

function getSidebarAction(): SidebarActionLike | null {
  const root = typeof browser !== 'undefined' ? browser : chrome;
  const api = root as unknown as { sidebarAction?: SidebarActionLike };
  return api.sidebarAction ?? null;
}

export const firefoxViewModeAdapter: ViewModeAdapter = {
  async bindToolbarForMode(_mode: ViewMode): Promise<void> {
    // No-op. The manifest's `default_popup` permanently binds the
    // toolbar to the popup, and Firefox's sidebar rail icon handles
    // the sidebar toggle without any runtime configuration.
  },

  async openFromRenderer(surface: Surface): Promise<OpenResult> {
    if (surface !== 'sidepanel') return { opened: false };
    const sidebar = getSidebarAction();
    if (!sidebar?.open) return { opened: false };
    try {
      // Must be the first awaited call after the user gesture; the
      // caller invokes this synchronously inside the click handler.
      await sidebar.open();
      return { opened: true };
    } catch {
      return { opened: false };
    }
  },

  async closeFromRenderer(surface: Surface): Promise<void> {
    if (surface !== 'sidepanel') return;
    const sidebar = getSidebarAction();
    if (!sidebar?.close) return;
    try {
      // Called from the renderer's click handler — that's the gesture
      // context Firefox requires for `sidebarAction.close()` from the
      // sidebar's own scripts. The caller (install-navigation-host)
      // invokes this synchronously after openFromRenderer in the same
      // task, so the gesture is still live here.
      await sidebar.close();
    } catch {
      // No-gesture callers (e.g. SW-initiated reconciles) hit the
      // Firefox "may only be called from a user input handler"
      // restriction. Benign — only true callers from a click handler
      // succeed; everything else is a best-effort no-op.
    }
  },

  async openFromSW(_surface: Surface, _ctx: OpenContext): Promise<OpenResult> {
    return { opened: false };
  },

  async closeFromSW(_surface: Surface, _ctx: OpenContext): Promise<void> {
    // No-op.
  },

  async surfaceIsOpen(surface: Surface, ctx: OpenContext): Promise<boolean | null> {
    if (surface !== 'sidepanel') return null;
    const sidebar = getSidebarAction();
    if (!sidebar?.isOpen) return null;
    try {
      return await sidebar.isOpen(ctx.windowId != null ? { windowId: ctx.windowId } : {});
    } catch {
      return null;
    }
  },
};
