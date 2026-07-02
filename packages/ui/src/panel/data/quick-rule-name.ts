/**
 * Draft-name generation for the quick-editor create popovers — the base
 * label deduped against existing rule names, same scheme as the
 * workbench's `generateDraftName` (which additionally dedupes against
 * open tab labels; the popover has no tabs).
 */

export function generateQuickRuleName(baseName: string, rules: ReadonlyArray<{ name: string }>): string {
  const existing = new Set(rules.map((r) => r.name));
  if (!existing.has(baseName)) return baseName;
  let counter = 2;
  while (existing.has(`${baseName} (${counter})`)) counter++;
  return `${baseName} (${counter})`;
}
