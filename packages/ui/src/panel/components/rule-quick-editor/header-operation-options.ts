/**
 * Operation options for the header quick-editor bodies (edit + create).
 * Labels mirror the workbench HeaderRuleFields so the popover and the
 * full editor agree on what each op is called.
 */

import type { HeaderOperation } from '@openheaders/core/types';

export const HEADER_OPERATION_OPTIONS: { value: HeaderOperation; label: string }[] = [
  { value: 'override', label: 'Add / Replace' },
  { value: 'add', label: 'Append' },
  { value: 'remove', label: 'Remove' },
  { value: 'merge', label: 'Merge' },
];
