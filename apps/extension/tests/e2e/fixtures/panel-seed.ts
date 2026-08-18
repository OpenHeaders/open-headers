/**
 * Storage seed for panel-driving e2e specs:
 *
 * - `onboardingCompleted` / `panelOnboardingCompleted` — the popup and
 *   panel tours auto-show on fresh profiles and their modal masks
 *   swallow every click until dismissed.
 * - `inspection.cdpEnabled` — the debugging-protocol master switch
 *   defaults OFF (the attach must be an explicit user choice); specs
 *   that pin tabs via `setCdpTabPin` opt in through the persisted
 *   user-settings dict, the same write any settings surface makes.
 *
 * After writing, the extension is RESTARTED and the fresh service
 * worker returned: a write racing the just-booted SW's settings-store
 * init (after its initial read, before its `storage.onChanged`
 * subscription) would otherwise be lost, leaving the master switch
 * off. The reboot makes every consumer read the persisted flags at
 * boot — the same shape as a real, previously-configured profile.
 */

import type { BrowserContext, Worker } from '@playwright/test';

export async function seedPanelDebugFlags(context: BrowserContext): Promise<Worker> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            onboardingCompleted: true,
            panelOnboardingCompleted: true,
            'oh.settings.user': { 'inspection.cdpEnabled': true },
          },
          () => resolve(),
        );
      }),
  );
  const reloaded = context.waitForEvent('serviceworker', { timeout: 15000 });
  await worker.evaluate(() => {
    setTimeout(() => chrome.runtime.reload(), 20);
  });
  return reloaded;
}
