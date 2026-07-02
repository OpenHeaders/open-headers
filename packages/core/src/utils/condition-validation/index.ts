/**
 * Pure validators for `RuleCondition` values.
 *
 * Chrome's declarativeNetRequest is strict about what each condition
 * field accepts, but the rejections are atomic (a single bad value in
 * a `requestDomains` list trips the whole `updateDynamicRules` call,
 * which leaves the prior compiled ruleset stuck in place — no partial
 * apply, no rule-level error). The user has no way to see why their
 * new rule isn't matching unless we surface the issue at edit time.
 *
 * This module catches the four mistakes we've seen most:
 *   1. literal `*` wildcards in domain values  (Chrome rejects)
 *   2. `:port` suffixes in domain values        (Chrome ignores ports
 *      anyway — the value is rejected as invalid)
 *   3. scheme prefixes (`http://`, `https://`)  (rejected as invalid)
 *   4. uppercase / non-ASCII characters         (rejected as invalid;
 *      the canonical form is lowercase ASCII)
 *
 * Each issue carries a `cleaned` field — the suggested fix — so the
 * UI can offer a one-click cleanup without inventing the rule itself.
 *
 * Pure / platform-agnostic: imported by the renderer for inline
 * warnings + by future SW gates that want to refuse to compile a
 * rule with structurally-invalid domain values.
 */

export {
  applyDomainValueCleanup,
  DOMAIN_ISSUE_SUMMARY,
  type DomainIssueKind,
  type DomainValueIssue,
  summarizeDomainIssues,
  validateDomainValues,
} from './domain-values';
export {
  type ConditionStructuralIssue,
  type ConditionStructuralIssueKind,
  validateConditionStructure,
} from './structure';
export {
  type ConditionValueIssue,
  type ConditionValueIssueKind,
  type ConditionValueSeverity,
  validateConditionValues,
} from './values';
