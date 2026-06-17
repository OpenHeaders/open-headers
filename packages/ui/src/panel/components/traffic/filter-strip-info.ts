/**
 * `(i)` info-popover content for the Network panel's filter strip — the
 * resource-type filter (All / Fetch-XHR / Socket / More) and the Sort menu.
 * Static, so plain constants rather than builders.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export const RESOURCE_FILTER_INFO: InfoPopoverContent = {
  title: 'Request types',
  summary: 'Narrows the list to one or more request types. "All" shows everything; pick types to filter, or combine several.',
  sections: [
    {
      heading: 'Inline',
      items: [
        { label: 'Fetch/XHR', desc: 'API calls — fetch() and XMLHttpRequest.' },
        { label: 'Socket', desc: 'WebSocket connections.' },
      ],
    },
    {
      heading: 'Under More',
      items: [
        { label: 'Doc · CSS · JS', desc: 'Documents, stylesheets, and scripts.' },
        { label: 'Font · Img · Media', desc: 'Fonts, images, and audio / video.' },
        { label: 'Manifest · Wasm · Other', desc: 'Web app manifests, WebAssembly, and everything else.' },
      ],
    },
  ],
};

export const SORT_INFO: InfoPopoverContent = {
  title: 'Sort',
  summary: 'Chooses how the request list is ordered. Hover a group to pick a specific mode.',
  sections: [
    {
      heading: 'Modes',
      items: [
        { label: 'Waterfall', desc: 'By time — start, response, end, duration, or latency.' },
        { label: 'Priority', desc: 'What needs attention first — failures, slowest, largest.' },
        { label: 'Grouping', desc: 'Cluster by type, domain, or rule-modified.' },
        { label: 'Custom', desc: 'Click a column header, or build a multi-key nested sort.' },
      ],
    },
  ],
};
