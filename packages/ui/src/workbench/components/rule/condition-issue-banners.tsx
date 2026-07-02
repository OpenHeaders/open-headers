/**
 * Per-row hints and issue banners for ConditionEditor — the value-logic
 * badge plus the three validation banners (value, structural, domain).
 * All render below/beside one condition row; the issue payloads come
 * from core's condition validators.
 */

import { WarningFilled } from '@ant-design/icons';
import type { ConditionType } from '@openheaders/core/types';
import {
  CONDITION_META,
  type ConditionStructuralIssue,
  type ConditionValueIssue,
  type DomainValueIssue,
} from '@openheaders/core/utils';
import { Button, Tag, Tooltip, theme } from 'antd';
import type React from 'react';

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
  const { token } = theme.useToken();
  const meta = CONDITION_META[type];
  if (!meta) return null;
  const label = meta.valueLogic === 'or' ? 'OR' : '1 value';
  const tooltip =
    meta.valueLogic === 'or'
      ? 'Multiple values in this row match if ANY value matches (OR). Rows below combine with AND.'
      : 'This condition takes a single value — comma-separating has no effect. Rows below combine with AND.';
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
 * Banner for per-input value validation issues. Renders error-severity
 * issues with the danger palette (Chrome will reject the rule) and
 * warning-severity issues with the warning palette (rule loads but
 * probably doesn't do what the user intended). When both severities are
 * present in one row we render both blocks so the user sees the full
 * picture without color-coding hiding warnings behind errors.
 */
export const ValueIssueBanner: React.FC<{ issues: readonly ConditionValueIssue[] }> = ({ issues }) => {
  const { token } = theme.useToken();
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
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
            {dedupeMessages(errors).map((line, i) => (
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
            {dedupeMessages(warnings).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

function dedupeMessages(issues: readonly ConditionValueIssue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    out.push(issue.message);
  }
  return out;
}

export interface StructuralIssueBannerProps {
  issues: readonly ConditionStructuralIssue[];
}

export const StructuralIssueBanner: React.FC<StructuralIssueBannerProps> = ({ issues }) => {
  const { token } = theme.useToken();
  // Dedupe identical messages — a row can only carry one mutex-conflict
  // and one duplicate-slot at a time, but unsupported-by-dnr can
  // stack with a future kind, so the dedupe keeps the banner readable.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    lines.push(issue.message);
  }
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

export interface DomainIssueBannerProps {
  issues: readonly DomainValueIssue[];
  onApplyCleanup: () => void;
}

export const DomainIssueBanner: React.FC<DomainIssueBannerProps> = ({ issues, onApplyCleanup }) => {
  const { token } = theme.useToken();
  // Group consecutive same-kind messages so the banner doesn't
  // repeat the same advice five times for five entries with the same
  // mistake (common when bulk-pasting a domain list).
  const summary = summarizeIssues(issues);
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
              {summary.affectedRaw.length} affected entr{summary.affectedRaw.length === 1 ? 'y' : 'ies'}
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
          Clean up
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

function summarizeIssues(issues: readonly DomainValueIssue[]): IssueSummary {
  const seenMessages = new Set<string>();
  const lines: string[] = [];
  const affected: string[] = [];
  let fixable = false;
  for (const issue of issues) {
    if (!seenMessages.has(issue.message)) {
      seenMessages.add(issue.message);
      lines.push(issue.message);
    }
    affected.push(issue.raw);
    // `non-ascii` requires manual punycode encoding — no auto-fix.
    if (issue.kind !== 'non-ascii') fixable = true;
  }
  return { lines, affectedRaw: affected, fixable };
}
