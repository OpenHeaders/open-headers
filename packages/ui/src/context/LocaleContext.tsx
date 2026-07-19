/**
 * LocaleContext — the translation plane for every React surface.
 *
 * Reads `general.language` from the settings store, resolves `auto`
 * against the browser's language preferences, and provides the typed
 * `t()` for that locale plus Ant Design's locale pack via a
 * ConfigProvider (ThemeProvider's inner ConfigProvider inherits it, so
 * mount order is LocaleProvider outside ThemeProvider). Switching
 * language swaps the catalog in place — no reload; other open surfaces
 * follow through the settings store's cross-context sync. Code-split
 * locale catalogs load on demand: English renders for the load tick,
 * then the translator swaps in.
 *
 * The pre-provider default translates through the English catalog, so
 * components render correctly in tests and in trees mounted without
 * the provider.
 *
 * Requires `SettingsProvider` to be mounted above this component.
 */

import {
  DEFAULT_LOCALE,
  getLocaleDef,
  getTranslator,
  isCatalogLoaded,
  loadCatalog,
  type LocaleDirection,
  type MessageArgs,
  type MessageKey,
  resolveLocale,
  type Translator,
} from '@openheaders/i18n';
// Concrete module, not the settings barrel — same chunk-level
// import-cycle constraint as ThemeContext.
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { ConfigProvider } from 'antd';
import type { Locale as AntdLocale } from 'antd/es/locale';
import deDE from 'antd/locale/de_DE';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import frFR from 'antd/locale/fr_FR';
import zhCN from 'antd/locale/zh_CN';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** Typed translation function — keys are checked against the English catalog. */
export type Translate = (key: MessageKey, args?: MessageArgs) => string;

export interface LocaleContextValue {
  /** Resolved locale code (never `auto`). */
  locale: string;
  direction: LocaleDirection;
  t: Translate;
}

// antd ships its own locale packs; each real locale we add maps its
// pack here. Pseudo renders our pseudoized catalog inside English
// component chrome — antd strings are not part of the extraction QA.
const ANTD_LOCALES: Readonly<Record<string, AntdLocale>> = {
  de: deDE,
  en: enUS,
  es: esES,
  fr: frFR,
  'zh-CN': zhCN,
  pseudo: enUS,
};

export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  direction: 'ltr',
  t: getTranslator(DEFAULT_LOCALE),
});

export const useLocale = (): LocaleContextValue => useContext(LocaleContext);

/** The common case — components that only need `t()`. */
export const useT = (): Translate => useContext(LocaleContext).t;

interface LocaleProviderProps {
  children: React.ReactNode;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const language = useSettingValue('general.language');

  const locale = useMemo(() => {
    const preferences = typeof navigator !== 'undefined' ? navigator.languages : [];
    return resolveLocale(language, preferences);
  }, [language]);

  const direction: LocaleDirection = getLocaleDef(locale)?.direction ?? 'ltr';

  // Code-split locales arrive async: English renders during the load
  // tick, then the loaded translator swaps in via this state. English
  // and pseudo (and already-loaded locales) keep the synchronous path.
  const [loadedTranslator, setLoadedTranslator] = useState<Translator>();
  useEffect(() => {
    if (isCatalogLoaded(locale)) return undefined;
    let alive = true;
    loadCatalog(locale).then(
      () => {
        if (alive) setLoadedTranslator(() => getTranslator(locale));
      },
      // A failed chunk load leaves the English fallback in place.
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  const t = loadedTranslator !== undefined && loadedTranslator.locale === locale ? loadedTranslator : getTranslator(locale);

  const value = useMemo<LocaleContextValue>(() => ({ locale, direction, t }), [locale, direction, t]);

  // Mirror the resolved locale onto the document so plain-CSS surfaces
  // and the browser's own behaviors (spellcheck, hyphenation) follow.
  // Pseudo is accented English — announce it as such.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale === 'pseudo' ? 'en' : locale;
    root.dir = direction;
  }, [locale, direction]);

  return (
    <LocaleContext.Provider value={value}>
      <ConfigProvider locale={ANTD_LOCALES[locale] ?? enUS}>{children}</ConfigProvider>
    </LocaleContext.Provider>
  );
};
