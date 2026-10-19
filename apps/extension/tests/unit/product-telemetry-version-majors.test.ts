/**
 * The envelope's coarse version majors on the extension (S35): the
 * browser major off the UA string by engine, the OS major off the
 * Client Hints `platformVersion` where Chromium exposes it — and
 * nothing where a read would be a guess.
 */

import { beforeEach, describe, expect, it, type vi } from 'vitest';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

interface UaStub {
  userAgent: string;
  userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }> };
}

function stubNavigator(stub: UaStub): void {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US', languages: ['en-US'], ...stub },
    configurable: true,
  });
}

function stubPlatform(os: string): void {
  (chrome.runtime.getPlatformInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
    os,
    arch: 'x86-64',
    nacl_arch: 'x86-64',
  });
}

async function facts() {
  const { buildEnvelopeFacts } = await import('../../src/background/modules/product-telemetry');
  return buildEnvelopeFacts();
}

beforeEach(() => {
  stubPlatform('win');
});

describe('buildEnvelopeFacts — version majors', () => {
  it('stamps the browser major off the UA and Windows 11 off a Client Hints platformVersion of 13 or more', async () => {
    stubNavigator({
      userAgent: CHROME_UA,
      userAgentData: { getHighEntropyValues: async () => ({ platformVersion: '15.0.0' }) },
    });
    const envelope = await facts();
    expect(envelope.browserVersion).toBe(130);
    expect(envelope.osVersion).toBe(11);
  });

  it('reads Windows 10 below 13 and the macOS major as given', async () => {
    stubNavigator({
      userAgent: CHROME_UA,
      userAgentData: { getHighEntropyValues: async () => ({ platformVersion: '10.0.0' }) },
    });
    expect((await facts()).osVersion).toBe(10);
    stubPlatform('mac');
    stubNavigator({
      userAgent: CHROME_UA,
      userAgentData: { getHighEntropyValues: async () => ({ platformVersion: '15.1.0' }) },
    });
    expect((await facts()).osVersion).toBe(15);
  });

  it('leaves the OS unstamped without Client Hints (Firefox, Safari), on Linux, and when the hint read fails', async () => {
    stubNavigator({ userAgent: CHROME_UA });
    expect('osVersion' in (await facts())).toBe(false);
    stubNavigator({
      userAgent: CHROME_UA,
      userAgentData: {
        getHighEntropyValues: async () => {
          throw new Error('denied');
        },
      },
    });
    expect('osVersion' in (await facts())).toBe(false);
    stubPlatform('linux');
    stubNavigator({
      userAgent: CHROME_UA,
      userAgentData: { getHighEntropyValues: async () => ({ platformVersion: '6.8.0' }) },
    });
    expect('osVersion' in (await facts())).toBe(false);
  });

  it('leaves the browser major unstamped when the UA carries no engine token for the detected kind', async () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (openheaders.io probe)' });
    const envelope = await facts();
    expect('browserVersion' in envelope).toBe(false);
    expect(envelope.browser).toBe('other');
  });
});
