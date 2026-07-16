/**
 * `(i)` info-popover content for the Network panel's filter strip — the
 * resource-type filter (All / Fetch-XHR / Socket / More) and the Sort menu.
 * t-first builders; the pill vocabulary (Fetch/XHR, Socket, Doc · CSS · JS,
 * …) and the Waterfall mode name are parity vocabulary and ride raw in the
 * item labels, while the explanations key.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export function getResourceFilterInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.typeInfo.title'),
    summary: t('panel.network.typeInfo.summary'),
    sections: [
      {
        heading: t('panel.network.typeInfo.inlineHeading'),
        items: [
          { label: 'Fetch/XHR', desc: t('panel.network.typeInfo.fetchXhrDesc') },
          { label: 'Socket', desc: t('panel.network.typeInfo.socketDesc') },
        ],
      },
      {
        heading: t('panel.network.typeInfo.underMoreHeading'),
        items: [
          { label: 'Doc · CSS · JS', desc: t('panel.network.typeInfo.docCssJsDesc') },
          { label: 'Font · Img · Media', desc: t('panel.network.typeInfo.fontImgMediaDesc') },
          { label: 'Manifest · Wasm · Other', desc: t('panel.network.typeInfo.manifestWasmOtherDesc') },
        ],
      },
    ],
  };
}

export function getSortInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.network.sort.label'),
    summary: t('panel.network.sortInfo.summary'),
    sections: [
      {
        heading: t('panel.network.sortInfo.modesHeading'),
        items: [
          { label: 'Waterfall', desc: t('panel.network.sortInfo.waterfallDesc') },
          { label: t('panel.network.sort.groupPriority'), desc: t('panel.network.sortInfo.priorityDesc') },
          { label: t('panel.network.sort.groupGrouping'), desc: t('panel.network.sortInfo.groupingDesc') },
          { label: t('panel.network.sortInfo.custom'), desc: t('panel.network.sortInfo.customDesc') },
        ],
      },
    ],
  };
}
