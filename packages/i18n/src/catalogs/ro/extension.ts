/**
 * Extension namespace — Romanian. Mirrors `catalogs/en/extension.ts`
 * key for key; the 'Open Headers' brand prefix and its ` - ` state
 * separator ride raw inside the values. State words: Activ = Active;
 * În pauză = Paused; Deconectat = Disconnected. Also statically
 * bundled into the service worker via `catalogs/static-extension.ts`
 * — keep this file free of heavy imports.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - În pauză\nExecuția regulilor este în pauză',
  'extension.badge.disconnected': 'Open Headers - Deconectat\nAplicația desktop nu poate fi contactată',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Activ\n${matched} din ${plural(locale, Number(configured), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    })} au corespuns cererilor de pe această pagină`,
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'DevToolkit open source, într-o extensie de browser. Modificați cererile în timp real. Gestionați colecții API. Colaborare în echipă.',
  'extension.manifest.actionDescription': 'Deschidere fereastră popup Open Headers',
} as const satisfies Catalog;
