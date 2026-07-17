/**
 * Extension namespace — service-worker-owned strings (toolbar badge
 * tooltips). These render outside any React root: the background
 * threads a `Translator` from the runtime directly and follows the
 * settings locale, not the browser UI locale. The 'Open Headers'
 * brand prefix rides raw inside the values — the brand never
 * translates.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - Paused\nRules execution is paused',
  'extension.badge.disconnected': 'Open Headers - Disconnected\nCannot reach the desktop app',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - Active\n${matched} of your ${plural(locale, Number(configured), {
      one: '{count} rule',
      other: '{count} rules',
    })} matched requests on this page`,
} as const satisfies Catalog;
