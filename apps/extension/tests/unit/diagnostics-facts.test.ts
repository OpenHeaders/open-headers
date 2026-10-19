/**
 * The service worker's diagnostic facts (the error reports plan §4.5):
 * the usage envelope's build and browser facts plus the extension's own
 * — manifest version, storage in use, installed rule counts — each
 * optional read guarded on its own so an engine without the API leaves
 * the field out.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnvelope, mockDynamic, mockSession } = vi.hoisted(() => ({
  mockEnvelope: vi.fn(async () => ({
    channel: 'chrome-store',
    appVersion: { year: 2026, month: 10, patch: 1, beta: 0 },
    locale: 'en',
    platform: 'mac',
    arch: 'arm64',
    osVersion: 26,
    browser: 'chrome',
    browserVersion: 144,
  })),
  mockDynamic: vi.fn(async () => [{ id: 1 }, { id: 2 }, { id: 3 }]),
  mockSession: vi.fn(async () => [{ id: 9 }]),
}));

vi.mock('@/background/modules/product-telemetry', () => ({ buildEnvelopeFacts: mockEnvelope }));
vi.mock('@utils/browser-api', () => ({
  runtime: { getManifest: () => ({ version: '2026.10.1', manifest_version: 3 }) },
  declarativeNetRequest: { getDynamicRules: mockDynamic, getSessionRules: mockSession },
}));

import { buildExtensionDiagnosticsFacts } from '@/background/modules/diagnostics-facts';

const localArea = chrome.storage.local as unknown as { getBytesInUse?: () => Promise<number> };

beforeEach(() => {
  mockDynamic.mockClear();
  mockSession.mockClear();
  localArea.getBytesInUse = vi.fn(async () => 4096);
});

describe('buildExtensionDiagnosticsFacts', () => {
  it('names the build, the browser, the platform and the extension counts', async () => {
    const facts = await buildExtensionDiagnosticsFacts();
    expect(facts).toMatchObject({
      host: 'extension',
      appVersion: '2026.10.1',
      channel: 'chrome-store',
      locale: 'en',
      platform: 'mac',
      arch: 'arm64',
      osVersion: '26',
      browser: 'chrome',
      browserVersion: 144,
      manifestVersion: 3,
      storageBytesInUse: 4096,
      dynamicRules: 3,
      sessionRules: 1,
    });
    expect(facts.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(facts.collectedAt).toBeGreaterThan(0);
  });

  it('leaves out what an engine cannot answer and still answers', async () => {
    localArea.getBytesInUse = undefined;
    mockSession.mockRejectedValueOnce(new Error('no session rules here'));
    const facts = await buildExtensionDiagnosticsFacts();
    expect(facts).not.toHaveProperty('storageBytesInUse');
    expect(facts).not.toHaveProperty('sessionRules');
    expect(facts.dynamicRules).toBe(3);
  });
});
