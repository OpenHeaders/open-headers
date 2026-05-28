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

registerCapability('getActiveWorkspaceId', () =>
  hostBridge.call('popupOpen').then((resp) => ({
    activeWorkspaceId: resp.activeWorkspaceId ?? null,
  })),
);
