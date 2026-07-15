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
import { describe, expect, it } from 'vitest';

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
  it('reports the chrome store for the default test flavor', async () => {
    const { detectDistributionChannel } = await loadModule();
    expect(detectDistributionChannel()).toBe('chrome-store');
  });
});
