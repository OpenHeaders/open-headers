/**
 * Extension host wiring for the durable install identity
 * (`TELEMETRY_PLAN.md` §4, amended 2026-07-16): the distribution
 * channel is a static browser-flavor fact, the uninstall URL carries
 * the install id plus the coarse age bucket and channel (S16) and
 * clears with the identity, and the install store on
 * `chrome.storage.local` keeps the identity record and the first_run
 * sent-bit under separate keys so a toggle-off wipe never re-announces
 * the install.
 */

import { PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT } from '@openheaders/core/telemetry';
import { describe, expect, it, vi } from 'vitest';

const INSTALL_ID = 'feedface00feedface00feedface0000';
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadModule() {
  return import('../../src/background/modules/product-telemetry');
}

describe('uninstallUrlFor', () => {
  it('targets the published uninstall route with the id plus the coarse age and channel context', async () => {
    const { uninstallUrlFor } = await loadModule();
    const url = uninstallUrlFor({ installId: INSTALL_ID, installedAt: Date.now() - 3 * DAY_MS });
    expect(url).toBe(`${PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT}?i=${INSTALL_ID}&a=2-7&c=dev`);
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

describe('buildEnvelopeFacts', () => {
  it('assembles the per-process envelope facts from static build and platform reads (plan §3, S15)', async () => {
    const { buildEnvelopeFacts } = await loadModule();
    const facts = await buildEnvelopeFacts();
    expect(facts.channel).toBe('dev');
    expect(facts.appVersion).toEqual({ year: 4, month: 0, patch: 0 });
    expect(facts.platform).toBe('mac');
    // The test runtime's UA carries no engine token, so detection
    // honestly reads other rather than guessing.
    expect(facts.browser).toBe('other');
    // The settings store is not hydrated in this rig, so resolution
    // falls back to `auto` over the runtime's preference list — the
    // mapped result must still be a vocabulary member.
    expect(facts.locale).toBe('en');
  });

  it('omits the platform fact on an os outside the vocabulary', async () => {
    const { buildEnvelopeFacts } = await loadModule();
    (chrome.runtime.getPlatformInfo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      os: 'cros',
      arch: 'arm64',
      nacl_arch: 'arm',
    });
    const facts = await buildEnvelopeFacts();
    expect('platform' in facts).toBe(false);
  });
});
