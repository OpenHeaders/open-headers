/**
 * Surface identity resolvers — web host bindings.
 *
 * The host-neutral identity builder lives in
 * `@openheaders/ui/shared/awareness/surface-identity`; this module
 * supplies the platform-specific half. The web app renders one
 * Workbench per tab; label tracks `document.title` so peer surfaces
 * see the same string as the browser tab strip.
 */

import {
  buildIdentity,
  observeDocumentTitle,
  type SurfaceIdentityHandle,
} from '@openheaders/ui/shared/awareness/surface-identity';

export function resolveWorkbenchIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'web',
    surfaceKind: 'workbench',
    initialLabel,
    observeLabel: observeDocumentTitle,
  });
}
