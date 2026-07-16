/**
 * Operation options for the header quick-editor bodies (edit + create).
 * Labels reuse the workbench HeaderRuleFields keys so the popover and
 * the full editor agree on what each op is called in every locale.
 */

import type { HeaderOperation } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

const HEADER_OPERATION_META: { value: HeaderOperation; labelKey: MessageKey }[] = [
  { value: 'override', labelKey: 'workbench.editors.rule.fields.opAddReplace' },
  { value: 'add', labelKey: 'workbench.editors.rule.fields.opAppend' },
  { value: 'remove', labelKey: 'workbench.editors.rule.fields.opRemove' },
  { value: 'merge', labelKey: 'workbench.editors.rule.fields.opMerge' },
];

export function headerOperationOptions(t: Translate): { value: HeaderOperation; label: string }[] {
  return HEADER_OPERATION_META.map(({ value, labelKey }) => ({ value, label: t(labelKey) }));
}
