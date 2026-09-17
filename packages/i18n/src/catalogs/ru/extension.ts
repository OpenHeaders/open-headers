/**
 * Extension namespace — Russian. Mirrors `catalogs/en/extension.ts`
 * key for key; the 'Open Headers' brand prefix and its ` - ` state
 * separator ride raw inside the values. State words: Активно = Active;
 * Приостановлено = Paused; Нет соединения = Disconnected. Also
 * statically bundled into the service worker via
 * `catalogs/static-extension.ts` — keep this file free of heavy
 * imports.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - Приостановлено\nВыполнение правил приостановлено',
  'extension.badge.disconnected': 'Open Headers - Нет соединения\nНастольное приложение недоступно',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Активно\n${matched} из ${plural(locale, Number(configured), {
      one: '{count} правила',
      few: '{count} правил',
      many: '{count} правил',
      other: '{count} правил',
    })} совпали с запросами на этой странице`,
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'DevToolkit с открытым кодом в расширении браузера. Правка запросов браузера на лету. Управление коллекциями API. Работа в команде.',
  'extension.manifest.actionDescription': 'Открыть всплывающее окно Open Headers',
} as const satisfies Catalog;
