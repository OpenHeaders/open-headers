/**
 * Draft-name generation for the quick-editor create popovers — the base
 * label deduped against existing rule names via the shared `uniqueName`
 * scheme, same as the workbench's `generateDraftName` (which
 * additionally dedupes against open tab labels; the popover has no
 * tabs).
 */

import { uniqueName } from '@openheaders/ui/shared/naming';

export function generateQuickRuleName(baseName: string, rules: ReadonlyArray<{ name: string }>): string {
  return uniqueName(baseName, new Set(rules.map((r) => r.name)));
}
