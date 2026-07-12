import type { ActionDetail } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { buildRuleIcon } from '@openheaders/ui/workbench/components/shared/rule-icon';
import { Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;

export interface TagDescriptor {
  label: string;
  color?: string;
  tooltip?: string;
  variant?: 'outlined' | 'filled';
}

// ── Tooltip grid ────────────────────────────────────────────────
// CSS grid with `auto 1fr` columns: the key column auto-sizes to the widest
// tag across all rows, so value descriptions always start at the same x.

interface TooltipRow {
  key: string;
  /** Single string renders inline; string[] renders as a numbered list. */
  value: string | string[];
  color?: string;
}

function renderTooltipGrid(rows: TooltipRow[]): React.ReactNode {
  const tagStyle = {
    margin: 0,
    fontSize: '10px',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    textAlign: 'center' as const,
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 6px',
        alignItems: 'start',
        fontSize: 12,
      }}
    >
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          <Tag variant="outlined" color={row.color} style={tagStyle}>
            {row.key}
          </Tag>
          {Array.isArray(row.value) ? (
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {row.value.map((v, j) => (
                <div key={j}>
                  <span style={{ opacity: 0.4 }}>{j + 1}. </span>
                  <span style={{ opacity: 0.7 }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ opacity: 0.7, wordBreak: 'break-all' }}>{row.value}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function renderTagOverflow(
  allTags: TagDescriptor[],
  maxVisible: number,
  maxTagWidth?: number,
  suppressOverflowTooltip = false,
): React.ReactNode {
  const tagStyle = { margin: 0, fontSize: '11px' };
  const truncStyle = maxTagWidth
    ? {
        ...tagStyle,
        maxWidth: maxTagWidth,
        overflow: 'hidden' as const,
        textOverflow: 'ellipsis' as const,
        whiteSpace: 'nowrap' as const,
      }
    : tagStyle;
  const visible = allTags.slice(0, maxVisible);
  const overflowCount = allTags.length - maxVisible;

  const overflowTag =
    overflowCount > 0 ? (
      <Tag variant="outlined" style={{ ...tagStyle, flexShrink: 0 }}>
        +{overflowCount}
      </Tag>
    ) : null;

  return (
    <Space size={2} style={{ flexWrap: 'nowrap' }}>
      {visible.map((t, i) =>
        t.tooltip ? (
          <Tooltip key={i} title={t.tooltip}>
            <Tag color={t.color} variant={t.variant ?? 'outlined'} style={{ ...truncStyle, cursor: 'help' }}>
              {t.label}
            </Tag>
          </Tooltip>
        ) : (
          <Tag key={i} color={t.color} variant={t.variant ?? 'outlined'} style={truncStyle}>
            {t.label}
          </Tag>
        ),
      )}
      {overflowTag &&
        (suppressOverflowTooltip ? (
          overflowTag
        ) : (
          <Tooltip
            title={renderTooltipGrid(
              allTags
                .filter((t) => t.label || t.tooltip)
                .map((t) => ({ key: t.label, value: t.tooltip ?? '', color: t.color })),
            )}
            styles={{ root: { maxWidth: 400 } }}
          >
            {overflowTag}
          </Tooltip>
        ))}
    </Space>
  );
}

export type { ActionDetail } from '@openheaders/core/utils';

// ── Conditions summary ──────────────────────────────────────────

/** Short labels for inline tags (cell display). */
const CONDITION_TYPE_SHORT: Record<string, MessageKey> = {
  'url-filter': 'popup.conditions.short.urlFilter',
  'url-regex': 'popup.conditions.short.urlRegex',
  'request-domains': 'popup.conditions.short.requestDomains',
  'exclude-request-domains': 'popup.conditions.short.excludeRequestDomains',
  'initiator-domains': 'popup.conditions.short.initiatorDomains',
  'exclude-initiator-domains': 'popup.conditions.short.excludeInitiatorDomains',
  'request-methods': 'popup.conditions.short.requestMethods',
  'exclude-request-methods': 'popup.conditions.short.excludeRequestMethods',
  'resource-types': 'popup.conditions.short.resourceTypes',
  'exclude-resource-types': 'popup.conditions.short.excludeResourceTypes',
  'domain-type': 'popup.conditions.short.domainType',
  'response-header': 'popup.conditions.short.responseHeader',
  'exclude-response-header': 'popup.conditions.short.excludeResponseHeader',
};

/** Full labels for tooltip tags. */
const CONDITION_TYPE_LABEL: Record<string, MessageKey> = {
  'url-filter': 'popup.conditions.full.urlFilter',
  'url-regex': 'popup.conditions.full.urlRegex',
  'request-domains': 'popup.conditions.full.requestDomains',
  'exclude-request-domains': 'popup.conditions.full.excludeRequestDomains',
  'initiator-domains': 'popup.conditions.full.initiatorDomains',
  'exclude-initiator-domains': 'popup.conditions.full.excludeInitiatorDomains',
  'request-methods': 'popup.conditions.full.requestMethods',
  'exclude-request-methods': 'popup.conditions.full.excludeRequestMethods',
  'resource-types': 'popup.conditions.full.resourceTypes',
  'exclude-resource-types': 'popup.conditions.full.excludeResourceTypes',
  'domain-type': 'popup.conditions.full.domainType',
  'response-header': 'popup.conditions.full.responseHeader',
  'exclude-response-header': 'popup.conditions.full.excludeResponseHeader',
};

/**
 * Priority order for conditions — higher priority conditions show first in the cell.
 * request-domains is most common and most useful at a glance.
 */
const CONDITION_PRIORITY: Record<string, number> = {
  'request-domains': 0,
  'url-filter': 1,
  'url-regex': 2,
  'initiator-domains': 3,
  'resource-types': 4,
  'request-methods': 5,
  'domain-type': 6,
  'exclude-request-domains': 7,
  'exclude-initiator-domains': 8,
  'exclude-resource-types': 9,
  'exclude-request-methods': 10,
  'response-header': 11,
  'exclude-response-header': 12,
};

/** Strip protocol and trailing wildcard from URL patterns for compact display. */
function cleanUrlPattern(pattern: string): string {
  return pattern.replace(/^\*:\/\//, '').replace(/\/\*$/, '');
}

/** Resolve a condition type's display label, falling back to the raw type. */
function conditionTypeLabel(map: Record<string, MessageKey>, type: string, t: Translate): string {
  const key = map[type];
  return key ? t(key) : type;
}

/** Build a compact inline label for a condition. */
function conditionToLabel(cond: { type: string; values: string[] }, t: Translate): string {
  if (cond.values.length === 0) return conditionTypeLabel(CONDITION_TYPE_SHORT, cond.type, t);

  const firstVal = cond.values[0];

  // Domains and URL patterns: show the meaningful part directly (no prefix)
  if (cond.type === 'request-domains' || cond.type === 'exclude-request-domains') {
    return firstVal;
  }
  if (cond.type === 'url-filter' || cond.type === 'url-regex') {
    return cleanUrlPattern(firstVal);
  }

  // Other conditions: prefix + short value
  const prefix = conditionTypeLabel(CONDITION_TYPE_SHORT, cond.type, t);
  const short = firstVal.length > 10 ? `${firstVal.substring(0, 8)}…` : firstVal;
  return `${prefix}: ${short}`;
}

/** Render a compact conditions summary for table columns. */
export function renderConditionsSummary(
  conditions: Array<{ type: string; values: string[]; headerName?: string }>,
  showAllDomains: boolean,
  t: Translate,
): React.ReactNode {
  if (!conditions || conditions.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        {t('popup.conditions.none')}
      </Tag>
    ) : null;
  }

  // Sort conditions by priority for display
  const sorted = [...conditions].sort(
    (a, b) => (CONDITION_PRIORITY[a.type] ?? 99) - (CONDITION_PRIORITY[b.type] ?? 99),
  );

  // Build tag descriptors — one per condition, no per-tag tooltips
  // (single shared tooltip below). The label is smart-truncated so a
  // `{{env.LONG_NAME}}` reference doesn't render as `{{env.LO...}}`
  // (which obscured exactly the part the user needs to read). The
  // 24-char budget keeps the tag readable inside the column; CSS
  // ellipsis below acts as a last-resort fallback if the column
  // narrows further.
  const allTags: TagDescriptor[] = sorted.map((cond) => ({
    label: truncateValue(conditionToLabel(cond, t), 24),
    color: cond.type.startsWith('exclude-') ? 'warning' : undefined,
  }));

  if (allTags.length === 0) {
    return showAllDomains ? (
      <Tag variant="outlined" color="default">
        {t('popup.conditions.allDomains')}
      </Tag>
    ) : null;
  }

  // Merge conditions of the same type so the tooltip shows one tag per type
  const merged = new Map<string, string[]>();
  const mergedOrder: string[] = [];
  for (const c of sorted) {
    const key = conditionTypeLabel(CONDITION_TYPE_LABEL, c.type, t) + (c.headerName ? ` [${c.headerName}]` : '');
    if (!merged.has(key)) {
      merged.set(key, []);
      mergedOrder.push(key);
    }
    merged.get(key)!.push(...c.values);
  }

  // Single tooltip: condition type tag → numbered list of values (if multiple)
  const tooltip = renderTooltipGrid(
    mergedOrder.map((key) => {
      const values = merged.get(key)!;
      return { key, value: values };
    }),
  );

  return (
    <Tooltip title={tooltip} styles={{ root: { maxWidth: 500 } }}>
      {/* maxTagWidth bumped from 72 → 160 so smart-truncated labels
          like `{{env.…AIN}}` aren't immediately re-clipped by CSS. */}
      <div style={{ overflow: 'hidden', display: 'flex' }}>{renderTagOverflow(allTags, 1, 160, true)}</div>
    </Tooltip>
  );
}

// ── Render action details ────────────────────────────────────────

/** Rule-type-specific tag names for the label row in the tooltip grid. */
const ACTION_LABEL_KEY: Record<string, MessageKey> = {
  header: 'popup.actionDetail.name',
  redirect: 'popup.actionDetail.url',
  'query-param': 'popup.actionDetail.count',
  inject: 'popup.actionDetail.type',
  delay: 'popup.actionDetail.duration',
  'request-body': 'popup.actionDetail.format',
  response: 'popup.actionDetail.status',
};

/** Rule-type-specific tag names for the value row in the tooltip grid. */
const ACTION_VALUE_KEY: Record<string, MessageKey> = {
  header: 'popup.actionDetail.value',
  redirect: 'popup.actionDetail.url',
  inject: 'popup.actionDetail.position',
  'request-body': 'popup.actionDetail.body',
  response: 'popup.actionDetail.contentType',
};

/** Render structured action details: shared icon (with direction + placeholder) + label tag + value. */
export function renderActionDetails(
  detail: ActionDetail,
  t: Translate,
  opacity = 1,
  maxValueLen = 16,
  isActive = true,
): React.ReactNode {
  const displayValue = truncateValue(detail.value, maxValueLen);

  const opLabel = detail.operation ? detail.operation.charAt(0).toUpperCase() + detail.operation.slice(1) : '';
  const typeLabel =
    [detail.direction === 'response' ? '↓' : detail.direction === 'request' ? '↑' : '', opLabel]
      .filter(Boolean)
      .join(' ') || detail.ruleType.charAt(0).toUpperCase() + detail.ruleType.slice(1);

  const rows: Array<{ key: string; value: string | string[] }> = [{ key: typeLabel, value: detail.tooltip }];
  if (detail.items) {
    rows.push({
      key: detail.ruleType === 'header' ? t('popup.actionDetail.headers') : t('popup.actionDetail.params'),
      value: detail.items,
    });
  } else {
    if (detail.label) rows.push({ key: t(ACTION_LABEL_KEY[detail.ruleType] ?? 'popup.actionDetail.label'), value: detail.label });
    if (detail.value) rows.push({ key: t(ACTION_VALUE_KEY[detail.ruleType] ?? 'popup.actionDetail.value'), value: detail.value });
  }

  const tooltipContent = renderTooltipGrid(rows);

  return (
    <Tooltip title={tooltipContent} styles={{ root: { maxWidth: 400 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', opacity, height: '100%' }}>
        {/* Shared rule icon — same as sidebar/tabs (includes direction arrow + placeholder) */}
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {buildRuleIcon({
            ruleType: detail.ruleType,
            isActive,
            size: 13,
            direction: detail.direction as 'request' | 'response' | undefined,
          })}
        </span>

        {/* Label as tag (header name, param count, JS/CSS) */}
        {detail.label && (
          <Tag
            variant="outlined"
            style={{
              margin: 0,
              fontSize: '11px',
              padding: '0 4px',
              lineHeight: '18px',
              flexShrink: 0,
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {detail.label}
          </Tag>
        )}

        {/* Value as text */}
        {detail.value && (
          <Text
            style={{
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              lineHeight: '18px',
              color: 'var(--ant-color-text-secondary)',
            }}
          >
            {displayValue}
          </Text>
        )}
      </div>
    </Tooltip>
  );
}

/**
 * Truncate a display value WITHOUT slicing through a `{{ref}}` token.
 *
 * The naive mid-ellipsis (`a.substring(0, p) + '…' + a.substring(-s)`) used
 * to render values like `{{vault.CGM_X_BEARER_TOKEN}}` as `{{vault.C…EN}}`
 * which obscured the variable name — exactly the part the user needs to
 * read at a glance to tell which rule references which scope.
 *
 * Strategy:
 *   1. Tokenize the value into literal vs `{{ref}}` chunks.
 *   2. If the WHOLE thing fits in `maxLen`, return it as-is.
 *   3. Otherwise, prefer the LAST `{{ref}}` (the variable name is the
 *      load-bearing part of any rule). Pad with as much surrounding
 *      literal as fits, ellipsizing the rest.
 *   4. If even one ref alone is wider than `maxLen` (rare — would mean
 *      a 32+ char variable name in a small column), fall back to the
 *      legacy mid-ellipsis just on that ref so the user at least sees
 *      its namespace prefix.
 */
export function truncateValue(value: string, maxLen = 16): string {
  if (value.length <= maxLen) return value;

  type Chunk = { kind: 'lit' | 'ref'; text: string };
  const chunks: Chunk[] = [];
  const TEMPLATE = /\{\{[^}]+\}\}/g;
  let last = 0;
  for (const m of value.matchAll(TEMPLATE)) {
    const start = m.index ?? 0;
    if (start > last) chunks.push({ kind: 'lit', text: value.slice(last, start) });
    chunks.push({ kind: 'ref', text: m[0] });
    last = start + m[0].length;
  }
  if (last < value.length) chunks.push({ kind: 'lit', text: value.slice(last) });

  // No refs at all — fall back to legacy mid-ellipsis.
  if (!chunks.some((c) => c.kind === 'ref')) {
    const suffixLen = Math.max(4, Math.floor(maxLen * 0.25));
    const prefixLen = maxLen - suffixLen - 3;
    return `${value.substring(0, prefixLen)}...${value.substring(value.length - suffixLen)}`;
  }

  // Anchor on the LAST ref. The variable name is the most informative
  // token in the value at-a-glance.
  let anchorIdx = -1;
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].kind === 'ref') {
      anchorIdx = i;
      break;
    }
  }
  const anchor = chunks[anchorIdx]!;

  // Anchor alone exceeds budget — abbreviate inside the anchor as a last
  // resort, preserving its leading `{{namespace.` prefix.
  if (anchor.text.length > maxLen) {
    const inner = anchor.text.slice(2, -2); // drop the outer braces
    const dotIdx = inner.indexOf('.');
    const prefix = dotIdx >= 0 ? inner.slice(0, dotIdx + 1) : '';
    const tailBudget = Math.max(0, maxLen - 2 /* {{ */ - 2 /* }} */ - prefix.length - 1 /* … */);
    return `{{${prefix}…${inner.slice(-tailBudget)}}}`;
  }

  // Build outward from the anchor: include preceding literal/ref chunks
  // until we'd exceed budget, then prepend an ellipsis if anything was
  // dropped on the left. Same on the right (rare since anchor is last
  // ref, but a trailing literal — e.g. `{{X}} suffix` — would be
  // dropped first).
  let used = anchor.text.length;
  let leftIdx = anchorIdx;
  let rightIdx = anchorIdx;
  let leftDropped = false;
  let rightDropped = false;

  for (let i = anchorIdx - 1; i >= 0; i--) {
    const len = chunks[i].text.length;
    if (used + len + (leftDropped ? 0 : 1) /* … */ > maxLen) {
      leftDropped = leftIdx > 0;
      break;
    }
    used += len;
    leftIdx = i;
  }
  for (let i = anchorIdx + 1; i < chunks.length; i++) {
    const len = chunks[i].text.length;
    if (used + len + (rightDropped ? 0 : 1) /* … */ > maxLen) {
      rightDropped = rightIdx < chunks.length - 1;
      break;
    }
    used += len;
    rightIdx = i;
  }

  let out = chunks
    .slice(leftIdx, rightIdx + 1)
    .map((c) => c.text)
    .join('');
  if (leftIdx > 0) out = `…${out}`;
  if (rightIdx < chunks.length - 1) out = `${out}…`;
  return out;
}
