/**
 * CSP-exempt injection capability registration.
 *
 * Side-effect module: importing it registers the `cspExemptInjection`
 * capability when — and only when — the manifest declares the
 * `userScripts` permission (Chrome / Edge builds). The probe relays to
 * the SW, which answers from `canExecuteCspExempt()` — whether the
 * browser's per-extension "Allow user scripts" toggle is on right now.
 * Firefox / Safari manifests don't carry the permission (no such
 * toggle exists there), so the capability stays absent and the rule
 * editor's degraded-bypassCSP hint never renders a setting the user
 * can't reach.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { getBrowserAPI } from '@/types/browser';

if (getBrowserAPI().runtime.getManifest().permissions?.includes('userScripts')) {
  registerCapability('cspExemptInjection', () =>
    hostBridge.call('getCspExemptInjection').then((resp) => resp.available),
  );
}
