/**
 * Surface identity resolvers — Electron desktop host bindings.
 *
 * The host-neutral identity builder lives in
 * `@openheaders/ui/shared/awareness/surface-identity`; this module
 * supplies the platform-specific half. Desktop renders a single
 * workbench window — there are no peer surfaces to navigate to, so
 * `resolveNavigation` stays unwired (the awareness peer-navigator's
 * `desktop-window` kind is reserved for Mode 2/3 transports). Label
 * tracks `document.title` so other surfaces see the same string the
 * user sees on the window title bar.
 */

import {
  buildIdentity,
  observeDocumentTitle,
  type SurfaceIdentityHandle,
} from '@openheaders/ui/shared/awareness/surface-identity';

export function resolveWorkbenchIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'desktop',
    surfaceKind: 'workbench',
    initialLabel,
    observeLabel: observeDocumentTitle,
  });
}
