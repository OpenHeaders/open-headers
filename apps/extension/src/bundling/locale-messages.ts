/**
 * `_locales/<dir>/messages.json` content — the manifest plane's
 * translations. The manifest's `__MSG_*__` placeholders render in
 * browser chrome (the store listing, the toolbar, the shortcuts page),
 * so they follow the BROWSER UI locale through `chrome.i18n`, never the
 * settings picker. Every real locale's file derives at build time from
 * the catalogs' `extension.manifest.*` family — the same statically
 * bundled slices the service worker's badge reads — so a language that
 * ships in the app ships on the store in the same commit, with no
 * hand-kept file per language to drift.
 */

import { createTranslator, DEFAULT_LOCALE, en, LOCALES, STATIC_EXTENSION_CATALOGS } from '@openheaders/i18n';

/** Chrome rejects a manifest whose `description` runs past this. */
export const MANIFEST_DESCRIPTION_LIMIT = 132;

export interface LocaleMessages {
  readonly extName: { readonly message: string };
  readonly extDesc: { readonly message: string };
  readonly extActionDesc: { readonly message: string };
}

/** BCP-47 `zh-CN` → the `_locales` directory `zh_CN`; the rest as-is. */
export function localeDirectory(code: string): string {
  return code.replaceAll('-', '_');
}

/** One entry per real locale, keyed by its `_locales` directory. */
export function buildLocaleMessages(): ReadonlyMap<string, LocaleMessages> {
  const out = new Map<string, LocaleMessages>();
  for (const { code, synthetic } of LOCALES) {
    if (synthetic) continue;
    const slice = code === DEFAULT_LOCALE ? en : STATIC_EXTENSION_CATALOGS[code];
    if (slice === undefined) throw new Error(`locale-messages: "${code}" has no static extension catalog`);
    const t = createTranslator(code, slice, en);
    const description = t('extension.manifest.description');
    if (description.length > MANIFEST_DESCRIPTION_LIMIT) {
      throw new Error(
        `locale-messages: "${code}" description is ${description.length} characters — the store limit is ${MANIFEST_DESCRIPTION_LIMIT}`,
      );
    }
    out.set(localeDirectory(code), {
      extName: { message: t('extension.manifest.name') },
      extDesc: { message: description },
      extActionDesc: { message: t('extension.manifest.actionDescription') },
    });
  }
  return out;
}
