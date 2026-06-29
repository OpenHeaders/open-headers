/**
 * Extension surfaces' capability registrations. Listed once here;
 * each surface entry (`popup/`, `panel/`, `sidepanel/`) imports this
 * module before mounting.
 *
 * Shared `@openheaders/ui` code reads through
 * `@openheaders/core/capabilities` and never names the host. Anything
 * the extension surfaces don't support (e.g. desktop's
 * `createAdditionalWindow`) is simply absent from this file, and shared
 * code branches off `hasCapability`.
 *
 * `getActiveWorkspaceId` reuses the long-standing `popupOpen` RPC the
 * SW already implements — the response carries the active workspace
 * id alongside the popup-specific fields, and the capability projects
 * just the id so consumers don't depend on popup vocabulary.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import './install-cdp-capability';
import { pairWithCode } from './pair-with-code';

registerCapability('getActiveWorkspaceId', () =>
  hostBridge.call('popupOpen').then((resp) => ({
    activeWorkspaceId: resp.activeWorkspaceId ?? null,
  })),
);

// Kicks the SW into rebroadcasting current state to the just-mounted
// surface. Reuses the SW's existing `popupOpen` handler (also called by
// `getActiveWorkspaceId` above — the SW response carries both pieces).
registerCapability('announceSurfaceReady', () => hostBridge.call('popupOpen').then(() => undefined));

// Nudges the SW to revalidate tracked requests + rebuild DNR after a
// rule mutation. Sync already propagated the data; this is the
// extension-only secondary signal for the out-of-band DNR engine.
registerCapability('notifyRulesChanged', () => hostBridge.call('rulesUpdated').then(() => undefined));

// External links route through the SW's existing `openTab` handler so
// the new tab inherits the user's session / cookies / extension trust.
// Reshape the `{ success, tabId? }` response into the capability's
// `{ ok, error? }` shape.
registerCapability('openExternalUrl', (url) =>
  hostBridge
    .call('openTab', { url })
    .then((resp) => ({ ok: resp.success, error: resp.error }))
    .catch((err: Error) => ({ ok: false, error: err.message })),
);

// Debug mode (opt-in CDP path) is registered by `install-cdp-capability`
// imported above — gated on the runtime exposing the debugging protocol.

// In-app daemon pairing (WS-A2): exchange a typed 6-digit code for an
// auth token over a direct localhost/LAN HTTP fetch. Unlike the caps
// above it doesn't relay through the SW — a one-shot pairing fetch needs
// none of the SW's privileged powers, and the caller writes the token to
// `backend.authToken`, which the SW reacts to and connects.
registerCapability('pairWithCode', pairWithCode);
