/**
 * `(i)` info-popover content for the toolbar's "Preserve log" checkbox.
 * Static (the behaviour doesn't change with the inspected tab's mode), so
 * a plain constant rather than a builder.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export const PRESERVE_LOG_INFO: InfoPopoverContent = {
  title: 'Preserve log',
  summary: 'Keeps recorded requests across page navigations and reloads instead of clearing the list each time the page changes.',
  description:
    'On — the log carries over every navigation, so requests that fired just before a redirect, form submit, or reload stay visible. Off — the list clears on each navigation or reload, like the browser’s own Network panel, showing only the current page’s traffic.',
  sections: [
    {
      heading: 'Reach for it when',
      items: [
        { label: 'Redirects', desc: 'Inspect the request that triggered a navigation before the new page wipes it.' },
        { label: 'Form submits / logins', desc: 'Keep a POST and its response visible after the page reloads.' },
        { label: 'Reload loops', desc: 'See what fired just before the page reloaded itself.' },
      ],
    },
  ],
};
