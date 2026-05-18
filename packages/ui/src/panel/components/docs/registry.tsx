/**
 * Docs registry for the DevTools panel surface. Surfaced through the
 * panel's docs tool-window via the shared `DocsPanel` component.
 *
 * The workbench has its own (much larger) registry covering rule
 * mechanics, conditions, and concepts. The panel keeps its surface
 * focused on what users encounter inside DevTools:
 *
 *   1. Filter Syntax     — how the traffic filter input works.
 *   2. HTTP Headers      — what each common header means; deep-linked
 *                          from the Headers tab's `(i)` triggers.
 */

import { FilterOutlined } from '@ant-design/icons';
import type { DocGroup } from '@openheaders/ui/shared/docs/registry';
import { HTTP_HEADERS_GROUP } from '@openheaders/ui/shared/docs/sections/http-headers';
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

export const PANEL_DOC_GROUPS: readonly DocGroup[] = [FILTER_SYNTAX_GROUP, HTTP_HEADERS_GROUP];

/** Section opened on first mount when no deep-link is pending. */
export const PANEL_DEFAULT_SECTION_ID = 'filter-syntax';
