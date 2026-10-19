/**
 * The root error fallback's appearance — resolved synchronously, with
 * no provider above it (the crash-and-error-reports plan §3.2: the
 * fallback depends on nothing that could have crashed).
 *
 * The appearance settings are plain module state of the settings store
 * (`get` reads them without React), the system preference is a media
 * query, and the variant registry is static — so the fallback resolves
 * the SAME theme the provider would, through the shared `buildAntTheme`.
 * Should the store itself be unreachable (an entry without the settings
 * schema), the document element's `data-theme` — mirrored there by the
 * provider and by the host's pre-mount script — and then the system
 * preference decide dark or light, with the default variant. Nothing
 * here throws: a theme that fails inside the failure path would hide
 * the page.
 */

import { buildAntTheme, getVariant } from '@openheaders/ui/themes';
import { resolveAppearanceFontFamily } from '@openheaders/ui/workbench/settings/schema/appearance';
import { get } from '@openheaders/ui/workbench/settings/store';
import type { ThemeConfig } from 'antd';

export interface RootFallbackTheme {
  isDarkMode: boolean;
  antTheme: ThemeConfig;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The scheme the document already wears, or null when nothing set it. */
function documentScheme(): 'dark' | 'light' | null {
  if (typeof document === 'undefined') return null;
  const scheme = document.documentElement.getAttribute('data-theme');
  return scheme === 'dark' || scheme === 'light' ? scheme : null;
}

function fromSettings(): RootFallbackTheme {
  const themeMode = get('appearance.theme');
  const isDarkMode = themeMode === 'dark' || (themeMode === 'auto' && systemPrefersDark());
  const variant = getVariant(
    isDarkMode ? 'dark' : 'light',
    isDarkMode ? get('appearance.darkVariant') : get('appearance.lightVariant'),
  );
  return {
    isDarkMode,
    antTheme: buildAntTheme({
      variant,
      isDarkMode,
      isCompactMode: get('appearance.density') === 'compact',
      accentColor: get('appearance.accentColor'),
      uiScale: get('appearance.uiScale'),
      fontFamily: resolveAppearanceFontFamily(get('appearance.fontFamilyPreset')),
    }),
  };
}

function fromDocument(): RootFallbackTheme {
  const isDarkMode = (documentScheme() ?? (systemPrefersDark() ? 'dark' : 'light')) === 'dark';
  const variant = getVariant(isDarkMode ? 'dark' : 'light', '');
  return {
    isDarkMode,
    antTheme: buildAntTheme({
      variant,
      isDarkMode,
      isCompactMode: false,
      accentColor: variant.antdTokens.colorPrimary ?? '#0071e3',
      uiScale: 1,
      fontFamily: resolveAppearanceFontFamily('system'),
    }),
  };
}

export function resolveRootFallbackTheme(): RootFallbackTheme {
  try {
    return fromSettings();
  } catch {
    return fromDocument();
  }
}
