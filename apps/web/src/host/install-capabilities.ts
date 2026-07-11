/**
 * Web host capability registrations. Shared `@openheaders/ui` code
 * reads through `@openheaders/core/capabilities` and never knows which
 * shell answered. Anything a plain tab can't do (CDP, surface
 * self-close, DNR nudges) simply isn't registered here, and shared
 * code branches off `hasCapability`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { signOutWeb } from './sign-out';

registerCapability('getActiveWorkspaceId', () => hostBridge.call('getActiveWorkspaceId'));

// External links open a plain new tab; the browser owns session trust.
registerCapability('openExternalUrl', (url) => {
  window.open(url, '_blank', 'noopener');
  return Promise.resolve({ ok: true });
});

// The web tab owns an origin-scoped daemon session it can drop on its
// own — surfaced as the settings-menu "Sign out" item.
registerCapability('signOut', () => {
  void signOutWeb();
});
