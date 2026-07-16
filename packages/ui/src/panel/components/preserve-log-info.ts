/**
 * `(i)` info-popover content for the toolbar's "Preserve log" checkbox.
 * The behaviour doesn't change with the inspected tab's mode — the
 * builder exists only to thread the live translator through.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export function getPreserveLogInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.toolbar.preserveLog'),
    summary: t('panel.info.preserveLog.summary'),
    description: t('panel.info.preserveLog.description'),
    sections: [
      {
        heading: t('panel.info.preserveLog.whenHeading'),
        items: [
          { label: t('panel.info.preserveLog.redirects'), desc: t('panel.info.preserveLog.redirectsDesc') },
          { label: t('panel.info.preserveLog.forms'), desc: t('panel.info.preserveLog.formsDesc') },
          { label: t('panel.info.preserveLog.reloadLoops'), desc: t('panel.info.preserveLog.reloadLoopsDesc') },
        ],
      },
    ],
  };
}
