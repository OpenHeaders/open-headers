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
 *
 * Two sets exist because two description ceilings exist: the store set
 * (`public/_locales`, every browser's dist) under Chrome's limit, and
 * the Safari set (`manifests/safari/_locales`, overlaid on the Safari
 * dist) under App Store Connect's shorter one — the Safari distribution
 * plan §3. Same name, same action description, a shorter sentence.
 */

import {
  createTranslator,
  DEFAULT_LOCALE,
  en,
  LOCALES,
  type MessageKey,
  STATIC_EXTENSION_CATALOGS,
} from '@openheaders/i18n';

/** Chrome rejects a manifest whose `description` runs past this. */
export const MANIFEST_DESCRIPTION_LIMIT = 132;

/** App Store Connect validates the default locale's description at this. */
export const SAFARI_MANIFEST_DESCRIPTION_LIMIT = 112;

/** Which store's ceiling and sentence a `_locales` set carries. */
export type ManifestLocaleTarget = 'store' | 'safari';

export interface LocaleMessages {
  readonly extName: { readonly message: string };
  readonly extDesc: { readonly message: string };
  readonly extActionDesc: { readonly message: string };
}

/** BCP-47 `zh-CN` → the `_locales` directory `zh_CN`; the rest as-is. */
export function localeDirectory(code: string): string {
  return code.replaceAll('-', '_');
}

const DESCRIPTION_KEY: Record<ManifestLocaleTarget, MessageKey> = {
  store: 'extension.manifest.description',
  safari: 'extension.manifest.descriptionSafari',
};

const DESCRIPTION_LIMIT: Record<ManifestLocaleTarget, number> = {
  store: MANIFEST_DESCRIPTION_LIMIT,
  safari: SAFARI_MANIFEST_DESCRIPTION_LIMIT,
};

/** One entry per real locale, keyed by its `_locales` directory. */
export function buildLocaleMessages(target: ManifestLocaleTarget = 'store'): ReadonlyMap<string, LocaleMessages> {
  const out = new Map<string, LocaleMessages>();
  for (const { code, synthetic } of LOCALES) {
    if (synthetic) continue;
    const slice = code === DEFAULT_LOCALE ? en : STATIC_EXTENSION_CATALOGS[code];
    if (slice === undefined) throw new Error(`locale-messages: "${code}" has no static extension catalog`);
    const t = createTranslator(code, slice, en);
    const description = t(DESCRIPTION_KEY[target]);
    const limit = DESCRIPTION_LIMIT[target];
    if (description.length > limit) {
      throw new Error(
        `locale-messages: "${code}" ${target} description is ${description.length} characters — the limit is ${limit}`,
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
