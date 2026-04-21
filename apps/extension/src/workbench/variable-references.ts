/**
 * `{{VAR}}` reference extraction helpers — shared between the
 * VariablesPanel inspector and the rule-editor resolution banner.
 *
 * Both surfaces need to walk an arbitrary value (a rule, a draft, a
 * template literal tree) and harvest every string that contains a
 * template reference. Keeping the regex + walker in one place means
 * both surfaces see the same set of references and can't drift.
 */

/**
 * Matches any `{{...}}` occurrence. Intentionally permissive at this
 * stage — the resolver's own parser (`@openheaders/core/variables`)
 * decides which references are valid. We only need to know which
 * strings are *candidates* for resolution.
 */
export const TEMPLATE_RX = /\{\{[^}]+\}\}/;

/**
 * Recursively harvest every string value containing `{{...}}` from an
 * arbitrary input. Strings, arrays, and plain objects are walked;
 * everything else is ignored. Output is appended to `out` in
 * traversal order (duplicates included — caller dedupes if needed).
 */
export function collectTemplateStrings(input: unknown, out: string[]): void {
  if (typeof input === 'string') {
    if (TEMPLATE_RX.test(input)) out.push(input);
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectTemplateStrings(item, out);
    return;
  }
  if (input && typeof input === 'object') {
    for (const v of Object.values(input as Record<string, unknown>)) collectTemplateStrings(v, out);
  }
}
