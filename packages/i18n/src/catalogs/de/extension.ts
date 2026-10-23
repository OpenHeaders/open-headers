/**
 * Extension namespace — German. Mirrors `catalogs/en/extension.ts` key
 * for key; the 'Open Headers' brand prefix rides raw inside the values.
 * Also statically bundled into the service worker via
 * `catalogs/static-extension.ts` — keep this file free of heavy
 * imports.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - Pausiert\nDie Regelausführung ist pausiert',
  'extension.badge.disconnected': 'Open Headers - Getrennt\nDie Desktop-App ist nicht erreichbar',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Aktiv\n${matched} deiner ${plural(locale, Number(configured), {
      one: '{count} Regel',
      other: '{count} Regeln',
    })} passten auf Anfragen dieser Seite`,
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'Der Open-Source-Enterprise-API-Client in deinem Browser. Team-Zusammenarbeit. Browser-Interceptor – Live-Traffic.',
  'extension.manifest.actionDescription': 'Open Headers-Popup öffnen',
} as const satisfies Catalog;
