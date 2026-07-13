/**
 * Per-row hints and issue banners for ConditionEditor — the value-logic
 * badge plus the three validation banners (value, structural, domain).
 * All render below/beside one condition row; the issue payloads come
 * from core's condition validators.
 *
 * Copy resolution: core validators stay copy-free at this boundary —
 * each banner maps `issue.kind` to a catalog key and interpolates the
 * technical parts (condition type ids, raw values, engine reasons)
 * verbatim. Core's English `message` remains the SW observability
 * string; the one kind whose copy still lives in core is
 * `invalid-header-name` (the shared `headers.ts` plane, converted with
 * the panel surface) — it falls back to the raw message.
 */

import { WarningFilled } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { ConditionType, RuleCondition } from '@openheaders/core/types';
import {
  CONDITION_META,
  type ConditionStructuralIssue,
  type ConditionValueIssue,
  type DomainIssueKind,
  type DomainValueIssue,
} from '@openheaders/core/utils';
import { Button, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';

/**
 * Tiny inline badge that tells the user how multiple values inside ONE
 * row combine. Together with the "AND" tag between rows, this makes the
 * full logic visible without a docs trip:
 *
 *   - `or`     → `OR`     "values in this row match any (OR)"
 *   - `single` → `1 value` "this condition takes one value; comma-separating won't help"
 *
 * Drawn from `CONDITION_META.valueLogic` — no editor-side hardcoding.
 */
export const ValueLogicHint: React.FC<{ type: ConditionType }> = ({ type }) => {
  const t = useT();
  const { token } = theme.useToken();
  const meta = CONDITION_META[type];
  if (!meta) return null;
  const isOr = meta.valueLogic === 'or';
  const label = isOr ? t('workbench.editors.rule.condition.orTag') : t('workbench.editors.rule.condition.oneValueTag');
  const tooltip = isOr
    ? t('workbench.editors.rule.condition.orTooltip')
    : t('workbench.editors.rule.condition.oneValueTooltip');
  return (
    <Tooltip title={tooltip}>
      <Tag
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          lineHeight: '18px',
          margin: 0,
          padding: '0 4px',
          flexShrink: 0,
          background: token.colorFillTertiary,
          border: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextSecondary,
          cursor: 'help',
        }}
      >
        {label}
      </Tag>
    </Tooltip>
  );
};

/**
 * Resolve one value issue's display copy. `empty` picks per condition
 * type (only url-filter / url-regex emit it); `invalid-header-name`
 * renders core's raw message until the shared headers plane converts.
 */
function valueIssueText(issue: ConditionValueIssue, conditionType: ConditionType, t: Translate): string {
  switch (issue.kind) {
    case 'empty':
      return conditionType === 'url-regex'
        ? t('workbench.editors.rule.issue.emptyUrlRegex')
        : t('workbench.editors.rule.issue.emptyUrlFilter');
    case 'url-filter-whitespace':
      return t('workbench.editors.rule.issue.urlFilterWhitespace');
    case 'url-filter-non-ascii':
      return t('workbench.editors.rule.issue.urlFilterNonAscii');
    case 'url-filter-regex-syntax':
      return t('workbench.editors.rule.issue.urlFilterRegexSyntax');
    case 'regex-lookbehind':
      return t('workbench.editors.rule.issue.regexLookbehind');
    case 'regex-named-group':
      return t('workbench.editors.rule.issue.regexNamedGroup');
    case 'invalid-url-regex':
      return t('workbench.editors.rule.issue.invalidUrlRegex', { reason: issue.detail ?? issue.raw });
    case 'invalid-method':
      return t('workbench.editors.rule.issue.invalidMethod', { value: issue.raw.trim() });
    case 'invalid-resource-type':
      return t('workbench.editors.rule.issue.invalidResourceType', { value: issue.raw.trim() });
    case 'invalid-domain-type':
      return t('workbench.editors.rule.issue.invalidDomainType', { value: issue.raw });
    case 'header-name-required':
      return t('workbench.editors.rule.issue.headerNameRequired');
    case 'invalid-header-name':
      return issue.message;
    default:
      return issue.message;
  }
}

/**
 * Banner for per-input value validation issues. Renders error-severity
 * issues with the danger palette (Chrome will reject the rule) and
 * warning-severity issues with the warning palette (rule loads but
 * probably doesn't do what the user intended). When both severities are
 * present in one row we render both blocks so the user sees the full
 * picture without color-coding hiding warnings behind errors.
 */
