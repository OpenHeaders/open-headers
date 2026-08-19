/**
 * Condition type registry — display metadata for condition rows and the
 * type-picker option builder. Each entry maps one editor row type to its
 * label key, category group key, and input shape. The DNR semantics
 * (slot keys, mutex groups, value logic) live in core's `CONDITION_META`;
 * this file only renders them. See ConditionEditor's header for the
 * one-row-per-slot / AND-model contract the picker enforces.
 *
 * Placeholders stay literal pattern/domain examples — format-example
 * precedent, not chrome copy.
 */

import type { ConditionType, RuleCondition } from '@openheaders/core/types';
import { CONDITION_META, getConditionTypeSlotKey, isConditionSupportedByDnr } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';

export interface ConditionTypeDef {
  value: ConditionType;
  labelKey: MessageKey;
  groupKey: MessageKey;
  inputType: 'text' | 'multi-select-methods' | 'multi-select-resources' | 'single-select-domain-type' | 'header';
  placeholder?: string;
}

const CONDITION_TYPES: ConditionTypeDef[] = [
  // URL Matching
  {
    value: 'url-filter',
    labelKey: 'workbench.editors.rule.condition.type.urlFilter',
    groupKey: 'workbench.editors.rule.condition.group.urlMatching',
    inputType: 'text',
    placeholder: '*://api.openheaders.com/*',
  },
  {
    value: 'url-regex',
    labelKey: 'workbench.editors.rule.condition.type.urlRegex',
    groupKey: 'workbench.editors.rule.condition.group.urlMatching',
    inputType: 'text',
    placeholder: '^https://.*\\.openheaders\\.io/api/.*',
  },
  // Domain Filtering
  {
    value: 'request-domains',
    labelKey: 'workbench.editors.rule.condition.type.requestDomains',
    groupKey: 'workbench.editors.rule.condition.group.domainFiltering',
    inputType: 'text',
    placeholder: 'openheaders.com, api.openheaders.com',
  },
  {
    value: 'exclude-request-domains',
    labelKey: 'workbench.editors.rule.condition.type.excludeRequestDomains',
    groupKey: 'workbench.editors.rule.condition.group.domainFiltering',
    inputType: 'text',
    placeholder: 'staging.openheaders.com',
  },
  {
    value: 'initiator-domains',
    labelKey: 'workbench.editors.rule.condition.type.initiatorDomains',
    groupKey: 'workbench.editors.rule.condition.group.domainFiltering',
    inputType: 'text',
    placeholder: 'portal.openheaders.com',
  },
  {
    value: 'exclude-initiator-domains',
    labelKey: 'workbench.editors.rule.condition.type.excludeInitiatorDomains',
    groupKey: 'workbench.editors.rule.condition.group.domainFiltering',
    inputType: 'text',
    placeholder: 'external.com',
  },
  // Request Filtering
  {
    value: 'request-methods',
    labelKey: 'workbench.editors.rule.condition.type.requestMethods',
    groupKey: 'workbench.editors.rule.condition.group.requestFiltering',
    inputType: 'multi-select-methods',
  },
  {
    value: 'exclude-request-methods',
    labelKey: 'workbench.editors.rule.condition.type.excludeRequestMethods',
    groupKey: 'workbench.editors.rule.condition.group.requestFiltering',
    inputType: 'multi-select-methods',
  },
  {
    value: 'resource-types',
    labelKey: 'workbench.editors.rule.condition.type.resourceTypes',
    groupKey: 'workbench.editors.rule.condition.group.requestFiltering',
    inputType: 'multi-select-resources',
  },
  {
    value: 'exclude-resource-types',
    labelKey: 'workbench.editors.rule.condition.type.excludeResourceTypes',
    groupKey: 'workbench.editors.rule.condition.group.requestFiltering',
    inputType: 'multi-select-resources',
  },
  {
    value: 'domain-type',
    labelKey: 'workbench.editors.rule.condition.type.domainType',
    groupKey: 'workbench.editors.rule.condition.group.requestFiltering',
    inputType: 'single-select-domain-type',
  },
  // Header Matching (Chrome 128+, response-side only — DNR has no request-header matching)
  {
    value: 'response-header',
    labelKey: 'workbench.editors.rule.condition.type.responseHeader',
    groupKey: 'workbench.editors.rule.condition.group.headerMatching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
  {
    value: 'exclude-response-header',
    labelKey: 'workbench.editors.rule.condition.type.excludeResponseHeader',
    groupKey: 'workbench.editors.rule.condition.group.headerMatching',
    inputType: 'header',
    placeholder: 'Header value equals...',
  },
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export const RESOURCE_TYPES = ['page', 'xhr', 'script', 'stylesheet', 'image', 'font', 'media', 'websocket', 'other'];
export const DOMAIN_TYPES: Array<{ value: string; labelKey: MessageKey }> = [
  { value: 'firstParty', labelKey: 'workbench.editors.rule.condition.firstParty' },
  { value: 'thirdParty', labelKey: 'workbench.editors.rule.condition.thirdParty' },
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
  t: Translate,
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

  const groups = new Map<MessageKey, ConditionTypeDef[]>();
  for (const def of CONDITION_TYPES) {
    if (!groups.has(def.groupKey)) groups.set(def.groupKey, []);
    groups.get(def.groupKey)!.push(def);
  }

  return [...groups.entries()].map(([groupKey, items]) => ({
    label: t(groupKey),
    options: items.map((def) => {
      const isCurrent = def.value === currentType;
      // Hide the type completely if it's unsupported AND not the current
      // row's value. Showing it on the current row lets the user switch
      // away from a legacy import without first deleting the row.
      const unsupported = !isConditionSupportedByDnr(def.value) && !isCurrent;
      const meta = CONDITION_META[def.value];
      // Header types skip the slot gate — see the comment above.
      const slotKey = meta?.perHeader ? null : getConditionTypeSlotKey(def.value);
      const slotClash = !isCurrent && slotKey !== null && claimedSlots.has(slotKey);
      const disabled = unsupported || slotClash;
      const suffix = unsupported
        ? t('workbench.editors.rule.condition.suffix.notSupported')
        : slotClash
          ? t('workbench.editors.rule.condition.suffix.alreadyUsed')
          : '';
      return {
        value: def.value,
        label: suffix ? `${t(def.labelKey)}${suffix}` : t(def.labelKey),
        disabled,
      };
    }),
  }));
}

export function getTypeDef(type: ConditionType): ConditionTypeDef | undefined {
  return CONDITION_TYPES.find((def) => def.value === type);
}
