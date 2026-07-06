/**
 * CSP-exempt injection path (bypassCSP → chrome.userScripts).
 *
 * A `<script>` tag runs under the page CSP, so a strict header CSP or a
 * `<meta http-equiv>` CSP blocks a bypassCSP inject rule's own code. The
 * userScripts path has the browser execute the string itself, exempt
 * from page CSP. Pins:
 *
 *   - canExecuteCspExempt reflects whether chrome.userScripts.execute is
 *     present (permission granted + user-scripts toggle on);
 *   - injectScriptCspExempt runs the code in MAIN world via userScripts,
 *     honouring the position → injectImmediately mapping;
 *   - it throws (rather than silently no-op) when the API is absent, so a
 *     missing availability gate surfaces loudly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { canExecuteCspExempt, injectScriptCspExempt } from '@openheaders/rule-engine/inject';

/** Set (or clear) chrome.userScripts.execute without fighting the ambient
 *  @types/chrome shape — the runtime only reads `.execute`. */
function setUserScripts(execute: ((...args: unknown[]) => Promise<unknown>) | undefined): void {
  (chrome as unknown as Record<string, unknown>).userScripts = execute ? { execute } : undefined;
}

afterEach(() => {
  setUserScripts(undefined);
});

describe('canExecuteCspExempt', () => {
  it('is false when chrome.userScripts is absent', () => {
    setUserScripts(undefined);
    expect(canExecuteCspExempt()).toBe(false);
  });

  it('is false when execute is missing (permission without toggle)', () => {
    (chrome as unknown as Record<string, unknown>).userScripts = {};
    expect(canExecuteCspExempt()).toBe(false);
  });

  it('is true when userScripts.execute is available', () => {
    setUserScripts(vi.fn());
    expect(canExecuteCspExempt()).toBe(true);
  });
});

describe('injectScriptCspExempt', () => {
  it('executes the code in MAIN world, immediate for head position', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    setUserScripts(execute);
    await injectScriptCspExempt(9, 'window.__x = 1;', 'head');
    expect(execute).toHaveBeenCalledWith({
      target: { tabId: 9 },
      js: [{ code: 'window.__x = 1;' }],
      world: 'MAIN',
      injectImmediately: true,
    });
  });

  it('defers (injectImmediately false) for body-end position', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    setUserScripts(execute);
    await injectScriptCspExempt(3, 'void 0;', 'body-end');
    expect(execute.mock.calls[0]![0]).toMatchObject({ injectImmediately: false });
  });

  it('throws when the API is unavailable (caller must gate)', async () => {
    setUserScripts(undefined);
    await expect(injectScriptCspExempt(1, 'x', 'head')).rejects.toThrow('userScripts.execute unavailable');
  });
});
