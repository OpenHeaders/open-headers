/**
 * Docs registry for the DevTools panel surface. Surfaced through the
 * panel's docs tool-window via the shared `DocsPanel` component.
 *
 * Per-header reference lives in inline `<InfoPopover>` triggers on the
 * Headers tab — NOT in this docs registry. Keeping header info out of
 * the docs panel preserves the user's debugging flow: clicking `(i)`
 * pops anchored context instead of shoving them into a separate
 * reading surface.
 */

import { FilterOutlined } from '@ant-design/icons';
import type { DocGroup } from '@openheaders/ui/shared/docs/registry';
import { FilterSyntaxSection } from './sections/filter-syntax';

const FILTER_SYNTAX_GROUP: DocGroup = {
  id: 'panel-filter',
  label: 'Panel',
  sections: [
    {
      id: 'filter-syntax',
      title: 'Filter Syntax',
      summary: 'Text filters, property filters, and toggle buttons for the traffic filter input.',
      group: 'panel-filter',
      icon: <FilterOutlined />,
      Component: FilterSyntaxSection,
    },
  ],
};

export const PANEL_DOC_GROUPS: readonly DocGroup[] = [FILTER_SYNTAX_GROUP];

/** Section opened on first mount when no deep-link is pending. */
export const PANEL_DEFAULT_SECTION_ID = 'filter-syntax';
