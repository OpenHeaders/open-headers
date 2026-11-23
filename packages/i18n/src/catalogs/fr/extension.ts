/**
 * Extension namespace — French. Mirrors `catalogs/en/extension.ts` key
 * for key; the 'Open Headers' brand prefix rides raw inside the values.
 * Also statically bundled into the service worker via
 * `catalogs/static-extension.ts` — keep this file free of heavy
 * imports.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': "Open Headers - Suspendu\nL'exécution des règles est suspendue",
  'extension.badge.disconnected': "Open Headers - Déconnecté\nImpossible de joindre l'application de bureau",
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Actif\n${matched} de vos ${plural(locale, Number(configured), {
      one: '{count} règle',
      many: '{count} règles',
      other: '{count} règles',
    })} ont correspondu à des requêtes sur cette page`,
  'extension.toolbarMenu.openWorkspace': "Ouvrir l'espace de travail",
  'extension.toolbarMenu.settings': 'Paramètres',
  'extension.toolbarMenu.pauseRules': 'Mettre les règles en pause',
  'extension.toolbarMenu.resumeRules': 'Reprendre les règles',
  'extension.toolbarMenu.notifications': 'Notifications',
  'extension.toolbarMenu.help': 'Aide',
  'extension.toolbarMenu.documentation': 'Documentation',
  'extension.toolbarMenu.whatsNew': 'Nouveautés',
  'extension.toolbarMenu.reportProblem': 'Signaler un problème',
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    "Client API Enterprise open source dans votre navigateur. Travail d'équipe. Intercepteur navigateur – modifiez le trafic en direct.",
  'extension.manifest.descriptionSafari':
    "Client API Enterprise open source dans votre navigateur. Travail d'équipe. Intercepteur web – éditez le trafic.",
  'extension.manifest.actionDescription': 'Ouvrir le popup Open Headers',
} as const satisfies Catalog;
