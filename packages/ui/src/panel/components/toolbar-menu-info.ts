/**
 * `(i)` info-popover content for the toolbar's menu dropdowns — "More
 * filters" and "View". Neither depends on the inspected tab's mode —
 * the builders exist only to thread the live translator through.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export function getMoreFiltersInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.moreFilters.label'),
    summary: t('panel.info.moreFilters.summary'),
    sections: [
      {
        heading: t('panel.info.moreFilters.hideHeading'),
        items: [
          { label: t('panel.info.moreFilters.dataUrls'), desc: t('panel.info.moreFilters.dataUrlsDesc') },
          { label: t('panel.info.moreFilters.extensionUrls'), desc: t('panel.info.moreFilters.extensionUrlsDesc') },
        ],
      },
      {
        heading: t('panel.info.moreFilters.onlyHeading'),
        items: [
          { label: t('panel.info.moreFilters.blocked'), desc: t('panel.info.moreFilters.blockedDesc') },
          { label: t('panel.info.moreFilters.thirdParty'), desc: t('panel.info.moreFilters.thirdPartyDesc') },
        ],
      },
    ],
  };
}

export function getViewInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.view.label'),
    summary: t('panel.info.view.summary'),
    sections: [
      {
        heading: t('panel.info.view.scopeHeading'),
        items: [
          { label: t('panel.info.view.focusedTool'), desc: t('panel.info.view.focusedToolDesc') },
          { label: t('panel.info.view.networkOnly'), desc: t('panel.info.view.networkOnlyDesc') },
        ],
      },
      {
        heading: t('panel.info.view.countsHeading'),
        items: [
          { label: t('panel.info.view.modified'), desc: t('panel.info.view.modifiedDesc') },
          { label: t('panel.info.view.failed'), desc: t('panel.info.view.failedDesc') },
          { label: t('panel.info.view.cached'), desc: t('panel.info.view.cachedDesc') },
        ],
      },
      {
        heading: t('panel.info.view.timingHeading'),
        items: [
          { label: t('panel.info.view.pageLabel'), desc: t('panel.info.view.pageLabelDesc') },
          { label: t('panel.info.view.allNavs'), desc: t('panel.info.view.allNavsDesc') },
        ],
      },
    ],
  };
}
