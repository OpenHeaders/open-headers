/**
 * Awareness publisher hook — surface-coordinated.
 *
 * This hook does NOT publish to the SW directly and does NOT own any
 * port. It registers a slot with the surface's
 * {@link AwarenessCoordinator} (lives next to the identity in the
 * provider) and updates that slot whenever the editor's focus / dirty
 * state changes. The coordinator picks the most-recently-active slot
 * across all editors mounted in the surface and is the sole publisher
 * to the SW.
 *
 * Why coordinator-mediated: a surface's awareness row in the SW is a
 * single record. Multiple editors mounted concurrently in one
 * workbench page (dock layout) would race on last-write-wins if they
 * each published independently, and an unmounting editor would leave
 * its stale claim behind (other surfaces' badges would keep counting
 * it). The coordinator gives the surface a single voice.
 *
 * Sensitive entities (§14.4): the SW scrubs `fieldFocus` for sensitive
 * types at the boundary, so surfaces don't need to special-case Vault
 * / OAuth themselves.
 */

import { useEffect, useRef } from 'react';
import { useAwarenessCoordinator } from '../awareness/IdentityContext';
import type { SurfaceIdentityHandle } from '../awareness/surface-identity';
import { useTabActive } from '../awareness/TabActiveContext';

export interface UseAwarenessOptions {
  workspaceId: string | null;
  /** Identity envelope for this surface — built once at mount via the
   *  per-surface resolver. */
  identity: SurfaceIdentityHandle;
  entityFocus: { type: string; id: string } | null;
  fieldFocus: { type: string; id: string; path: string } | null;
  dirtyFields: string[];
  /**
   * Pause the publisher (the surface is unmounted / hidden / paused).
   * Defaults to true. When false the hook neither registers a slot
   * nor updates it; the coordinator advertises whatever the other
   * (still-enabled) editors are claiming.
   */
  enabled?: boolean;
  /**
   * Raw descriptive context this surface should advertise (viewers
   * compose it with their own translation of the surface kind).
   * Updates propagate via the coordinator's context-change
   * subscription. Optional: omitted leaves whatever the resolver
   * minted in place (typically `document.title`).
   */
  context?: string;
}

export function useAwareness(opts: UseAwarenessOptions): void {
  // The surface should claim presence on an entity ONLY when the
  // user is actively viewing that editor — i.e. when this part of
  // the React tree sits in the dock-layout's active tab. Inside a
  // hidden tab pane (`display: none`), the editor is mounted but the
  // user has switched away; its claim should not contribute to other
  // surfaces' badge counts. The `useTabActive()` context defaults to
  // `true` outside any TabPanel ancestor, which is the right default
  // for surfaces without inner tabs (popup, sidepanel, devpanel).
  const tabActive = useTabActive();
  const enabled = opts.enabled !== false && tabActive;
  const coordinator = useAwarenessCoordinator();

  // Optional manual context override. The default context source is
  // live (document.title for own-tab surfaces, the host-resolved
  // inspected tab for DevTools panels).
  if (opts.context !== undefined) {
    opts.identity.setContext(opts.context);
  }

  // Track the slot across renders; we only register/unregister on
  // mount-or-disable changes, and just `update()` on field changes.
  const slotRef = useRef<ReturnType<typeof coordinator.register> | null>(null);

  useEffect(() => {
    if (!enabled || !opts.workspaceId) {
      slotRef.current?.unregister();
      slotRef.current = null;
      return;
    }
    const slot = coordinator.register({
      workspaceId: opts.workspaceId,
      entityFocus: opts.entityFocus,
      fieldFocus: opts.fieldFocus,
      dirtyFields: opts.dirtyFields,
    });
    slotRef.current = slot;
    return () => {
      slot.unregister();
      slotRef.current = null;
    };
    // Register/unregister on enable + workspace boundary; field
    // changes flow through the separate `update()` effect below.
  }, [enabled, opts.workspaceId, coordinator]);

  useEffect(() => {
    if (!enabled || !opts.workspaceId) return;
    slotRef.current?.update({
      workspaceId: opts.workspaceId,
      entityFocus: opts.entityFocus,
      fieldFocus: opts.fieldFocus,
      dirtyFields: opts.dirtyFields,
    });
  }, [
    enabled,
    opts.workspaceId,
    opts.entityFocus?.type,
    opts.entityFocus?.id,
    opts.fieldFocus?.type,
    opts.fieldFocus?.id,
    opts.fieldFocus?.path,
    opts.dirtyFields.join('\x1f'),
  ]);
}
