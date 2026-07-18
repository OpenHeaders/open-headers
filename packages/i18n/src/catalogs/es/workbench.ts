/**
 * Workbench namespace — Spanish. Mirrors `catalogs/en/workbench.ts`
 * key for key; the `@modified` search operator rides raw. Settings =
 * Configuración (es mint, S58 law).
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Buscar en la configuración (prueba @modified)',
  'workbench.settings.search.filter.modified': 'Modificados',
  'workbench.settings.search.filter.experimental': 'Experimentales',
} as const satisfies Catalog;
