/**
 * Extension host wiring for the durable install identity
 * (`TELEMETRY_PLAN.md` §4, amended 2026-07-16): the distribution
 * channel is a static browser-flavor fact, the uninstall URL carries
 * only the install id (and clears with it), and the install store on
 * `chrome.storage.local` keeps the identity record and the first_run
 * sent-bit under separate keys so a toggle-off wipe never re-announces
 * the install.
 */

import { PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT } from '@openheaders/core/telemetry';
import { describe, expect, it, vi } from 'vitest';

const INSTALL_ID = 'feedface00feedface00feedface0000';

async function loadModule() {
  return import('../../src/background/modules/product-telemetry');
}

describe('uninstallUrlFor', () => {
  it('targets the published uninstall route with only the install id', async () => {
    const { uninstallUrlFor } = await loadModule();
    expect(uninstallUrlFor(INSTALL_ID)).toBe(`${PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT}?i=${INSTALL_ID}`);
  });

  it('clears to the empty string when no identity exists', async () => {
    const { uninstallUrlFor } = await loadModule();
    expect(uninstallUrlFor(null)).toBe('');
  });
});

describe('detectDistributionChannel', () => {
  it('reports dev for an unpacked load — no update_url in the manifest (the default test flavor)', async () => {
    const { detectDistributionChannel } = await loadModule();
    expect(detectDistributionChannel()).toBe('dev');
  });

  it('reports the chrome store for a store-delivered build (update_url present)', async () => {
    const { detectDistributionChannel } = await loadModule();
    vi.mocked(chrome.runtime.getManifest).mockReturnValueOnce({
      manifest_version: 3,
      name: 'Open Headers',
      version: '4.0.0',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    expect(detectDistributionChannel()).toBe('chrome-store');
  });
});
