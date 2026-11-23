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
  'extension.toolbarMenu.openWorkspace': 'Abrir el espacio de trabajo',
  'extension.toolbarMenu.settings': 'Configuración',
  'extension.toolbarMenu.pauseRules': 'Pausar las reglas',
  'extension.toolbarMenu.resumeRules': 'Reanudar las reglas',
  'extension.toolbarMenu.notifications': 'Notificaciones',
  'extension.toolbarMenu.help': 'Ayuda',
  'extension.toolbarMenu.documentation': 'Documentación',
  'extension.toolbarMenu.whatsNew': 'Novedades',
  'extension.toolbarMenu.reportProblem': 'Informar de un problema',
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'El cliente de API Enterprise open source en tu navegador. Trabajo en equipo. Interceptor de navegador: modifica el tráfico en vivo.',
  'extension.manifest.descriptionSafari':
    'Cliente API Enterprise open source en tu navegador. Trabajo en equipo. Interceptor de navegador: edita tráfico.',
  'extension.manifest.actionDescription': 'Abrir el popup de Open Headers',
} as const satisfies Catalog;
