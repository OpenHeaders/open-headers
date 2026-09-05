/**
 * Firefox distribution-channel attribution: AMO builds carry no
 * `update_url`, so the manifest marker cannot separate a temporary
 * add-on from a store install — `management.getSelf().installType` is
 * the only development fact on that engine.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/browser-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@utils/browser-api')>()),
  isFirefox: true,
  isEdge: false,
  isSafari: false,
}));

async function loadModule() {
  return import('../../src/background/modules/product-telemetry');
}

describe('detectDistributionChannel on Firefox', () => {
  it('reports firefox-amo for a normal install (no update_url on AMO builds)', async () => {
    const { detectDistributionChannel, resolveInstallType } = await loadModule();
    await resolveInstallType();
    expect(detectDistributionChannel()).toBe('firefox-amo');
  });

  it('reports dev for a temporary add-on (development install type)', async () => {
    const { detectDistributionChannel, resolveInstallType } = await loadModule();
    (chrome.management.getSelf as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'test-id',
      installType: 'development',
    });
    await resolveInstallType();
    expect(detectDistributionChannel()).toBe('dev');
  });
});
