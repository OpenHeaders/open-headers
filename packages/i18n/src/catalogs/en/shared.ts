/**
 * Shared namespace — strings used by more than one surface (common
 * actions, generic states). Keys land here the first time a second
 * surface needs them; surface-specific strings stay in their own file.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Save',
  'shared.action.cancel': 'Cancel',
  'shared.action.close': 'Close',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} rule', other: '{count} rules' }),
} as const satisfies Catalog;
