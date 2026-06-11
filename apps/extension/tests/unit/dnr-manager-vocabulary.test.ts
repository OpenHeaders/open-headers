/**
 * Per-browser resource-type vocabulary pinning.
 *
 * `resourceVocabularyForBrowser` is the orchestrator's per-browser seam:
 * an unknown resource type rejects the entire updateDynamicRules batch
 * atomically, and a missing member silently exempts that traffic class
 * from every rule. These tests pin the browser → vocabulary mapping;
 * the vocabulary CONTENTS are pinned in dnr-resource-types.test.ts.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  BASELINE_RESOURCE_VOCABULARY,
  CHROMIUM_RESOURCE_VOCABULARY,
  FIREFOX_RESOURCE_VOCABULARY,
} from '@openheaders/rule-engine/builders';

interface BrowserFlags {
  isChrome?: boolean;
  isEdge?: boolean;
  isFirefox?: boolean;
}

async function vocabularyUnder(flags: BrowserFlags) {
  vi.resetModules();
  vi.doMock('@utils/browser-api', () => ({
    isChrome: flags.isChrome ?? false,
    isEdge: flags.isEdge ?? false,
    isFirefox: flags.isFirefox ?? false,
    declarativeNetRequest: {
      getDynamicRules: vi.fn(() => Promise.resolve([])),
      updateDynamicRules: vi.fn(() => Promise.resolve()),
      getSessionRules: vi.fn(() => Promise.resolve([])),
      updateSessionRules: vi.fn(() => Promise.resolve()),
    },
    storage: { sync: { get: vi.fn((_k: string[], cb: (r: Record<string, unknown>) => void) => cb({})) } },
  }));
  const mod = await import('@/background/dnr-manager');
  return mod.resourceVocabularyForBrowser();
}

describe('resourceVocabularyForBrowser — per-browser pinning', () => {
  it('Chrome compiles against the Chromium vocabulary', async () => {
    const vocab = await vocabularyUnder({ isChrome: true });
    expect(vocab.all).toEqual(CHROMIUM_RESOURCE_VOCABULARY.all);
  });

  it('Edge compiles against the Chromium vocabulary', async () => {
    const vocab = await vocabularyUnder({ isEdge: true });
    expect(vocab.all).toEqual(CHROMIUM_RESOURCE_VOCABULARY.all);
  });

  it('Firefox compiles against the Gecko vocabulary — never the baseline (its extra traffic classes would go exempt)', async () => {
    const vocab = await vocabularyUnder({ isFirefox: true });
    expect(vocab.all).toEqual(FIREFOX_RESOURCE_VOCABULARY.all);
    expect(vocab.all).toContain('beacon');
    expect(vocab.all).not.toContain('webtransport');
  });

  it('an unverified engine falls back to the cross-browser baseline', async () => {
    const vocab = await vocabularyUnder({});
    expect(vocab.all).toEqual(BASELINE_RESOURCE_VOCABULARY.all);
  });
});
