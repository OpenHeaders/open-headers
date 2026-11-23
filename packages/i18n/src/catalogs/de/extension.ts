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
  'extension.toolbarMenu.openWorkspace': 'Arbeitsbereich öffnen',
  'extension.toolbarMenu.settings': 'Einstellungen',
  'extension.toolbarMenu.pauseRules': 'Regeln pausieren',
  'extension.toolbarMenu.resumeRules': 'Regeln fortsetzen',
  'extension.toolbarMenu.notifications': 'Benachrichtigungen',
  'extension.toolbarMenu.help': 'Hilfe',
  'extension.toolbarMenu.documentation': 'Dokumentation',
  'extension.toolbarMenu.whatsNew': 'Neuigkeiten',
  'extension.toolbarMenu.reportProblem': 'Problem melden',
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'Der Open-Source-Enterprise-API-Client in deinem Browser. Team-Zusammenarbeit. Browser-Interceptor – Live-Traffic ändern.',
  'extension.manifest.descriptionSafari':
    'Open-Source-Enterprise-API-Client in deinem Browser. Team-Zusammenarbeit. Browser-Interceptor – Traffic ändern.',
  'extension.manifest.actionDescription': 'Open Headers-Popup öffnen',
} as const satisfies Catalog;
