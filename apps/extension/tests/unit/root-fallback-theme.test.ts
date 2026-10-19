// @vitest-environment jsdom
/**
 * The root error fallback's appearance, resolved with no provider: the
 * settings store decides (dark, light, or auto through the system
 * preference) and the shared builder produces the same config the
 * theme provider would; when the store cannot answer, the document's
 * scheme attribute decides, then the system preference.
 */

import '@openheaders/ui/workbench/settings';
import { resolveRootFallbackTheme } from '@openheaders/ui/components/root-fallback-theme';
import { set } from '@openheaders/ui/workbench/settings/store';
import { theme } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ storeBroken: false }));

vi.mock('@openheaders/ui/workbench/settings/store', async (importOriginal) => {
  const original = await importOriginal<typeof import('@openheaders/ui/workbench/settings/store')>();
  return {
    ...original,
    get: (key: Parameters<typeof original.get>[0]) => {
      if (flags.storeBroken) throw new Error('no settings here');
      return original.get(key);
    },
  };
});

let prefersDark = false;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  flags.storeBroken = false;
  prefersDark = false;
  document.documentElement.removeAttribute('data-theme');
});

const firstAlgorithm = (config: ReturnType<typeof resolveRootFallbackTheme>['antTheme']) =>
  Array.isArray(config.algorithm) ? config.algorithm[0] : config.algorithm;

describe('root fallback theme', () => {
  it('reads the settings: dark wears the dark algorithm, light the default one', () => {
    set('appearance.theme', 'dark');
    const dark = resolveRootFallbackTheme();
    expect(dark.isDarkMode).toBe(true);
    expect(firstAlgorithm(dark.antTheme)).toBe(theme.darkAlgorithm);
    set('appearance.theme', 'light');
    const light = resolveRootFallbackTheme();
    expect(light.isDarkMode).toBe(false);
    expect(firstAlgorithm(light.antTheme)).toBe(theme.defaultAlgorithm);
  });

  it('auto follows the system preference', () => {
    set('appearance.theme', 'auto');
    prefersDark = true;
    expect(resolveRootFallbackTheme().isDarkMode).toBe(true);
    prefersDark = false;
    expect(resolveRootFallbackTheme().isDarkMode).toBe(false);
  });

  it('without a store, the document scheme decides, then the system preference', () => {
    flags.storeBroken = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(resolveRootFallbackTheme().isDarkMode).toBe(true);
    document.documentElement.removeAttribute('data-theme');
    prefersDark = true;
    expect(resolveRootFallbackTheme().isDarkMode).toBe(true);
    prefersDark = false;
    expect(resolveRootFallbackTheme().isDarkMode).toBe(false);
  });
});
