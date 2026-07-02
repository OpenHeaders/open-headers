/**
 * Condition type registry — display metadata for condition rows and the
 * type-picker option builder. Each entry maps one editor row type to its
 * label, category group, and input shape. The DNR semantics (slot keys,
 * mutex groups, value logic) live in core's `CONDITION_META`; this file
 * only renders them. See ConditionEditor's header for the one-row-per-slot
 * / AND-model contract the picker enforces.
 */

import type { ConditionType, RuleCondition } from '@openheaders/core/types';
import { CONDITION_META, getConditionTypeSlotKey, isConditionSupportedByDnr } from '@openheaders/core/utils';
import type React from 'react';

export interface ConditionTypeDef {
  value: ConditionType;
  label: string;
  group: string;
  inputType: 'text' | 'multi-select-methods' | 'multi-select-resources' | 'single-select-domain-type' | 'header';
  placeholder?: string;
}

const CONDITION_TYPES: ConditionTypeDef[] = [
  // URL Matching
  {
    value: 'url-filter',
    label: 'URL Pattern',
    group: 'URL Matching',
    inputType: 'text',
    placeholder: '*://api.openheaders.io/*',
  },
  {
    value: 'url-regex',
    label: 'URL Regex',
    group: 'URL Matching',
    inputType: 'text',
    placeholder: '^https://.*\\.openheaders\\.io/api/.*',
  },
  // Domain Filtering
  {
    value: 'request-domains',
    label: 'Request Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'openheaders.io, api.openheaders.io',
  },
  {
    value: 'exclude-request-domains',
    label: 'Exclude Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'staging.openheaders.io',
  },
  {
    value: 'initiator-domains',
    label: 'Initiator Domains',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'portal.openheaders.io',
  },
  {
    value: 'exclude-initiator-domains',
    label: 'Excl. Initiator',
    group: 'Domain Filtering',
    inputType: 'text',
    placeholder: 'external.com',
  },
  // Request Filtering
  { value: 'request-methods', label: 'Methods', group: 'Request Filtering', inputType: 'multi-select-methods' },
  {
    value: 'exclude-request-methods',
    label: 'Excl. Methods',
    group: 'Request Filtering',
    inputType: 'multi-select-methods',
  },
  { value: 'resource-types', label: 'Resource Types', group: 'Request Filtering', inputType: 'multi-select-resources' },
  {
    value: 'exclude-resource-types',
    label: 'Excl. Resources',
    group: 'Request Filtering',
    inputType: 'multi-select-resources',
  },
  { value: 'domain-type', label: 'Domain Type', group: 'Request Filtering', inputType: 'single-select-domain-type' },
  // Header Matching (Chrome 128+, response-side only — DNR has no request-header matching)
  {
    value: 'response-header',
    label: 'Response Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
  {
    value: 'exclude-response-header',
    label: 'Excl. Resp Header',
    group: 'Header Matching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export const RESOURCE_TYPES = ['page', 'xhr', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];
export const DOMAIN_TYPES = [
  { value: 'firstParty', label: 'First-party' },
  { value: 'thirdParty', label: 'Third-party' },
];

/**
 * Build the type-selector options for one row, given the current
 * condition list and that row's index. Types are grouped by category
 * and disabled (with an explanatory label suffix) when:
 *
 *   - the type is not supported by Chrome DNR (`supportedByDnr === false`),
 *     unless the row already holds that type — in that case it's allowed
 *     to render so the user can switch it to something else without
 *     losing the row;
 *   - the type's slot key is already claimed by a DIFFERENT row, where
 *     "slot key" is the type's mutex group or the type itself
 *     (`url-filter` and `url-regex` share `'url-pattern'`, so having
 *     either present elsewhere disables both here; `request-domains`
 *     elsewhere disables `request-domains` here; etc.).
 *
 * Header types (`response-header`, `exclude-response-header`) are
 * intentionally NEVER picker-disabled: their slot identity is
 * `(type, headerName)`, and the picker can't predict the name the user
 * will type. The structural validator catches `(type, headerName)`
 * collisions per row after the fact.
 *
 * The metadata in core/utils is the single source of truth for both
 * conditions; the editor just renders it.
 */
export function buildTypeOptions(
  conditions: readonly RuleCondition[],
  currentIndex: number,
): Array<{ label: string; options: Array<{ value: ConditionType; label: React.ReactNode; disabled?: boolean }> }> {
  // Slot keys claimed by OTHER rows. We use the type-only slot key here
  // (not the per-row key) — header types intentionally never gate the
  // picker, so we skip them.
  const claimedSlots = new Set<string>();
  for (let i = 0; i < conditions.length; i++) {
    if (i === currentIndex) continue;
    const meta = CONDITION_META[conditions[i].type];
    if (meta?.perHeader) continue;
    const key = getConditionTypeSlotKey(conditions[i].type);
    if (key) claimedSlots.add(key);
  }
  const currentType = conditions[currentIndex]?.type;

  const groups = new Map<string, ConditionTypeDef[]>();
  for (const t of CONDITION_TYPES) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group)!.push(t);
  }

  return [...groups.entries()].map(([group, items]) => ({
    label: group,
    options: items.map((t) => {
      const isCurrent = t.value === currentType;
      // Hide the type completely if it's unsupported AND not the current
      // row's value. Showing it on the current row lets the user switch
      // away from a legacy import without first deleting the row.
      const unsupported = !isConditionSupportedByDnr(t.value) && !isCurrent;
      const meta = CONDITION_META[t.value];
      // Header types skip the slot gate — see the comment above.
      const slotKey = meta?.perHeader ? null : getConditionTypeSlotKey(t.value);
      const slotClash = !isCurrent && slotKey !== null && claimedSlots.has(slotKey);
      const disabled = unsupported || slotClash;
      const suffix = unsupported ? ' — not supported by Chrome DNR' : slotClash ? ' — already used' : '';
      return {
        value: t.value,
        label: suffix ? `${t.label}${suffix}` : t.label,
        disabled,
      };
    }),
  }));
}

export function getTypeDef(type: ConditionType): ConditionTypeDef | undefined {
  return CONDITION_TYPES.find((t) => t.value === type);
}
