/**
 * `(i)` info-popover content for the toolbar's menu dropdowns — "More
 * filters" and "View". Static (neither depends on the inspected tab's
 * mode), so plain constants rather than builders.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export const MORE_FILTERS_INFO: InfoPopoverContent = {
  title: 'More filters',
  summary: 'Secondary request filters tucked behind a menu — each narrows the list without taking up first-class toolbar space.',
  sections: [
    {
      heading: 'Hide',
      items: [
        { label: 'Data URLs', desc: 'Exclude inline data: resources — base64 images, fonts, and the like.' },
        { label: 'Extension URLs', desc: 'Exclude requests to browser-extension origins.' },
      ],
    },
    {
      heading: 'Only show',
      items: [
        { label: 'Blocked requests', desc: 'Restrict the list to requests a rule blocked.' },
        { label: '3rd-party requests', desc: 'Restrict to requests whose origin differs from the page’s.' },
      ],
    },
  ],
};

export const VIEW_INFO: InfoPopoverContent = {
  title: 'Footer View',
  summary: 'Chooses which optional stats the footer shows, beside the always-on request and transfer counts.',
  sections: [
    {
      heading: 'Summary scope',
      items: [
        {
          label: 'Focused tool',
          desc: 'The footer follows the focused tool window — Storage, Console, and Search show their own summary lines; other tools fall back to the Network line.',
        },
        {
          label: 'Network tool only',
          desc: 'The footer always shows the Network figures, whichever tool window has focus.',
        },
      ],
    },
    {
      heading: 'Footer counts',
      items: [
        { label: 'Modified', desc: 'How many requests a rule changed.' },
        { label: 'Failed', desc: 'How many requests errored or were blocked.' },
        { label: 'Cached', desc: 'How many responses were served from the cache.' },
      ],
    },
    {
      heading: 'Timing',
      items: [
        {
          label: 'Current page label',
          desc: 'Names the page the timing milestones describe when the log spans more than one navigation.',
        },
        {
          label: 'Across all navigations',
          desc: 'Finish / DOMContentLoaded / Load span the whole preserve-log timeline, not just the latest navigation.',
        },
      ],
    },
  ],
};