export const ValueIssueBanner: React.FC<{
  issues: readonly ConditionValueIssue[];
  conditionType: ConditionType;
}> = ({ issues, conditionType }) => {
  const t = useT();
  const { token } = theme.useToken();
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const resolve = (list: readonly ConditionValueIssue[]) =>
    dedupe(list.map((issue) => valueIssueText(issue, conditionType, t)));
  return (
    <>
      {errors.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            marginLeft: 26,
            background: token.colorErrorBg,
            border: `1px solid ${token.colorErrorBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorErrorText,
          }}
        >
          <WarningFilled style={{ color: token.colorError, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {resolve(errors).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            marginLeft: 26,
            background: token.colorWarningBg,
            border: `1px solid ${token.colorWarningBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorWarningText,
          }}
        >
          <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {resolve(warnings).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

function dedupe(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

export interface StructuralIssueBannerProps {
  issues: readonly ConditionStructuralIssue[];
  /** Full condition list — resolves the winning row's type for the
   *  mutex-conflict copy (`issue.winningIndex` is an index into it). */
  conditions: readonly RuleCondition[];
}

function structuralIssueText(
  issue: ConditionStructuralIssue,
  conditions: readonly RuleCondition[],
  t: Translate,
): string {
  switch (issue.kind) {
    case 'duplicate-slot':
      return t('workbench.editors.rule.issue.duplicateSlot', { type: issue.type });
    case 'mutex-conflict':
      return t('workbench.editors.rule.issue.mutexConflict', {
        type: issue.type,
        winningType: conditions[issue.winningIndex]?.type ?? '',
      });
    case 'unsupported-by-dnr':
      return t('workbench.editors.rule.issue.unsupportedByDnr');
    default:
      return issue.message;
  }
}

export const StructuralIssueBanner: React.FC<StructuralIssueBannerProps> = ({ issues, conditions }) => {
  const t = useT();
  const { token } = theme.useToken();
  // Dedupe identical messages — a row can only carry one mutex-conflict
  // and one duplicate-slot at a time, but unsupported-by-dnr can
  // stack with a future kind, so the dedupe keeps the banner readable.
  const lines = dedupe(issues.map((issue) => structuralIssueText(issue, conditions, t)));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        marginLeft: 26,
        background: token.colorWarningBg,
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.4,
        color: token.colorWarningText,
      }}
    >
      <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
};

const DOMAIN_ISSUE_KEY: Record<DomainIssueKind, MessageKey> = {
  whitespace: 'workbench.editors.rule.issue.domain.whitespace',
  scheme: 'workbench.editors.rule.issue.domain.scheme',
  wildcard: 'workbench.editors.rule.issue.domain.wildcard',
  port: 'workbench.editors.rule.issue.domain.port',
  uppercase: 'workbench.editors.rule.issue.domain.uppercase',
  'non-ascii': 'workbench.editors.rule.issue.domain.nonAscii',
  empty: 'workbench.editors.rule.issue.domain.empty',
};

export interface DomainIssueBannerProps {
  issues: readonly DomainValueIssue[];
  onApplyCleanup: () => void;
}

export const DomainIssueBanner: React.FC<DomainIssueBannerProps> = ({ issues, onApplyCleanup }) => {
  const t = useT();
  const { token } = theme.useToken();
  // Group consecutive same-kind messages so the banner doesn't
  // repeat the same advice five times for five entries with the same
  // mistake (common when bulk-pasting a domain list).
  const summary = summarizeIssues(issues, t);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        marginLeft: 26, // align under the type+input columns
        background: token.colorWarningBg,
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.4,
        color: token.colorWarningText,
      }}
    >
      <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {summary.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {summary.affectedRaw.length > 0 && (
          <Tooltip title={summary.affectedRaw.join(', ')}>
            <span style={{ color: token.colorTextTertiary, cursor: 'help' }}>
              {t('workbench.editors.rule.issue.domain.affected', { count: summary.affectedRaw.length })}
            </span>
          </Tooltip>
        )}
      </div>
      {summary.fixable && (
        <Button
          size="small"
          type="link"
          onClick={onApplyCleanup}
          style={{ padding: '0 4px', height: 22, fontSize: 11 }}
        >
          {t('workbench.editors.rule.issue.domain.cleanUp')}
        </Button>
      )}
    </div>
  );
};

interface IssueSummary {
  lines: string[];
  affectedRaw: string[];
  fixable: boolean;
}

function summarizeIssues(issues: readonly DomainValueIssue[], t: Translate): IssueSummary {
  const seenKinds = new Set<DomainIssueKind>();
  const lines: string[] = [];
  const affected: string[] = [];
  let fixable = false;
  for (const issue of issues) {
    if (!seenKinds.has(issue.kind)) {
      seenKinds.add(issue.kind);
      lines.push(t(DOMAIN_ISSUE_KEY[issue.kind]));
    }
    affected.push(issue.raw);
    // `non-ascii` requires manual punycode encoding — no auto-fix.
    if (issue.kind !== 'non-ascii') fixable = true;
  }
  return { lines, affectedRaw: affected, fixable };
}
