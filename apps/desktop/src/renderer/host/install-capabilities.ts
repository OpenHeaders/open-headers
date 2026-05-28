/**
 * Desktop renderer's capability registrations. Lists every
 * capability the desktop shell supports and wires it to the
 * appropriate transport (engine RPC, preload bridge, IPC channel).
 *
 * Shared `@openheaders/ui` code reads through
 * `@openheaders/core/capabilities` and never knows which shell answered.
 * Capabilities the desktop doesn't support (e.g. `popupAnnounce` once it
 * lands) simply aren't registered here, and shared code branches off
 * `hasCapability`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';

registerCapability('getActiveWorkspaceId', () =>
  hostBridge.call('getActiveWorkspaceId'),
);
