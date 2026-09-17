/**
 * Extension namespace — Spanish. Mirrors `catalogs/en/extension.ts` key
 * for key; the 'Open Headers' brand prefix rides raw inside the values.
 * Also statically bundled into the service worker via
 * `catalogs/static-extension.ts` — keep this file free of heavy
 * imports.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - En pausa\nLa ejecución de reglas está en pausa',
  'extension.badge.disconnected': 'Open Headers - Desconectado\nNo se puede contactar con la aplicación de escritorio',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Activo\n${matched} de tus ${plural(locale, Number(configured), {
      one: '{count} regla',
      many: '{count} reglas',
      other: '{count} reglas',
    })} coincidieron con solicitudes en esta página`,
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'DevToolkit web open source, en una extensión de navegador. Modifica solicitudes en vivo. Colecciones de API. Colaboración en equipo.',
  'extension.manifest.actionDescription': 'Abrir el popup de Open Headers',
} as const satisfies Catalog;
